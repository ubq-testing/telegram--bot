import { Chat } from "#root/adapters/supabase/helpers/chats.js";
import { CallbackResult } from "#root/types/proxy.js";
import { TelegramBotSingleton } from "#root/utils/telegram-bot-single.js";
import { Context, SupportedEvents } from "../../types";
import { repositoryDispatch } from "../repository-dispatch";
import { addCommentToIssue } from "./utils/add-comment-to-issues";

/**
 * V1 specifications for the `workrooms` feature.
 * 
 * - A workroom is created when an issue is labeled.
 * - The workroom is created in a Telegram supergroup as a forum topic, not a new group.
 * - The workroom is associated with the issue by storing the issue's node_id.
 * - The workroom is closed when the issue is closed.
 * - The workroom status is updated to "closed" in the database.
 * - A comment is added to the issue when the workroom is created or closed.
 * 
 * V2 specifications:
 * 
 * - Replace the `Bot` api with the `MTProto` api in order to create new group chats.
 */

export async function createWorkroom(context: Context<"issues.labeled", SupportedEvents["issues.labeled"]>): Promise<CallbackResult> {
    repositoryDispatch(context, "create-telegram-chat").catch(console.error);
    return { status: 200, reason: "workflow_dispatched" };
}

export async function closeWorkroom(context: Context<"issues.closed", SupportedEvents["issues.closed"]>): Promise<CallbackResult> {
    const { logger, config, adapters: { supabase: { chats } } } = context;
    const bot = TelegramBotSingleton.getInstance().getBot();
    const title = context.payload.issue.title
    const { issue, repository } = context.payload;
    const { full_name } = repository;
    const [owner, repo] = full_name.split("/");

    logger.info(`Closing workroom for issue ${title}`);

    const workroom = await chats.getChatByTaskNodeId(issue.node_id) as Chat

    if (!workroom) {
        return { status: 404, reason: "workroom_not_found" };
    }

    try {
        await bot.api?.closeForumTopic(config.supergroupChatId, workroom.chatId);
        await chats.updateChatStatus("closed", issue.node_id);
        await addCommentToIssue(context, `Workroom closed for issue ${title}`, owner, repo, issue.number);
        return { status: 200, reason: "workroom_closed" };
    } catch (er) {
        await addCommentToIssue(context, logger.error(`Failed to close workroom for issue ${title}`, { er }).logMessage.diff, owner, repo, issue.number);
        return { status: 500, reason: "workroom_closing_failed" };
    }
}

export async function reOpenWorkroom(context: Context<"issues.reopened", SupportedEvents["issues.reopened"]>): Promise<CallbackResult> {
    const { config, logger, adapters: { supabase: { chats } } } = context;
    const bot = TelegramBotSingleton.getInstance().getBot();
    const title = context.payload.issue.title
    const { issue, repository } = context.payload;
    const { full_name } = repository;
    const [owner, repo] = full_name.split("/");

    logger.info(`Reopening workroom for issue ${title}`);

    const workroom = await chats.getChatByTaskNodeId(issue.node_id) as Chat

    if (!workroom) {
        return { status: 404, reason: "workroom_not_found" };
    }

    try {
        await bot.api?.reopenForumTopic(config.supergroupChatId, workroom.chatId);
        await chats.updateChatStatus("reopened", issue.node_id);
        await addCommentToIssue(context, `Workroom reopened for issue ${title}`, owner, repo, issue.number);
        return { status: 200, reason: "workroom_reopened" };
    } catch (er) {
        await addCommentToIssue(context, logger.error(`Failed to reopen workroom for issue ${title}`, { er }).logMessage.diff, owner, repo, issue.number);
        return { status: 500, reason: "workroom_reopening_failed" };
    }
}
