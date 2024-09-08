import { Chat } from "#root/adapters/supabase/helpers/chats.js";
import { CallbackResult } from "#root/types/proxy.js";
import { TelegramBotSingleton } from "#root/utils/telegram-bot-single.js";
import { Context, SupportedEvents } from "../../types";
import { repositoryDispatch } from "../repository-dispatch";
import { addCommentToIssue } from "../../helpers/add-comment-to-issues";

/**
 * Dispatches a workflow in order to use the MTProto API to create a new chat
 * for the task. 
 */
export async function createWorkroom(context: Context<"issues.labeled", SupportedEvents["issues.labeled"]>): Promise<CallbackResult> {
    await repositoryDispatch(context, "create-telegram-chat").catch(console.error);
    return { status: 200, reason: "workflow_dispatched" };
}

/**
 * "Closes" the workroom by kicking all users from the chat and archiving it.
 * 
 * - Does not delete the chat as it is required for later use.
 * - Does not require MTProto API as we'll use the Bot API to kick users.
 */
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
