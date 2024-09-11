import { Context, SupportedEvents } from "#root/types/context";
import { CallbackResult } from "#root/types/proxy.js";
import { MtProto } from "../bot/mtproto";
import { addCommentToIssue } from "#root/utils/add-comment-to-issues.js";
import bigInt from "big-integer";

export async function createChat(context: Context<"issues.labeled", SupportedEvents["issues.labeled"]>): Promise<CallbackResult> {
  const { payload, config, logger } = context;
  const chatName = "@" + payload.repository.full_name + "#" + payload.issue.number;

  const labelName = payload.label?.name;

  if (!labelName?.toLowerCase().includes("price")) {
    return { status: 200, reason: "skipped" };
  }

  const mtProto = new MtProto(context);
  await mtProto.initialize();
  let chatId: number;
  let chatIdBigInt: bigInt.BigInteger;
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

    const isPromoted = await mtProto.client.invoke(
      new mtProto.api.messages.EditChatAdmin({
        chatId: chatIdBigInt,
        isAdmin: true,
        userId: botIdString,
      })
    );

    if (!isPromoted) {
      throw new Error("Failed to promote bot to admin");
    }
  } catch (er) {
    logger.error("Error in creating chat: ", { er });
    return { status: 500, reason: "chat_create_failed", content: { error: er } };
  }

  await context.adapters.supabase.chats.saveChat(chatId, payload.issue.title, payload.issue.node_id);
  return { status: 200, reason: "chat_created" };
}
