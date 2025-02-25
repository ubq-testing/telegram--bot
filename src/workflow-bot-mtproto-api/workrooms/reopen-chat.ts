import bigInt from "big-integer";
import { Context } from "../../types";
import { CallbackResult } from "../../types/proxy";
import { MtProtoWrapper } from "../bot/mtproto-wrapper";
import { Api } from "telegram";
import { Chat } from "../../types/storage";

export async function reopenChat(context: Context<"issues.reopened">): Promise<CallbackResult> {
  const {
    payload,
    adapters: { storage },
    logger,
  } = context;

  if (payload.repository.full_name.includes("devpool-directory")) {
    return { status: 200, reason: "skipped" };
  }

  const mtProtoWrapper = new MtProtoWrapper(context);
  const { client } = await mtProtoWrapper.initialize();

  logger.info("Reopening chat with name: ", { chatName: payload.issue.title });
  const dbChat = await storage.retrieveChatByTaskNodeId(payload.issue.node_id);

  if (!dbChat) {
    logger.error("Chat not found in database", { chatName: payload.issue.title });
    return { status: 200, reason: "chat_not_found" };
  }

  const { chatCreatorId, chatIdBigInt } = await fetchChatAndAddCreator(mtProtoWrapper, dbChat);

  await storage.handleChat({
    action: "reopen",
    chat: dbChat,
  });

  await inviteUsersBackToChat({ client, context, chatIdBigInt, chatCreatorId, mtProtoWrapper, dbChat });

  await mtProtoWrapper.sendMessageToChat(dbChat, "This task has been reopened and this chat has been unarchived.");
  return { status: 200, reason: "chat_reopened" };
}

async function fetchChatAndAddCreator(
  mtProtoWrapper: MtProtoWrapper,
  dbChat: Chat
) {
  const chatIdBigInt = bigInt(dbChat.chat_id);
  const fetchedChat = await mtProtoWrapper.fetchTelegramChat(dbChat);

  if (!fetchedChat) {
    throw new Error("Failed to fetch chat");
  }

  await mtProtoWrapper.updateChatArchiveStatus({ dbChat, archive: false });

  const chatFull = fetchedChat.fullChat as Api.ChatFull;
  const participants = chatFull.participants as Api.ChatParticipantsForbidden;

  const chatCreatorId = participants.selfParticipant?.userId;
  if (!chatCreatorId) {
    throw new Error("Failed to get chat creator");
  }

  // add the creator back to obtain control of the chat
  await mtProtoWrapper.addUserToChat(chatIdBigInt, chatCreatorId.toJSNumber());

  return {
    chatCreatorId,
    chatIdBigInt,
  }
}

async function inviteUsersBackToChat({ client, context, chatIdBigInt, chatCreatorId, mtProtoWrapper, dbChat }: {
  client: MtProtoWrapper["_client"],
  context: Context<"issues.reopened">,
  chatIdBigInt: bigInt.BigInteger,
  chatCreatorId: bigInt.BigInteger,
  mtProtoWrapper: MtProtoWrapper,
  dbChat: Chat,
}) {
  const chatInput = await client.getInputEntity(chatIdBigInt);
  const chatId = chatInput.className === "InputPeerChat" ? chatInput.chatId : null;

  const { user_ids } = dbChat;

  for (const userId of user_ids) {
    try {
      // don't add the bot or the chat creator, as they are already in the chat
      if (userId === context.config.botId || userId === chatCreatorId.toJSNumber()) {
        continue;
      }
      await mtProtoWrapper.addUserToChat(chatId, userId);
    } catch (er) {
      context.logger.error("Failed to add chat users", { er });
    }
  }
}