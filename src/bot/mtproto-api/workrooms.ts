import { Context, SupportedEvents } from "#root/types/context";
import { CallbackResult } from "#root/types/proxy.js";
import { MtProto } from "./bot/mtproto";

export async function createChat(context: Context<"issues.labeled", SupportedEvents["issues.labeled"]>): Promise<CallbackResult> {
    try {
        const { payload, env, config } = context;
        const chatName = payload.issue.title;

        const mtProto = new MtProto(context);
        await mtProto.initialize();

        context.logger.info("Creating chat with name: ", { chatName });

        const chat = await mtProto.client.invoke(
            new mtProto.api.messages.CreateChat({
                title: chatName,
                users: [],
            })
        );

        console.log("Chat created: ", chat.updates.chats);

        console.log("Chat ID created: ", chat.updates.chats[0].id);

        /**
         * updates: {
    CONSTRUCTOR_ID: 1957577280,
    SUBCLASS_OF_ID: 2331323052,
    className: 'Updates',
    classType: 'constructor',
    updates: [ [Object], [Object], [Object], [Object] ],
    users: [ [Object] ],
    chats: [ [Object] ],
    date: 1725806466,
    seq: 0
  },
         */

        // await context.adapters.supabase.chats.saveChat(chatId, payload.issue.title, payload.issue.node_id);

        return { status: 200, reason: "chat_created" };
    } catch (er) {
        context.logger.error("Failed to create chat", { er });
        return { status: 500, reason: "chat_creation_failed", content: { error: er } };
    }
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

        let chatParticipants;

        if ("participants" in fetchChat.fullChat) {
            chatParticipants = fetchChat.fullChat.participants;
        } else {
            throw new Error("Failed to fetch chat participants");
        }

        if (chatParticipants.className === "ChatParticipantsForbidden") {
            console.log("ChatParticipantsForbidden");
        }

        if (chatParticipants.className === "ChatParticipants") {
            const userIDs = chatParticipants.participants.map((participant) => {
                return participant.userId;
            });

            for (let i = 0; i < userIDs.length; i++) {
                if (userIDs[i].toJSNumber() === context.config.botId) {
                    continue;
                }
                await mtProto.client.invoke(
                    new mtProto.api.messages.DeleteChatUser({
                        chatId: chat.chatId,
                        userId: userIDs[i],
                    })
                );
            }
        }

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
