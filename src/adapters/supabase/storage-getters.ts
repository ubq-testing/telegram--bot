import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { UserBaseStorage } from "../../types/storage";

export class StorageGetters {
  protected supabase: SupabaseClient;
  protected logger = logger;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
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

  async retrieveUserByTelegramId(telegramId: number): Promise<UserBaseStorage | undefined> {
    const { data, error } = await this.supabase.from("userbase").select("*").eq("telegram_id", telegramId).single();
    if (error || !data) {
      this.logger.error("No user found", { telegramId, err: error });
    } else {
      this.logger.info("Successfully fetched user", { telegramId });
    }

    return data;
  }

  async retrieveUserByGithubId(githubId: number | null | undefined): Promise<UserBaseStorage | undefined> {
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
}
