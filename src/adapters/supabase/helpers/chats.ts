import { SupabaseClient } from "@supabase/supabase-js";
import { Super } from "./supabase";

/**
 * Handles all telegram chat storage and retrieval
 */
export class Chats extends Super {
  constructor(supabase: SupabaseClient) {
    super(supabase);
  }

  /**
   * Used for storing the userIds of a chat before we
   * ban all of them and archive the chat.
   */
  async userSnapshot(chatId: number, userIds: number[]) {
    const chat = await this.getChatByChatId(chatId);
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

    return data;
  }

  async updateChatStatus(status: "open" | "closed" | "reopened", taskNodeId?: string, chatId?: number) {
    if (!taskNodeId && !chatId) {
      this.logger.error("No taskNodeId or chatId provided to update chat status");
      return;
    }

    let chat;

    if (taskNodeId) {
      chat = await this.getChatByTaskNodeId(taskNodeId);
    } else if (chatId) {
      chat = await this.getChatByChatId(chatId);
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

  async getChatByChatId(chatId: number) {
    const { data, error } = await this.supabase.from("chats").select("*").eq("chat_id", chatId).single();
    if (error || !data) {
      this.logger.error("No chat found", { chatId });
    } else {
      this.logger.info("Successfully fetched chat", { chatId });
    }

    return data;
  }

  async getChatByChatName(chatName: string) {
    const { data, error } = await this.supabase.from("chats").select("*").eq("chat_name", chatName).single();
    if (error || !data) {
      this.logger.error("No chat found", { chatName });
    } else {
      this.logger.info("Successfully fetched chat", { chatName });
    }

    return data;
  }

  async getChatByTaskNodeId(taskNodeId: string) {
    const { data, error } = await this.supabase.from("chats").select("*").eq("task_node_id", taskNodeId).single();
    if (error || !data) {
      this.logger.error("No chat found", { taskNodeId });
    } else {
      this.logger.info("Successfully fetched chat", { taskNodeId });
    }

    return data;
  }
}
