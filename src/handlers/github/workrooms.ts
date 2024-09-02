import { Chat } from "#root/adapters/supabase/helpers/chats.js";
import { TelegramBotSingleton } from "#root/utils/telegram-bot-single.js";
import { Context, SupportedEvents } from "../../types";
import { CallbackResult } from "../callbacks-proxy";
import { addCommentToIssue } from "./utils/add-comment-to-issues";

export async function createChatroom(context: Context<"issues.labeled", SupportedEvents["issues.labeled"]>): Promise<CallbackResult> {
    const { logger, config, adapters: { supabase: { chats } } } = context;
    const bot = TelegramBotSingleton.getInstance().getBot();
    const title = context.payload.issue.title
    const { issue, repository } = context.payload;
    const { full_name } = repository;
    const [owner, repo] = full_name.split("/");

    const chatroom = await chats.getChatByTaskNodeId(issue.node_id);

    if (chatroom) {
        return { status: 404, reason: "chatroom_already_exists" };
    }

    logger.info(`Creating chatroom for issue ${title}`);

    try {
        const forum = await bot.api?.createForumTopic(config.supergroupChatId, title);
        await addCommentToIssue(context, `Workroom created: https://t.me/${config.supergroupChatName}/${forum?.message_thread_id}`, owner, repo, issue.number);

        await chats.saveChat(forum?.message_thread_id, title, issue.node_id);

        return { status: 201, reason: "chatroom_created" };
    } catch (er) {
        await addCommentToIssue(context, logger.error(`Failed to create chatroom for issue ${title}`, { er }).logMessage.diff, owner, repo, issue.number);
        return { status: 500, reason: "chatroom_creation_failed" };
    }

}

export async function closeChatroom(context: Context<"issues.closed", SupportedEvents["issues.closed"]>): Promise<CallbackResult> {
    const { logger, config, adapters: { supabase: { chats } } } = context;
    const bot = TelegramBotSingleton.getInstance().getBot();
    const title = context.payload.issue.title
    const { issue, repository } = context.payload;
    const { full_name } = repository;
    const [owner, repo] = full_name.split("/");

    logger.info(`Closing chatroom for issue ${title}`);

    const chatroom = await chats.getChatByTaskNodeId(issue.node_id) as Chat

    if (!chatroom) {
        return { status: 404, reason: "chatroom_not_found" };
    }

    try {
        await bot.api?.closeForumTopic(config.supergroupChatId, chatroom.chatId);
        await chats.updateChatStatus("closed", issue.node_id);
        await addCommentToIssue(context, `Workroom closed for issue ${title}`, owner, repo, issue.number);
        return { status: 200, reason: "chatroom_closed" };
    } catch (er) {
        await addCommentToIssue(context, logger.error(`Failed to close chatroom for issue ${title}`, { er }).logMessage.diff, owner, repo, issue.number);
        return { status: 500, reason: "chatroom_closing_failed" };
    }
}

