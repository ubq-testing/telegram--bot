import { Context, SupportedEvents } from "#root/types/context";
import { CallbackResult } from "#root/types/proxy.js";
import bigInt from "big-integer";
import { MtProto } from "./bot/mtproto";

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
    let chatIdBigInt: bigInt.BigInteger;

    context.logger.info("Creating chat with name: ", { chatName });
    try {
        const chat = await mtProto.client.invoke(
            new mtProto.api.messages.CreateChat({
                title: chatName,
                users: [],
            })
        );

        const channel = await mtProto.client.invoke(
            new mtProto.api.channels.CreateChannel({
                title: chatName,
                broadcast: false,
                about: payload.issue.body || `- ${labelName} - ${payload.issue.html_url}`,
            })
        );

        if ("id" in channel) {
            chatId = channel.id
        } else {
            throw new Error("Failed to create channel");
        }

        await context.adapters.supabase.chats.saveChat(chatId, "channel - " + payload.issue.title, payload.issue.node_id);

        const contacts = await mtProto.client.invoke(
            new mtProto.api.contacts.GetContacts({ hash: undefined }),
        );

        let user;

        if ("users" in contacts) {
            user = contacts.users.find((user) => user.id.toJSNumber() === config.botId);
            if (!user) {
                throw new Error("Bot not found in contacts");
            }
        } else {
            throw new Error("Failed to fetch contacts");
        }

        let accessHash;

        if ("accessHash" in user) {
            accessHash = user.accessHash;
        }

        if (!accessHash) {
            throw new Error("Failed to fetch access hash");
        }

        let channelAccessHash;
        let channelIdBigInt;

        const chats = await mtProto.client.invoke(
            new mtProto.api.messages.GetChats({ id: undefined }),
        );

        if ("chats" in chats) {
            const foundChannel = chats.chats.find((chat) => chat.id.toJSNumber() === channel.id)
            if (!foundChannel) {
                throw new Error("Channel not found");
            }

            if ("accessHash" in foundChannel) {
                channelAccessHash = foundChannel.accessHash;
            }

            if ("id" in foundChannel) {
                channelIdBigInt = foundChannel.id;
            }
        }

        if (!channelAccessHash) {
            throw new Error("Failed to fetch channel access hash");
        }

        if (!channelIdBigInt) {
            throw new Error("Failed to fetch channel id");
        }

        await mtProto.client.invoke(
            new mtProto.api.channels.InviteToChannel({
                channel: new mtProto.api.InputChannel({ channelId: channelIdBigInt, accessHash: channelAccessHash }),
                users: [new mtProto.api.InputUser({ userId: user.id, accessHash })],
            })
        );


        if ("chats" in chat.updates) {
            chatId = chat.updates.chats[0].id.toJSNumber();
            chatIdBigInt = chat.updates.chats[0].id;
        } else {
            throw new Error("Failed to create chat");
        }

        await context.adapters.supabase.chats.saveChat(chatId, payload.issue.title, payload.issue.node_id);
    } catch (er) {
        context.logger.error("Failed to create chat", { er });
        return { status: 500, reason: "chat_create_failed", content: { error: er } };
    }

    try {
        await mtProto.client.invoke(
            new mtProto.api.messages.AddChatUser({
                chatId: chatIdBigInt,
                userId: new mtProto.api.PeerUser({ userId: bigInt(context.config.botId) }),
                fwdLimit: 1,
            })
        );
    } catch (er) {
        console.log(`Failed to add bot to chat: `, er);
        throw new Error("Failed to add bot to chat");
    }

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
