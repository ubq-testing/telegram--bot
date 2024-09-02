import { SupabaseClient } from "@supabase/supabase-js";
import { Super } from "./supabase";
import { Context } from "../../../types/context";

export type Chat = {
    chatId: number;
    chatName: string;
    taskNodeId: string;
    status: string;
}

/**
 * Handles all telegram chat storage and retrieval
 */
export class Chats extends Super {
    constructor(supabase: SupabaseClient, context: Context) {
        super(supabase, context);
    }

    async updateChatStatus(status: string, taskNodeId?: string, chatId?: number) {
        if (!taskNodeId && !chatId) {
            this.context.logger.error("No taskNodeId or chatId provided to update chat status");
            return;
        }

        let chat;

        if (taskNodeId) {
            chat = await this.getChatByTaskNodeId(taskNodeId);
        } else if (chatId) {
            chat = await this.getChatByChatId(chatId);
        }

        if (!chat) {
            this.context.logger.error("No chat found to update chat status");
            return;
        }

        const { data, error } = (await this.supabase.from("chats").upsert({ ...chat, status })) as { data: unknown; error: unknown };

        if (error || !data) {
            this.context.logger.error("Failed to update chat status", { chatId, taskNodeId });
        } else {
            this.context.logger.info("Successfully updated chat status", { chatId, taskNodeId });
        }
    }


    async saveChat(chatId: number, chatName: string, taskNodeId: string) {
        const { data, error } = (await this.supabase.from("chats").insert([{ chatId, chatName, taskNodeId, status: "open" }]) as { data: unknown; error: unknown });
        if (error) {
            this.context.logger.error("Failed to save chat", { chatId, chatName, taskNodeId, er: error });
        } else {
            this.context.logger.info("Successfully saved chat", { chatId, chatName });
        }

        return data;
    }

    async getChatByChatId(chatId: number) {
        const { data, error } = (await this.supabase.from("chats").select("*").eq("chatId", chatId).single()) as { data: unknown; error: unknown };
        if (error || !data) {
            this.context.logger.error("No chat found", { chatId });
        } else {
            this.context.logger.info("Successfully fetched chat", { chatId });
        }

        return data;
    }

    async getChatByChatName(chatName: string) {
        const { data, error } = (await this.supabase.from("chats").select("*").eq("chatName", chatName).single()) as { data: unknown; error: unknown };
        if (error || !data) {
            this.context.logger.error("No chat found", { chatName });
        } else {
            this.context.logger.info("Successfully fetched chat", { chatName });
        }

        return data;
    }

    async getChatByTaskNodeId(taskNodeId: string) {
        try {
            const { data, error } = await this.supabase.from("chats").select("*").eq("taskNodeId", taskNodeId).single()
            if (error || !data) {
                this.context.logger.error("No chat found", { taskNodeId });
            } else {
                this.context.logger.info("Successfully fetched chat", { taskNodeId });
            }

            return data;
        } catch (e) {
            console.error(e)
            throw new Error("Failed to fetch chat by task node id")
        }

    }
}