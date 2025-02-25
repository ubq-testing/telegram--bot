import { Context } from "../../types";
import { CallbackResult } from "../../types/proxy";
import { MtProtoHelper } from "../bot/mtproto-helpers";

export async function createChat(context: Context<"issues.assigned">): Promise<CallbackResult> {
  const { payload, logger } = context;

  const chatName = "@" + payload.repository.full_name + "#" + payload.issue.number;

  if (chatName.includes("devpool-directory")) {
    logger.info("Skipping chat creation (reason: devpool-directory is ignored).");
    return { status: 200, reason: "skipped" };
  }

  const chatExists = await context.adapters.storage.retrieveChatByTaskNodeId(payload.issue.node_id);

  if (chatExists) {
    logger.info("Chat already exists for this issue.");
    return { status: 200, reason: "chat_exists" };
  }

  logger.info(`Will attempt to create a new chat room '${chatName}'...`);
  const mtProtoHelper = new MtProtoHelper(context);
  await mtProtoHelper.initialize();

  try {
    const chat = await mtProtoHelper.createChat(chatName);
    const { chatId: chatIdJsNumber, chatIdBigInt, inviteLink } = await mtProtoHelper.createChatInviteLink(chat);
    await mtProtoHelper.postChatInviteLinkToIssue(payload, chatIdBigInt, inviteLink, chatName);
    await context.adapters.storage.handleChat({
      action: "create",
      chat: {
        chat_id: chatIdJsNumber,
        chat_name: chatName,
        task_node_id: payload.issue.node_id,
        user_ids: [],
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        status: "open",
      },
    });
    return { status: 200, reason: "chat_created" };
  } catch (er) {
    logger.error("Error in creating chat: ", { er });
    return { status: 500, reason: "chat_create_failed", content: { error: er } };
  }
}
