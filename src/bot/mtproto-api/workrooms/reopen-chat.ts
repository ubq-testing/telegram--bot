import { Context, SupportedEvents } from "#root/types/context";
import { CallbackResult } from "#root/types/proxy.js";
import { MtProto } from "../bot/mtproto";
import { Api } from "telegram";

export async function reopenChat(context: Context<"issues.reopened", SupportedEvents["issues.reopened"]>): Promise<CallbackResult> {
  const {
    payload,
    adapters: {
      supabase: { chats },
    },
    logger,
  } = context;

  const mtProto = new MtProto(context);
  await mtProto.initialize();

  logger.info("Reopening chat with name: ", { chatName: payload.issue.title });
  const chat = await chats.getChatByTaskNodeId(payload.issue.node_id);

  const fetchedChat = await mtProto.client.invoke(
    new mtProto.api.messages.GetFullChat({
      chatId: chat.chatId,
    })
  );

  if (!fetchedChat) {
    throw new Error("Failed to fetch chat");
  }

  // unarchive
  await mtProto.client.invoke(
    new mtProto.api.folders.EditPeerFolders({
      folderPeers: [
        new mtProto.api.InputFolderPeer({
          peer: new mtProto.api.InputPeerChat({ chatId: chat.chatId }),
          folderId: 0,
        }),
      ],
    })
  );

  const chatFull = fetchedChat.fullChat as Api.ChatFull;
  const participants = chatFull.participants as Api.ChatParticipantsForbidden;

  const chatCreator = participants.selfParticipant?.userId;
  if (!chatCreator) {
    throw new Error("Failed to get chat creator");
  }

  // add the creator back to obtain control of the chat
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

  const { user_ids: userIds } = users;
  const chatInput = await mtProto.client.getInputEntity(chat.chatId);

  for (const userId of userIds) {
    /**
     * Dialogs are all of the chats, channels, and users that the account has interacted with.
     * By obtaining the dialogs, we guarantee our client (that's what we are considered to be by the MTProto API)
     * has up to date context otherwise these operations seem to fail. 
     * 
     * There is likely a better way to handle this, but this works for now.
     */
    await mtProto.client.getDialogs();
    try {
      // don't add the bot or the chat creator, as they are already in the chat
      if (userId === context.config.botId || userId === chatCreator) {
        continue;
      }

      await mtProto.client.invoke(
        new mtProto.api.messages.AddChatUser({
          chatId: chatInput.className === "InputPeerChat" ? chatInput.chatId : undefined,
          userId: userId,
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
