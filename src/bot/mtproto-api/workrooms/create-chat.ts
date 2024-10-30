import { Context, SupportedEvents } from "../../../types";
import { CallbackResult } from "../../../types/proxy";
import { addCommentToIssue } from "../../../utils/add-comment-to-issues";
import { MtProto } from "../bot/mtproto";
import bigInt from "big-integer";

export async function createChat(context: Context<"issues.assigned", SupportedEvents["issues.assigned"]>): Promise<CallbackResult> {
  const { payload, config, logger } = context;
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
  const mtProto = new MtProto(context);
  await mtProto.initialize();
  let chatId: number;
  let chatIdBigInt: bigInt.BigInteger;
  logger.info("Creating chat with name: ", { chatName });

  try {
    await mtProto.client.getDialogs();
    const botIdString = await mtProto.client.getPeerId(config.botId, true);
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

        await addCommentToIssue(
          context,
          logger.ok(`A new workroom has been created for this task. [Join chat](${link})`).logMessage.raw,
          owner,
          repo,
          payload.issue.number
        );
      } else {
        throw new Error(logger.error(`Failed to create chat invite link for the workroom: ${chatName}`).logMessage.raw);
      }

      // edit chat description
      try {
        await mtProto.client.invoke(
          new mtProto.api.messages.EditChatAbout({
            peer: new mtProto.api.InputPeerChat({ chatId: chatIdBigInt }),
            about: `${payload.issue.html_url}`,
          })
        );
      } catch (er) {
        logger.error("Error in editing chat description: ", { er });
        return { status: 500, reason: "chat_create_failed", content: { error: er } };
      }

      const isBotPromotedToAdmin = await mtProto.client.invoke(
        new mtProto.api.messages.EditChatAdmin({
          chatId: chatIdBigInt,
          isAdmin: true,
          userId: botIdString,
        })
      );

      if (!isBotPromotedToAdmin) {
        throw new Error("Failed to promote bot to admin");
      }
    }
  } catch (er) {
    logger.error("Error in creating chat: ", { er });
    return { status: 500, reason: "chat_create_failed", content: { error: er } };
  }

  await context.adapters.storage.handleChat({
    action: "create",
    chat: {
      chat_id: chatId,
      chat_name: chatName,
      task_node_id: payload.issue.node_id,
      user_ids: [],
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
      status: "open",
    },
  });
  return { status: 200, reason: "chat_created" };
}
