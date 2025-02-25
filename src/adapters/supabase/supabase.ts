import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { Context } from "../../types";
import { ChatAction, HandleChatParams, RetrievalHelper, StorageTypes, UserBaseStorage } from "../../types/storage";
import { StorageGetters } from "./storage-getters";
import { isChatsStorage, isUserBaseStorage, isSingleChatStorage, isSessionStorage } from "../storage-guards";
import { Storage } from "../create-adapters";

export class SuperbaseStorage extends StorageGetters implements Storage {
  protected supabase: SupabaseClient;
  protected logger = logger;
  octokit: Context["octokit"];

  constructor(octokit: Context["octokit"], supabase: SupabaseClient) {
    super(supabase);
    this.supabase = supabase;
    this.octokit = octokit;
  }

  async userSnapshot(chatId: number, userIds: number[]) {
    const chat = await this.retrieveChatByChatId(chatId);
    const { error } = await this.supabase.from("chats").update({ user_ids: userIds }).eq("chat_id", chat.chat_id);
    if (error) {
      this.logger.error("Failed to save chat users", { chatId, userIds, er: error });
    } else {
      this.logger.info("Successfully saved chat users", { chatId, userIds });
    }
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

  async handleChat<TAction extends ChatAction>(params: HandleChatParams<TAction>) {
    const { action, chat } = params;
    const nodeId = chat.task_node_id;

    if (!nodeId) {
      throw new Error("No taskNodeId provided");
    }

    if (action === "create") {
      await this.saveChat(chat.chat_id, chat.chat_name, nodeId);
    } else if (action === "close" || action === "reopen") {
      const status = action === "close" ? "closed" : "reopened";
      await this.updateChatStatus(status, nodeId);
    } else {
      throw new Error("Invalid chat storage action");
    }
  }

  async handleSession<TAction extends "create" | "delete">(action: TAction, session: string) {
    if (action === "create") {
      await this.storeData({ session });
    } else {
      await this.storeData({ session: null });
    }
  }

  async handleUserBaseStorage<TType extends "create" | "delete" | "update">(user: UserBaseStorage, action: TType) {
    const existingUser = await this.retrieveUserByTelegramId(user.telegram_id);

    if (action === "create" && existingUser) {
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
