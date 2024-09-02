import { Chat } from "#root/adapters/supabase/helpers/chats.js";
import { TelegramBotSingleton } from "#root/utils/telegram-bot-single.js";
import { Context, SupportedEvents } from "../../types";
import { CallbackResult } from "../callbacks-proxy";
import { addCommentToIssue } from "./utils/add-comment-to-issues";

/**
 * V1 specifications for the `createChatroom` feature.
 * 
 * - A "workroom" (chatroom) is created when an issue is labeled.
 * - The chatroom is created in a Telegram supergroup as a forum topic, not a new group.
 * - The chatroom is associated with the issue by storing the issue's node_id.
 * - The chatroom is closed when the issue is closed.
 * - The chatroom is closed by closing the forum topic in the supergroup.
 * - The chatroom status is updated to "closed" in the database.
 * - A comment is added to the issue when the chatroom is created or closed.
 */

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

export async function reOpenChatroom(context: Context<"issues.reopened", SupportedEvents["issues.reopened"]>): Promise<CallbackResult> {
    const { config, logger, adapters: { supabase: { chats } } } = context;
    const bot = TelegramBotSingleton.getInstance().getBot();
    const title = context.payload.issue.title
    const { issue, repository } = context.payload;
    const { full_name } = repository;
    const [owner, repo] = full_name.split("/");

    logger.info(`Reopening chatroom for issue ${title}`);

    const chatroom = await chats.getChatByTaskNodeId(issue.node_id) as Chat

    if (!chatroom) {
        return { status: 404, reason: "chatroom_not_found" };
    }

    try {
        await bot.api?.reopenForumTopic(config.supergroupChatId, chatroom.chatId);
        await chats.updateChatStatus("open", issue.node_id);
        await addCommentToIssue(context, `Workroom reopened for issue ${title}`, owner, repo, issue.number);
        return { status: 200, reason: "chatroom_reopened" };
    } catch (er) {
        await addCommentToIssue(context, logger.error(`Failed to reopen chatroom for issue ${title}`, { er }).logMessage.diff, owner, repo, issue.number);
        return { status: 500, reason: "chatroom_reopening_failed" };
    }
}
