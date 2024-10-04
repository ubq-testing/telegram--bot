import { Octokit } from "@octokit/rest";
import { logger } from "../../utils/logger";
import {
  Chat,
  ChatAction,
  ChatStorage,
  HandleChatParams,
  RetrievalHelper,
  StorageTypes,
  UserBaseStorage,
  SessionStorage,
  Withsha,
} from "../../types/github-storage";

/**
 * Uses GitHub as a storage layer, in particular, a JSON
 * based private repository.
 */
export class GithubStorage {
  octokit: Octokit;
  logger = logger;

  repo = "ubiquibot-config";
  owner = "ubq-testing";
  chatStoragePath = "plugin-storage/telegram-bot/chat-storage.json";
  userStoragePath = "plugin-storage/telegram-bot/user-base.json";
  telegramSessionPath = "plugin-storage/telegram-bot/session-storage.json";

  constructor(octokit: Octokit) {
    this.octokit = octokit;
  }

  // Granular Data Retrieval

  async retrieveChatByTaskNodeId(taskNodeId: string, dbObj?: ChatStorage): Promise<Chat | undefined> {
    const dbObject = dbObj ?? (await this.retrieveStorageDataObject("allChats"));

    const chat = dbObject.chats.find((chat) => chat.taskNodeId === taskNodeId);
    if (chat) {
      return {
        ...chat,
        sha: dbObject.sha,
      };
    }
  }

  async retrieveChatByChatId(chatId: number, dbObj?: ChatStorage): Promise<Chat | undefined> {
    const dbObject = dbObj ?? (await this.retrieveStorageDataObject("allChats"));

    const chat = dbObject.chats.find((chat) => chat.chatId === chatId);
    if (chat) {
      return {
        ...chat,
        sha: dbObject.sha,
      };
    }
  }

  async retrieveUserByTelegramId(telegramId: number, dbObj?: UserBaseStorage): Promise<UserBaseStorage[string] | undefined> {
    const dbObject = dbObj ?? (await this.retrieveStorageDataObject("userBase"));

    const user = dbObject[telegramId];

    if (user) {
      return {
        ...user,
        sha: dbObject.sha,
      };
    }
  }

  async retrieveUserByGithubId(githubId: number, dbObj?: UserBaseStorage): Promise<UserBaseStorage[string] | undefined> {
    const dbObject = dbObj ?? (await this.retrieveStorageDataObject("userBase"));

    const user = Object.values(dbObject).find((user) => user.githubId === githubId);

    if (user) {
      return {
        ...user,
        sha: dbObject.sha,
      };
    }
  }

  async retrieveSession() {
    const session = await this.retrieveStorageDataObject("session");

    return session.session;
  }

  // Functions for handling data

  async userSnapshot(chatId: number, userIds: number[], dbObj?: ChatStorage) {
    const dbObject = dbObj ?? (await this.retrieveStorageDataObject("allChats"));

    const chat = dbObject.chats.find((chat) => chat.chatId === chatId);

    if (!chat) {
      throw new Error("Chat not found");
    }

    dbObject.chats = dbObject.chats.map((dbChat) => {
      if (dbChat.chatId === chatId) {
        return {
          ...dbChat,
          userIds,
        };
      }

      return dbChat;
    });

    return await this.storeData(dbObject);
  }

  // Storage handlers

  /**
   * This will create | reopen | close a chat. It must be passed the full
   * chat object.
   */
  async handleChat<TAction extends ChatAction>(params: HandleChatParams<TAction>) {
    // we'll need this no matter what
    const dbObject = await this.retrieveStorageDataObject("allChats");

    const { action, chat } = params;

    if (action === "create") {
      dbObject.chats ??= [];
      dbObject.chats.push(chat);
    } else {
      const nodeId = chat.taskNodeId;
      const chatIndex = dbObject.chats.findIndex((dbChat) => nodeId === dbChat.taskNodeId);

      if (chatIndex === -1) {
        throw new Error("Chat not found");
      }

      if (action === "reopen") {
        dbObject.chats[chatIndex] = {
          ...dbObject.chats[chatIndex],
          status: "reopened",
        };
      } else {
        dbObject.chats[chatIndex] = {
          ...chat,
          status: "closed",
        };
      }
    }

    return await this.storeData(dbObject);
  }

  /**
   * Consider "create" to be update as we'll delete the old session
   * and replace it with the new one.
   *
   * "delete" will remove the session, this will break things without a new session.
   */
  async handleSession<TAction extends "create" | "delete">(session: string, action: TAction) {
    const dbObject = await this.retrieveStorageDataObject("session", true);

    if (action === "create") {
      dbObject.session = session;
    } else {
      dbObject.session = null;
    }

    return await this.storeData(dbObject);
  }

  /**
   * Updates the user bank with the new user data. If the user already exists,
   * it will overwrite the existing data or delete it if the action is "delete".
   *
   * This is a Telegram focused method, so we'll use the telegramId as the key.
   * This way notifications can only be received to the account which is subscribing,
   * them may choose to listen into other users, but cannot enable notifications for
   * another user.
   */
  async handleUserBaseStorage<TType extends "create" | "delete" | "update">(user: UserBaseStorage[string], action: TType) {
    const dbObject = await this.retrieveStorageDataObject("userBase");

    const existingUser = dbObject[user.telegramId];

    if ((action === "create" && existingUser) || (action === "delete" && !existingUser)) {
      throw new Error("User already exists or does not exist");
    }

    if (action === "create" || action === "update") {
      dbObject[user.telegramId] = user;
    } else {
      delete dbObject[user.telegramId];
    }

    return await this.storeData(dbObject);
  }

  // Low level fetching and storage

  /**
   * Stores data in the GitHub repo. It will overwrite the existing
   * data, so ensure you're passing the full object, not just the
   * updated properties, or mistakes will be made.
   *
   * Do we need a safety check to ensure we are not accidentally deleting data? Maybe, needs tested.
   */
  async storeData<TType extends StorageTypes>(data: RetrievalHelper<TType>) {
    let path;
    let type: StorageTypes;
    let { sha } = data;

    data = deleteAllShas(data);

    if (isChatsStorage(data)) {
      path = this.chatStoragePath;
      type = "allChats";
    } else if (isUserBaseStorage(data)) {
      path = this.userStoragePath;
      type = "userBase";
    } else if (isSingleChatStorage(data)) {
      path = this.chatStoragePath;
      type = "singleChat";
    } else if (isSessionStorage(data)) {
      path = this.telegramSessionPath;
      type = "session";
    } else {
      throw new Error("Invalid data type");
    }

    const content = JSON.stringify(data, null, 2);

    if (!sha) {
      const { data: shaData } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: "storage",
      });

      if ("sha" in shaData) {
        sha = shaData.sha;
      }
    }

    try {
      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path,
        // Bit of a gotcha but we'll document the GitHub Storage layer separate from this plugin
        branch: "storage",
        message: `chore: updated ${type}`,
        content: Buffer.from(content).toString("base64"),
        sha,
      });
    } catch (er) {
      this.logger.error("Failed to store data", { er });
      return false;
    }

    return true;
  }

  /**
   * Does not fetch granular data, instead obtains the DB object
   * and returns it.
   *
   * Fitted with a helper for returning the correct storage type depending on the param.
   */
  async retrieveStorageDataObject<TType extends StorageTypes = StorageTypes>(type: TType, withSha?: boolean): Promise<RetrievalHelper<TType>> {
    let path;

    if (type === "allChats" || type === "singleChat") {
      path = this.chatStoragePath;
    } else if (type === "userBase") {
      path = this.userStoragePath;
    } else if (type === "session") {
      path = this.telegramSessionPath;
    }

    if (!path) {
      throw new Error("Invalid storage type");
    }

    const { data } = await this.octokit.repos.getContent({
      owner: this.owner,
      repo: this.repo,
      path,
      ref: "storage", // we'll always use the storage branch (avoids false commit activity on default branch)
    });

    let dataContent;

    if ("content" in data) {
      dataContent = data.content;
    } else {
      throw new Error("Failed to retrieve data content");
    }

    const content = Buffer.from(dataContent, "base64").toString();

    let parsedData: RetrievalHelper<TType>;

    try {
      parsedData = JSON.parse(content);
    } catch {
      throw new Error("Failed to parse JSON data");
    }

    return {
      ...parsedData,
      ...(withSha ? { sha: data.sha } : {}),
    };
  }
}

function deleteAllShas<T extends Withsha>(data: T) {
  Object.keys(data).forEach((key) => {
    const value = data[key as keyof typeof data];

    if (key === "sha") {
      Reflect.deleteProperty(data, key);
    }

    if (typeof value === "object" && value) {
      deleteAllShas(value);
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === "object" && item) {
          deleteAllShas(item);
        }
      });
    }
  });

  return data;
}

function isSessionStorage(data: unknown): data is SessionStorage {
  if (typeof data !== "object" || !data) return false;
  return "session" in data;
}

function isChatsStorage(data: unknown): data is ChatStorage {
  if (typeof data !== "object" || !data) return false;
  return "chats" in data;
}

function isUserBaseStorage(data: unknown): data is UserBaseStorage {
  if (typeof data !== "object" || !data) return false;
  const firstItem = Object.values(data)[0];
  if (typeof firstItem !== "object" || !firstItem) return false;
  const keys = Object.keys(firstItem);
  return keys.includes("telegramId") && keys.includes("githubId") && keys.includes("listeningTo") && keys.includes("additionalUserListeners");
}

function isSingleChatStorage(data: unknown): data is Chat {
  if (typeof data !== "object" || !data) return false;
  return "chatId" in data || "taskNodeId" in data;
}
