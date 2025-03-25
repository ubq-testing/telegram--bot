import { Chat, ChatAction, ChatStorage, HandleChatParams, RetrievalHelper, StorageTypes, UserBaseStorage, StorageUser } from "../types/storage";
import { PluginEnvContext } from "../types/plugin-env-context";
import { Context } from "../types";
import { isChatsStorage, isUserBaseStorage, isSingleChatStorage, isSessionStorage } from "./helpers/storage-guards";
import { deleteAllShas } from "./helpers/delete-shas";
import { encrypt } from "../workflow-bot-mtproto-api/bot/encryption";

export class GithubStorage {
  pluginEnvCtx: PluginEnvContext;

  storageRepo = ".ubiquity-os";
  storageBranch = "__STORAGE__";

  payloadRepoOwner: string; // ubiquity-os-marketplace
  pluginRepo: string; // is the name of this plugin's repository i.e ubiquity-os-kernel-telegram

  installID: number | null = null; // used to get the correct install _octokit

  // all need prefixed with their storage path
  chatStoragePath = "chat-storage.json";
  userStoragePath = "user-base.json";
  telegramSessionPath = "session-storage.json";

  private _octokit: Awaited<ReturnType<PluginEnvContext["getTelegramEventOctokit"]>> | null = null;

  constructor(context: Context) {
    this.pluginEnvCtx = context.pluginEnvCtx;
    const { SOURCE_REPO_OWNER, SOURCE_REPOSITORY } = context.env.TELEGRAM_BOT_ENV.workflowFunctions;
    this.pluginRepo = SOURCE_REPOSITORY;
    this.payloadRepoOwner = SOURCE_REPO_OWNER;
    this._formatStoragePaths();
  }

  async getOctokit(): Promise<NonNullable<GithubStorage["_octokit"]>> {
    if (!this._octokit) {
      this._octokit = await this.pluginEnvCtx.getTelegramEventOctokit();
    }
    return this._octokit as NonNullable<GithubStorage["_octokit"]>;
  }

  public async retrieveChatByTaskNodeId(taskNodeId: string, dbObj?: ChatStorage): Promise<Chat | undefined> {
    const dbObject = dbObj ?? (await this._retrieveStorageDataObject("allChats"));

    if (dbObject.chats) {
      const chat = dbObject.chats.find((chat) => chat.task_node_id === taskNodeId);
      if (chat) {
        return {
          ...chat,
          sha: dbObject.sha,
        };
      }
    }
  }

  public async retrieveChatByChatId(chatId: number, dbObj?: ChatStorage): Promise<Chat | undefined> {
    const dbObject = dbObj ?? (await this._retrieveStorageDataObject("allChats"));

    const chat = dbObject.chats.find((chat) => chat.chat_id === chatId);
    if (chat) {
      return {
        ...chat,
        sha: dbObject.sha,
      };
    }
  }

  public async retrieveUserByTelegramId(telegramId: number, dbObj?: UserBaseStorage) {
    const dbObject = dbObj ?? (await this._retrieveStorageDataObject("userBase"));
    const user = dbObject.users[telegramId];

    if (user) {
      return {
        ...user,
        sha: dbObject.sha,
      };
    }
  }

  public async retrieveUserByGithubId(githubId: number | null | undefined, dbObj?: UserBaseStorage): Promise<StorageUser | undefined> {
    const dbObject = dbObj ?? (await this._retrieveStorageDataObject("userBase"));
    const user = Object.values(dbObject.users).find((user) => user.github_id === githubId);
    if (user) {
      return {
        ...user,
        sha: dbObject.sha,
      };
    }
  }

  public async retrieveSession() {
    const { session } = await this._retrieveStorageDataObject("session");
    return session;
  }

  public async retrieveAllUsers() {
    const { users } = await this._retrieveStorageDataObject("userBase");
    return users;
  }

  // Functions for handling data

  public async userSnapshot(chatId: number, userIds: number[], dbObj?: ChatStorage) {
    const dbObject = dbObj ?? (await this._retrieveStorageDataObject("allChats"));

    const chat = dbObject.chats.find((chat) => chat.chat_id === chatId);

    if (!chat) {
      throw new Error("Chat not found");
    }

    dbObject.chats = dbObject.chats.map((dbChat) => {
      if (dbChat.chat_id === chatId) {
        return {
          ...dbChat,
          userIds,
        };
      }

      return dbChat;
    });

    await this._storeData(dbObject);
  }

  // Storage handlers

  /**
   * This will create | reopen | close a chat. It must be passed the full
   * chat object.
   */

  public async handleChat<TAction extends ChatAction>(params: HandleChatParams<TAction>) {
    // we'll need this no matter what
    const dbObject = await this._retrieveStorageDataObject("allChats");

    const { action, chat } = params;

    if (action === "create") {
      dbObject.chats ??= [];
      dbObject.chats.push(chat);
    } else {
      const nodeId = chat.task_node_id;
      const chatIndex = dbObject.chats.findIndex((dbChat) => nodeId === dbChat.task_node_id);

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

    return await this._storeData(dbObject);
  }

  /**
   * Consider "create" to be update as we'll delete the old session
   * and replace it with the new one.
   *
   * "delete" will remove the session, this will break things without a new session.
   */

  public async handleSession<TAction extends "create" | "delete">(session: string, action: TAction) {
    const dbObject = await this._retrieveStorageDataObject("session", true);

    try {
      if (action === "create") {
        dbObject.session = encrypt(this.pluginEnvCtx.getEnv().APP_PRIVATE_KEY, session);
      } else {
        dbObject.session = null;
      }
    } catch {
      await this._handleMissingStorageBranchOrFile(this.payloadRepoOwner, this.telegramSessionPath, "session");
      return await this._storeData(dbObject, false);
    }

    return await this._storeData(dbObject, false);
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

  public async handleUserBaseStorage<TType extends "create" | "delete" | "update">(user: StorageUser, action: TType) {
    const dbObject = await this._retrieveStorageDataObject("userBase");

    if (action === "create" || action === "update") {
      dbObject.users[user.telegram_id] = user;
    } else {
      delete dbObject.users[user.telegram_id];
    }

    return await this._storeData(dbObject);
  }

  /**
   * Stores data in the GitHub repo. It will overwrite the existing
   * data, so ensure you're passing the full object, not just the
   * updated properties, or mistakes will be made.
   *
   * Do we need a safety check to ensure we are not accidentally deleting data? Maybe, needs tested.
   */

  private async _storeData<TType extends StorageTypes>(data: RetrievalHelper<TType>, formatJson = true): Promise<boolean> {
    if (!data) {
      throw new Error("No data provided to store");
    }
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

    const content = formatJson ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    const authedOctokit = await this.getOctokit();

    try {
      if (!sha) {
        const { data: shaData } = await authedOctokit.rest.repos.getContent({
          owner: this.payloadRepoOwner,
          repo: this.storageRepo,
          path,
          ref: this.storageBranch,
        });

        if ("sha" in shaData) {
          sha = shaData.sha;
        }
      }

      await authedOctokit.rest.repos.createOrUpdateFileContents({
        owner: this.payloadRepoOwner,
        repo: this.storageRepo,
        path,
        branch: this.storageBranch,
        message: `chore: updated ${type.replace(/([A-Z])/g, " $1").toLowerCase()}`,
        content: Buffer.from(content).toString("base64"),
        sha,
      });
      return true;
    } catch {
      await this._handleMissingStorageBranchOrFile(this.payloadRepoOwner, path, type);
      return await this._storeData(data);
    }
  }

  /**
   * Does not fetch granular data, instead obtains the DB object
   * and returns it.
   *
   * Fitted with a helper for returning the correct storage type depending on the param.
   */
  private async _retrieveStorageDataObject<TType extends StorageTypes = StorageTypes>(type: TType, withSha?: boolean): Promise<RetrievalHelper<TType>> {
    const path = this._getStoragePath(type);
    const authedOctokit = await this.getOctokit();

    try {
      const { data } = await authedOctokit.rest.repos.getContent({
        owner: this.payloadRepoOwner,
        repo: this.storageRepo,
        path,
        ref: this.storageBranch,
      });

      if ("content" in data) {
        const dataContent = Buffer.from(data.content, "base64").toString();
        const sha = data.sha;
        const parsedData = JSON.parse(dataContent);
        return { ...parsedData, ...(withSha ? { sha } : {}) };
      } else {
        throw new Error("Data content not found");
      }
    } catch {
      const isSuccessful = await this._handleMissingStorageBranchOrFile(this.payloadRepoOwner, path, type);
      if (!isSuccessful) {
        throw new Error("Failed to retrieve storage data");
      }
      return await this._retrieveStorageDataObject(type, withSha);
    }
  }

  private async _handleMissingStorageBranchOrFile(owner: string, path: string, type: StorageTypes): Promise<boolean> {
    const authedOctokit = await this.getOctokit();

    try {
      await authedOctokit.rest.repos.getBranch({
        owner,
        repo: this.storageRepo,
        branch: this.storageBranch,
      });
    } catch {
      await this._createStorageBranch(owner);
    }

    let content: string | null = null;

    if (type === "session") {
      content = JSON.stringify({ session: null });
    } else if (type === "allChats" || type === "singleChat") {
      content = JSON.stringify({ chats: [] });
    } else if (type === "userBase") {
      content = JSON.stringify({ users: {} });
    }

    if (!content) {
      throw new Error(`Invalid storage type: ${type}-${path}-${owner}`);
    }

    try {
      await authedOctokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo: this.storageRepo,
        path,
        branch: this.storageBranch,
        message: `chore: create ${type.replace(/([A-Z])/g, " $1").toLowerCase()}`,
        content: Buffer.from(content).toString("base64"),
      });
      return true;
    } catch {
      throw new Error("Failed to create new storage file");
    }
  }

  private async _createStorageBranch(owner: string): Promise<void> {
    const authedOctokit = await this.getOctokit();

    try {
      const { data: defaultBranchData } = await authedOctokit.rest.repos.getCommit({
        owner,
        repo: this.storageRepo,
        ref: "heads/main",
      });

      await authedOctokit.rest.git.createRef({
        owner,
        repo: this.storageRepo,
        ref: `refs/heads/${this.storageBranch}`,
        sha: defaultBranchData.sha,
      });
    } catch {
      throw new Error("Failed to create new storage branch");
    }
  }

  private _getStoragePath(type: StorageTypes): string {
    const storagePaths = {
      allChats: this.chatStoragePath,
      singleChat: this.chatStoragePath,
      userBase: this.userStoragePath,
      session: this.telegramSessionPath,
    };
    return storagePaths[type];
  }
  /**
   * Standardized storage paths for the partner's repository.
   *
   * https://github.com/ubiquity-os/plugin-template/issues/2#issuecomment-2395009642
   * https://github.com/ubiquity-os-marketplace/ubiquity-os-kernel-telegram/pull/3#issuecomment-2394941038
   *
   * e.g:
   * - ubiquibot-config/plugin-store/ubiquity-os/ubiquity-os-kernel-telegram/chat-storage.json
   * - ubiquibot-config/plugin-store/ubiquity-os/ubiquity-os-kernel-telegram/user-base.json
   * - ubiquibot-config/plugin-store/ubiquity-os/ubiquity-os-kernel-telegram/session-storage.json
   */

  private _formatStoragePaths() {
    this.chatStoragePath = `plugin-store/${this.payloadRepoOwner}/${this.pluginRepo}/${this.chatStoragePath}`;
    this.userStoragePath = `plugin-store/${this.payloadRepoOwner}/${this.pluginRepo}/${this.userStoragePath}`;
    this.telegramSessionPath = `plugin-store/${this.payloadRepoOwner}/${this.pluginRepo}/${this.telegramSessionPath}`;
  }
}
