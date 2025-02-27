import { Api } from "telegram";
import bigInt from "big-integer";
import { Context } from "../../types";
import { CallbackResult } from "../../types/proxy";
import { GithubStorage } from "../../adapters/github/storage-layer";
import { SupabaseStorage } from "../../adapters/supabase/supabase";
import { Chat } from "../../types/storage";
import { MtProtoHelper } from "../bot/mtproto-helpers";

export async function closeChat(context: Context<"issues.closed">): Promise<CallbackResult> {
  const {
    payload,
    adapters: { storage },
    logger,
  } = context;
  if (payload.repository.full_name.includes("devpool-directory")) {
    return { status: 200, reason: "skipped" };
  }

  const mtProtoHelper = new MtProtoHelper(context);
  await mtProtoHelper.initialize();
  const dbChat = await storage.retrieveChatByTaskNodeId(payload.issue.node_id);
  if (!dbChat) {
    logger.error("Attempted to close a workroom not found in the database.", { chatName: payload.issue.title });
    return { status: 200, reason: "chat_not_found" };
  }

  logger.info("Chat found: ", { dbChat });

  const chatParticipants = await mtProtoHelper.getChatParticipants(dbChat);

  await mtProtoHelper.updateChatArchiveStatus({ archive: true, dbChat });
  await notifyAndRemoveFromArchivedChat({ mtProtoHelper, chatParticipants, dbChat, storage, context });

  await storage.handleChat({ action: "close", chat: dbChat });
  return { status: 200, reason: "chat_closed" };
}

async function notifyAndRemoveFromArchivedChat({
  mtProtoHelper,
  chatParticipants,
  dbChat,
  storage,
  context,
}: {
  mtProtoHelper: MtProtoHelper;
  chatParticipants: Api.TypeChatParticipants;
  dbChat: Chat;
  storage: GithubStorage | SupabaseStorage;
  context: Context<"issues.closed">;
}) {
  if (chatParticipants.className === "ChatParticipants") {
    await mtProtoHelper.sendMessageToChat(dbChat, "This task has been closed and this chat has been archived.");
    const participants = chatParticipants.participants;
    const creatorId = (await mtProtoHelper.getChatCreatorFromParticipants(participants)).userId;
    const userIds = participants.map((participant) => participant.userId).filter((id) => id != undefined);

    if (!userIds.includes(creatorId)) {
      userIds.push(creatorId);
    }

    await storage.userSnapshot(
      dbChat.chat_id,
      userIds.map((id) => id.toJSNumber())
    );

    const mtProtoClient = mtProtoHelper.getMtProtoClient();
    const mtProtoApi = mtProtoHelper.getMtProtoApi();

    let generator = deleteChatUsers({
      mtProtoClient,
      api: mtProtoApi,
      userIds,
      context,
      chatInputEntity: await mtProtoClient.getInputEntity(dbChat.chat_id),
    });

    let result = await generator.next();
    const chatInputEntity = await mtProtoClient.getInputEntity(dbChat.chat_id);

    while (!result.done) {
      if (!result.value.success) {
        const seconds = result.value.error?.seconds ?? 300;
        context.logger.info("Retrying...", { seconds, er: result.value.error });
        await intervalLogger(seconds, 60, context.logger, new Promise((resolve) => setTimeout(resolve, seconds * 1000)));
        generator = deleteChatUsers({ mtProtoClient, api: mtProtoApi, userIds: userIds.slice(result.value.index), context, chatInputEntity });
      }
      result = await generator.next();
    }
  }
}

async function* deleteChatUsers({
  mtProtoClient,
  api,
  userIds,
  context,
  chatInputEntity,
}: {
  mtProtoClient: MtProtoHelper["_client"];
  api: MtProtoHelper["_api"];
  userIds: bigInt.BigInteger[];
  context: Context;
  chatInputEntity: Api.TypeInputPeer;
}): AsyncGenerator<{ success: boolean; index: number; error?: { errorMessage: string; seconds: number } }> {
  for (let i = 0; i < userIds.length; i++) {
    // don't kick our friendly bot
    if (userIds[i].toJSNumber() === context.config.botId) {
      continue;
    }

    try {
      await mtProtoClient.invoke(
        new api.messages.DeleteChatUser({
          revokeHistory: false,
          chatId: chatInputEntity.className === "InputPeerChat" ? chatInputEntity.chatId : undefined,
          userId: userIds[i],
        })
      );
      yield { success: true, index: i };
    } catch (error) {
      yield { success: false, index: i, error } as { success: false; index: number; error: { errorMessage: string; seconds: number } };
    }
  }
}

// Gives feedback while we wait for the FLOOD error to expire
async function intervalLogger(seconds: number, interval: number, logger: Context["logger"], promise: Promise<void>) {
  let timeLeft = seconds;
  const intervalId = setInterval(() => {
    timeLeft -= interval;
    logger.info(`Retrying in ${timeLeft} seconds...`);
  }, interval * 1000);

  // by this point the initial promise has resolved, this is a formality
  // as without it this function will not be async
  await promise;
  clearInterval(intervalId);
}
