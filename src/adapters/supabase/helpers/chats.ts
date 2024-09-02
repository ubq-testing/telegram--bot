import { SupabaseClient } from "@supabase/supabase-js";
import { Super } from "./supabase";
import { Context } from "../../../types/context";

/**
 * Handles all telegram chat storage and retrieval
 */
export class Chats extends Super {
    constructor(supabase: SupabaseClient, context: Context) {
        super(supabase, context);
    }

    async getChatById(chatId: number) {
        const { data, error } = (await this.supabase.from("chats").select("*").eq("id", chatId).single()) as { data: unknown; error: unknown };
        if (error || !data) {
            this.context.logger.error("No chat found", { chatId });
        } else {
            this.context.logger.info("Successfully fetched chat", { chatId });
        }

        return data;
    }

    async getChatByName(chatName: string) {
        const { data, error } = (await this.supabase.from("chats").select("*").eq("name", chatName).single()) as { data: unknown; error: unknown };
        if (error || !data) {
            this.context.logger.error("No chat found", { chatName });
        } else {
            this.context.logger.info("Successfully fetched chat", { chatName });
        }

        return data;
    }

    async saveChat(chatId: number, chatName: string) {
        const { data, error } = (await this.supabase.from("chats").upsert({ id: chatId, name: chatName })) as { data: unknown; error: unknown };
        if (error || !data) {
            this.context.logger.error("Failed to save chat", { chatId, chatName });
        } else {
            this.context.logger.info("Successfully saved chat", { chatId, chatName });
        }

        return data;
    }

    async updateChat(chatId: number, chatName: string) {
        const { data, error } = (await this.supabase.from("chats").update({ name: chatName }).eq("id", chatId)) as { data: unknown; error: unknown };
        if (error || !data) {
            this.context.logger.error("Failed to update chat", { chatId, chatName });
        } else {
            this.context.logger.info("Successfully updated chat", { chatId, chatName });
        }

        return data;
    }
}