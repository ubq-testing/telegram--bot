import { Context, SupportedEvents } from "#root/types/context";
import { CallbackResult } from "#root/types/proxy.js";
import { MtProto } from "./bot/mtproto";
import { Api } from "telegram";
import { addCommentToIssue } from "#root/helpers/add-comment-to-issues.js";

function isPriceLabelChange(label: string): boolean {
    return label.toLowerCase().includes("price");
}

export async function createChat(context: Context<"issues.labeled", SupportedEvents["issues.labeled"]>): Promise<CallbackResult> {
    const { payload, config, logger } = context;
    const chatName = payload.issue.title;

    const labelName = payload.label?.name;

    if (!labelName || !isPriceLabelChange(labelName)) {
        return { status: 200, reason: "skipped" };
    }

    const mtProto = new MtProto(context);
    await mtProto.initialize();
    let chatId: number;
    logger.info("Creating chat with name: ", { chatName });

    try {
        const botIdString = await mtProto.client.getPeerId(config.botUsername, true);

        const chat = await mtProto.client.invoke(
            new mtProto.api.messages.CreateChat({
                title: chatName,
                users: [botIdString],
            })
        );
        let inviteLink;

        if ("chats" in chat.updates) {
            chatId = chat.updates.chats[0].id.toJSNumber();
        } else {
            throw new Error("Failed to create chat");
        }

        if (chat.updates.chats[0].className === "Chat") {
            inviteLink = await mtProto.client.invoke(
                new mtProto.api.messages.ExportChatInvite({
                    peer: new mtProto.api.InputPeerChat({ chatId: chat.updates.chats[0].id }),
                })
            );
        }

        if (inviteLink) {
            const [owner, repo] = payload.repository.full_name.split("/");
            let link;

            if ("link" in inviteLink) {
                link = inviteLink.link;
            }

            await addCommentToIssue(context, `A new workroom has been created for this task. [Join chat](${link})`, owner, repo, payload.issue.number);
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
        logger.error("Error in creating chat: ", { er });
        return { status: 500, reason: "chat_create_failed", content: { error: er } };
    }

    await context.adapters.supabase.chats.saveChat(chatId, payload.issue.title, payload.issue.node_id);
    return { status: 200, reason: "chat_created" };
}

export async function closeChat(context: Context<"issues.closed", SupportedEvents["issues.closed"]>): Promise<CallbackResult> {
    const { payload, adapters: { supabase: { chats } }, logger } = context;
    try {
        const mtProto = new MtProto(context);
        await mtProto.initialize();

        logger.info("Closing chat with name: ", { chatName: payload.issue.title });
        const chat = await chats.getChatByTaskNodeId(payload.issue.node_id);

        const fetchChat = await mtProto.client.invoke(
            new mtProto.api.messages.GetFullChat({
                chatId: chat.chatId,
            })
        );

        if (!fetchChat) {
            throw new Error("Failed to fetch chat");
        }

        let chatParticipants;

        if ("participants" in fetchChat.fullChat) {
            chatParticipants = fetchChat.fullChat.participants;
        } else {
            throw new Error("Failed to fetch chat participants");
        }


        if (chatParticipants.className === "ChatParticipants") {

            await mtProto.client.invoke(
                new mtProto.api.messages.SendMessage({
                    message: "This task has been closed and this chat has been archived.",
                    peer: new mtProto.api.InputPeerChat({ chatId: chat.chatId }),
                })
            );

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

        await chats.updateChatStatus("closed", payload.issue.node_id);

        return { status: 200, reason: "chat_closed" };
    } catch (er) {
        logger.error("Failed to close chat", { er });
        return { status: 500, reason: "chat_close_failed", content: { error: er } };
    }
}

export async function reopenChat(context: Context<"issues.reopened", SupportedEvents["issues.reopened"]>): Promise<CallbackResult> {
    const { payload, adapters: { supabase: { chats } }, logger } = context;

    let chatFull: Api.ChatFull;
    let participants: Api.ChatParticipantsForbidden;
    const mtProto = new MtProto(context);
    await mtProto.initialize();

    logger.info("Reopening chat with name: ", { chatName: payload.issue.title });
    const chat = await chats.getChatByTaskNodeId(payload.issue.node_id);

    const fetchChat = await mtProto.client.invoke(
        new mtProto.api.messages.GetFullChat({
            chatId: chat.chatId,
        })
    );

    if (!fetchChat) {
        throw new Error("Failed to fetch chat");
    }

    chatFull = fetchChat.fullChat as Api.ChatFull
    participants = chatFull.participants as Api.ChatParticipantsForbidden;

    let chatId, peer, editDefaultBanRights;
    try {
        chatId = fetchChat.fullChat.id;
        peer = new mtProto.api.InputPeerChat({ chatId });
    } catch (er) {
        console.error("chatId-peer error", er);
        throw new Error("Failed to get chatId-peer");
    }

    /**
     *     editDefaultBanRights = await mtProto.client.invoke(
        new mtProto.api.messages.EditChatDefaultBannedRights({
            bannedRights: new mtProto.api.ChatBannedRights({
                viewMessages: false,
                sendMessages: false,
                sendMedia: false,
                sendStickers: false,
                sendGifs: false,
                sendGames: true,
                sendInline: false,
                embedLinks: false,
                sendPolls: false,
                changeInfo: true,
                inviteUsers: false,
                pinMessages: true,
                untilDate: 0, // forever
            }),
            peer: await mtProto.client.getEntity(participants.selfParticipant?.userId),
        })
    );

     */

    try {

        const chatCreator = participants.selfParticipant?.userId;

        if (!chatCreator) {
            throw new Error("Failed to get chat creator");
        }

        await mtProto.client.invoke(
            new mtProto.api.messages.EditChatAdmin({
                chatId,
                isAdmin: true,
                userId: chatCreator,
            })
        );

        await mtProto.client.invoke(
            new mtProto.api.messages.AddChatUser({
                chatId: chat.chatId,
                userId: participants.selfParticipant?.userId,
                fwdLimit: 50,
            })
        );
        return { status: 200, reason: "chat_reopened" };
    } catch (er) {
        console.log(er);
        logger.error("Failed to reopen chat", { er });
        return { status: 500, reason: "chat_reopen_failed", content: { error: er } };
    }

}
