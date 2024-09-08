import { Context, SupportedEvents } from "#root/types/context";
import { CallbackResult } from "#root/types/proxy.js";
import bigInt from "big-integer";
import { MtProto } from "./bot/mtproto";
import { Api } from "telegram";

function isPriceLabelChange(label: string): boolean {
    return label.toLowerCase().includes("price");
}

export async function createChat(context: Context<"issues.labeled", SupportedEvents["issues.labeled"]>): Promise<CallbackResult> {
    const { payload, config, env } = context;
    const chatName = payload.issue.title;

    const labelName = payload.label?.name;

    if (!labelName || !isPriceLabelChange(labelName)) {
        return { status: 200, reason: "skipped" };
    }

    const mtProto = new MtProto(context);
    await mtProto.initialize();
    let chatId: number;
    context.logger.info("Creating chat with name: ", { chatName });

    try {
        const botIdString = await mtProto.client.getPeerId(config.botUsername, true);

        const chat = await mtProto.client.invoke(
            new mtProto.api.messages.CreateChat({
                title: chatName,
                users: [botIdString],
            })
        );

        if ("chats" in chat.updates) {
            chatId = chat.updates.chats[0].id.toJSNumber();
        } else {
            throw new Error("Failed to create chat");
        }

        const promoteBotToAdmin = await mtProto.client.invoke(
            new mtProto.api.messages.EditChatAdmin({
                chatId: chat.updates.chats[0].id,
                isAdmin: true,
                userId: botIdString,
            })
        );

        if (!promoteBotToAdmin) {
            throw new Error("Failed to promote bot to admin");
        }

    } catch (er) {
        console.log("Error in creating chat: ", er);
        return { status: 500, reason: "chat_create_failed", content: { error: er } };
    }

    await context.adapters.supabase.chats.saveChat(chatId, payload.issue.title, payload.issue.node_id);
    return { status: 200, reason: "chat_created" };
}

export async function closeChat(context: Context<"issues.closed", SupportedEvents["issues.closed"]>): Promise<CallbackResult> {
    try {
        const { payload, adapters: { supabase: { chats } } } = context;

        const mtProto = new MtProto(context);
        await mtProto.initialize();

        context.logger.info("Closing chat with name: ", { chatName: payload.issue.title });
        const chat = await chats.getChatByTaskNodeId(payload.issue.node_id);

        const fetchChat = await mtProto.client.invoke(
            new mtProto.api.messages.GetFullChat({
                chatId: chat.chatId,
            })
        );

        if (!fetchChat) {
            throw new Error("Failed to fetch chat");
        }

        const chatFull = fetchChat.fullChat as Api.ChatFull
        const participants = chatFull.participants as Api.ChatParticipants;

        for (const participant of participants.participants) {
            if (participant instanceof mtProto.api.ChatParticipant) {
                await mtProto.client.invoke(
                    new mtProto.api.messages.DeleteChatUser({
                        chatId: chat.chatId,
                        userId: participant.userId,
                    })
                );
            }
        }

        // delete all users from chat
        await mtProto.client.invoke(
            new mtProto.api.messages.DeleteChatUser({
                chatId: chat.chatId,
                userId: bigInt(0),
            })
        );

        await mtProto.client.invoke(
            new mtProto.api.messages.SendMessage({
                message: "This task has been closed and this chat has been archived.",
                peer: new mtProto.api.InputPeerChat({ chatId: chat.chatId }),
            })
        );

        return { status: 200, reason: "chat_closed" };
    } catch (er) {
        context.logger.error("Failed to close chat", { er });
        return { status: 500, reason: "chat_close_failed", content: { error: er } };
    }
}

export async function reopenChat(context: Context<"issues.reopened", SupportedEvents["issues.reopened"]>): Promise<CallbackResult> {
    try {
        const { payload, env, adapters: { supabase: { chats } } } = context;

        const mtProto = new MtProto(context);
        await mtProto.initialize();


        /**
         * TODO: Are we re-opening the old chat or creating a new one?
         */

        return { status: 200, reason: "chat_reopened" };
    } catch (er) {
        context.logger.error("Failed to reopen chat", { er });
        return { status: 500, reason: "chat_reopen_failed", content: { error: er } };
    }
}
