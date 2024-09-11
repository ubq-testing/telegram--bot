import { Context, SupportedEvents } from "#root/types/context";
import { CallbackResult } from "#root/types/proxy.js";
import { MtProto } from "./bot/mtproto";
import { Api } from "telegram";
import { addCommentToIssue } from "#root/helpers/add-comment-to-issues.js";
import bigInt from "big-integer";

function isPriceLabelChange(label: string): boolean {
    return label.toLowerCase().includes("price");
}

export async function createChat(context: Context<"issues.labeled", SupportedEvents["issues.labeled"]>): Promise<CallbackResult> {
    const { payload, config, logger } = context;
    const chatName = "@" + payload.repository.full_name + "#" + payload.issue.number;

    const labelName = payload.label?.name;

    if (!labelName || !isPriceLabelChange(labelName)) {
        return { status: 200, reason: "skipped" };
    }

    const mtProto = new MtProto(context);
    await mtProto.initialize();
    let chatId: number;
    let chatIdBigInt: bigInt.BigInteger = bigInt(0);
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
            chatIdBigInt = chat.updates.chats[0].id;
        } else {
            throw new Error("Failed to create chat");
        }

        if (chat.updates.chats[0].className === "Chat") {
            inviteLink = await mtProto.client.invoke(
                new mtProto.api.messages.ExportChatInvite({
                    peer: new mtProto.api.InputPeerChat({ chatId: chatIdBigInt }),
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
                chatId: chatIdBigInt,
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

    // archive it
    await mtProto.client.invoke(
        new mtProto.api.folders.EditPeerFolders({
            folderPeers: [new mtProto.api.InputFolderPeer({
                peer: new mtProto.api.InputPeerChat({ chatId: chat.chatId }),
                folderId: 1, // 0 is active, 1 is archived
            })],
        })
    );

    try {
        if (chatParticipants.className === "ChatParticipants") {
            await mtProto.client.invoke(
                new mtProto.api.messages.SendMessage({
                    message: "This task has been closed and this chat has been archived.",
                    peer: new mtProto.api.InputPeerChat({ chatId: chat.chatId }),
                })
            );

            const participants = chatParticipants.participants;
            let creatorId;

            const userIDs = participants.map((participant) => {
                if (participant.className === "ChatParticipantCreator") {
                    creatorId = participant.userId;
                    return undefined;
                }
                return participant.userId;
            }).filter((id) => id !== undefined);

            if (!creatorId) {
                throw new Error("Failed to get chat creator");
            }

            userIDs.push(creatorId);
            const chatInput = await mtProto.client.getInputEntity(chat.chatId);

            // await chats.userSnapshot(chat.chatId, userIDs.map((id) => id.toJSNumber()));

            for (let i = 0; i < userIDs.length; i++) {
                if (userIDs[i].toJSNumber() === context.config.botId) {
                    continue;
                }

                await mtProto.client.invoke(
                    new mtProto.api.messages.DeleteChatUser({
                        revokeHistory: false,
                        chatId: chatInput.className === "InputPeerChat" ? chatInput.chatId : undefined,
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

    // unarchive
    try {
        await mtProto.client.invoke(
            new mtProto.api.folders.EditPeerFolders({
                folderPeers: [new mtProto.api.InputFolderPeer({
                    peer: new mtProto.api.InputPeerChat({ chatId: chat.chatId }),
                    folderId: 0,
                })],
            })
        );
    } catch (er) {
        logger.error("Failed to unarchive chat", { er });
        return { status: 500, reason: "chat_unarchive_failed", content: { error: er, function: reopenChat } };
    }

    chatFull = fetchChat.fullChat as Api.ChatFull
    participants = chatFull.participants as Api.ChatParticipantsForbidden;

    const chatCreator = participants.selfParticipant?.userId;
    if (!chatCreator) {
        throw new Error("Failed to get chat creator");
    }

    await mtProto.client.invoke(
        new mtProto.api.messages.AddChatUser({
            chatId: chat.chatId,
            userId: chatCreator,
            fwdLimit: 50,
        })
    );



    await chats.updateChatStatus("reopened", payload.issue.node_id);
    const users = await chats.getChatUsers(chat.chatId);
    if (!users) {
        throw new Error("Failed to get chat users");
    }

    const { userIds } = users;
    const chatInput = await mtProto.client.getInputEntity(chat.chatId);

    for (let i = 0; i < userIds.length; i++) {
        try {
            if (userIds[i] === context.config.botId || userIds[i] === chatCreator.toJSNumber()) {
                continue;
            }

            await mtProto.client.invoke(
                new mtProto.api.messages.AddChatUser({
                    chatId: chatInput.className === "InputPeerChat" ? chatInput.chatId : undefined,
                    userId: userIds[i],
                    fwdLimit: 50,
                })
            );
        } catch (er) {
            logger.error("Failed to add chat users", { er });
        }
    }

    await mtProto.client.invoke(
        new mtProto.api.messages.SendMessage({
            message: "This task has been reopened and this chat has been unarchived.",
            peer: new mtProto.api.InputPeerChat({ chatId: chat.chatId }),
        })
    );
    return { status: 200, reason: "chat_reopened" };
}
