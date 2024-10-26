import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { Context } from "../../types";
import { Chat, ChatAction, ChatStorage, HandleChatParams, RetrievalHelper, SessionStorage, StorageTypes, UserBaseStorage } from "../../types/storage";

export interface Storage {
  userSnapshot(chatId: number, userIds: number[]): Promise<void>;
  getChatUsers(chatId: number): Promise<number[]>;
  getAllUsers(): Promise<UserBaseStorage[]>;
  updateChatStatus(status: "open" | "closed" | "reopened", taskNodeId?: string, chatId?: number): Promise<void>;
  saveChat(chatId: number, chatName: string, taskNodeId: string): Promise<void>;
  retrieveChatByChatId(chatId: number): Promise<Chat | undefined>;
  retrieveChatByTaskNodeId(taskNodeId: string): Promise<Chat | undefined>;
  retrieveUserByTelegramId(telegramId: number, dbObj?: UserBaseStorage): Promise<UserBaseStorage | undefined>;
  retrieveUserByGithubId(githubId: number | null | undefined, dbObj?: UserBaseStorage): Promise<UserBaseStorage | undefined>;
  retrieveSession(): Promise<string | null>;
  handleChat<TAction extends ChatAction>(params: HandleChatParams<TAction>): Promise<void>;
  handleSession<TAction extends "create" | "delete">(session: string, action: TAction): Promise<void>;
  handleUserBaseStorage<TType extends "create" | "delete" | "update">(user: UserBaseStorage, action: TType): Promise<boolean>;
  storeData<TType extends StorageTypes>(data: RetrievalHelper<TType> | null, idToDelete?: number): Promise<boolean>;
}

export class SuperbaseStorage implements Storage {
  protected supabase: SupabaseClient;
  protected logger = logger;
  octokit: Context["octokit"];

  constructor(ctx: Context, supabase: SupabaseClient) {
    this.supabase = supabase;
    this.octokit = ctx.octokit;
  }

  /**
   * Used for storing the userIds of a chat before we
   * ban all of them and archive the chat.
   */
  async userSnapshot(chatId: number, userIds: number[]) {
    const chat = await this.retrieveChatByChatId(chatId);
    const { error } = await this.supabase.from("chats").update({ user_ids: userIds }).eq("chat_id", chat.chat_id);
    if (error) {
      this.logger.error("Failed to save chat users", { chatId, userIds, er: error });
    } else {
      this.logger.info("Successfully saved chat users", { chatId, userIds });
    }
  }

  /**
   * Returns the userIds of a previously closed chat otherwise an empty array.
   */
  async getChatUsers(chatId: number) {
    const { data, error } = await this.supabase.from("chats").select("user_ids").eq("chat_id", chatId).single();
    if (error || !data) {
      this.logger.error("No chat users found", { chatId });
    } else {
      this.logger.info("Successfully fetched chat users", { chatId });
    }

    return data?.user_ids || [];
  }

  async getAllUsers() {
    const { data, error } = await this.supabase.from("userbase").select("*");
    if (error || !data) {
      this.logger.error("No users found", { er: error });
    } else {
      this.logger.info("Successfully fetched users");
    }

    return data || [];
  }

  async updateChatStatus(status: "open" | "closed" | "reopened", taskNodeId?: string, chatId?: number) {
    if (!taskNodeId && !chatId) {
      this.logger.error("No taskNodeId or chatId provided to update chat status");
      return;
    }

    let chat;

    if (taskNodeId) {
      chat = await this.retrieveChatByTaskNodeId(taskNodeId);
    } else if (chatId) {
      chat = await this.retrieveChatByChatId(chatId);
    }

    if (!chat) {
      this.logger.error("No chat found to update chat status");
      return;
    }

    const { error } = await this.supabase.from("chats").update({ status }).eq("chat_id", chat.chat_id);

    if (error) {
      this.logger.error("Failed to update chat status", { chatId, taskNodeId, er: error });
    } else {
      this.logger.info("Successfully updated chat status", { chatId, taskNodeId });
    }
  }

  async saveChat(chatId: number, chatName: string, taskNodeId: string) {
    const { error } = await this.supabase.from("chats").insert([{ chat_id: chatId, chat_name: chatName, task_node_id: taskNodeId, status: "open" }]);
    if (error) {
      this.logger.error("Failed to save chat", { chatId, chatName, taskNodeId, er: error });
    } else {
      this.logger.info("Successfully saved chat", { chatId, chatName });
    }
  }

  async retrieveChatByChatId(chatId: number) {
    const { data, error } = await this.supabase.from("chats").select("*").eq("chat_id", chatId).single();
    if (error || !data) {
      this.logger.error("No chat found", { chatId });
    } else {
      this.logger.info("Successfully fetched chat", { chatId });
    }

    return data;
  }

  async retrieveChatByTaskNodeId(taskNodeId: string) {
    const { data, error } = await this.supabase.from("chats").select("*").eq("task_node_id", taskNodeId).single();
    if (error || !data) {
      this.logger.error("No chat found", { taskNodeId });
    } else {
      this.logger.info("Successfully fetched chat", { taskNodeId });
    }

    return data;
  }

  async retrieveUserByTelegramId(telegramId: number, dbObj?: UserBaseStorage): Promise<UserBaseStorage | undefined> {
    const { data, error } = await this.supabase.from("userbase").select("*").eq("telegram_id", telegramId).single();
    if (error || !data) {
      this.logger.error("No user found", { telegramId, err: error });
    } else {
      this.logger.info("Successfully fetched user", { telegramId });
    }

    return data;
  }

  async retrieveUserByGithubId(githubId: number | null | undefined, dbObj?: UserBaseStorage): Promise<UserBaseStorage | undefined> {
    if (!githubId) {
      this.logger.error("No githubId provided to retrieve user");
      return;
    }

    const { data, error } = await this.supabase.from("userbase").select("*").eq("github_id", githubId).single();
    if (error || !data) {
      this.logger.error("No user found", { githubId, err: error });
    } else {
      this.logger.info("Successfully fetched user", { githubId });
    }

    return data;
  }

  async retrieveSession() {
    const { data, error } = await this.supabase.from("tg-bot-sessions").select("*").single();
    if (error || !data) {
      this.logger.error("No session found", { err: error });
    } else {
      return data.session;
    }
  }

  async handleChat<TAction extends ChatAction>(params: HandleChatParams<TAction>) {
    const { action, chat } = params;
    const nodeId = chat.taskNodeId;

    if (!nodeId) {
      throw new Error("No taskNodeId provided");
    }

    if (action === "create") {
      await this.saveChat(chat.chatId, chat.chatName, nodeId);
    } else if (action === "close" || action === "reopen") {
      await this.updateChatStatus(action as "closed" | "reopened", nodeId);
    } else {
      throw new Error("Invalid chat storage action");
    }
  }

  /**
   * Consider "create" to be update as we'll delete the old session
   * and replace it with the new one.
   *
   * "delete" will remove the session, this will break things without a new session.
   */
  async handleSession<TAction extends "create" | "delete">(session: string, action: TAction) {
    if (action === "create") {
      await this.storeData({ session });
    } else {
      await this.storeData({ session: null });
    }
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
  async handleUserBaseStorage<TType extends "create" | "delete" | "update">(user: UserBaseStorage, action: TType) {
    const existingUser = await this.retrieveUserByTelegramId(user.telegram_id);

    if ((action === "create" && existingUser)) {
      throw new Error("User already exists");
    }
    if (action === "delete" && !existingUser) {
      throw new Error("User does not exist");
    }

    if (action === "create" || action === "update") {
      await this.storeData(existingUser ? { ...existingUser, ...user } : user);
    } else {
      await this.storeData(null, user.telegram_id);
    }

    return true;
  }

  /**
   * Stores data in the GitHub repo. It will overwrite the existing
   * data, so ensure you're passing the full object, not just the
   * updated properties, or mistakes will be made.
   *
   * Do we need a safety check to ensure we are not accidentally deleting data? Maybe, needs tested.
   */
  async storeData<TType extends StorageTypes>(data: RetrievalHelper<TType> | null, idToDelete?: number) {
    let type: StorageTypes | undefined;

    if (!data && idToDelete) {
      await this.supabase.from("userbase").delete().eq("telegram_id", idToDelete);
    } else if (!data) {
      throw new Error("No data provided to store");
    }

    if (isChatsStorage(data)) {
      type = "allChats";
    } else if (isUserBaseStorage(data)) {
      type = "userBase";
    } else if (isSingleChatStorage(data)) {
      type = "singleChat";
    } else if (isSessionStorage(data)) {
      type = "session";
    } else {
      throw new Error("Invalid data type");
    }

    if (!type) {
      throw new Error("Invalid data type");
    }

    const tables = {
      allChats: "chats",
      singleChat: "chats",
      userBase: "userbase",
      session: "tg-bot-sessions",
    };

    try {
      const { error } = await this.supabase.from(tables[type]).upsert(data);
      if (error) {
        throw new Error("Failed to store data");
      }
      return true;
    } catch (er) {
      logger.error("Failed to store data", { data, er });
      return false;
    }
  }
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
  const keys = Object.keys(data);
  return keys.includes("telegram_id") && keys.includes("github_id") && keys.includes("listening_to") && keys.includes("additional_user_listeners");
}

function isSingleChatStorage(data: unknown): data is Chat {
  if (typeof data !== "object" || !data) return false;
  return "chatId" in data || "taskNodeId" in data;
}
