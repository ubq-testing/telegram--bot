import { TelegramBotSingleton } from "#root/utils/telegram-bot-single.js";
import { Context, SupportedEvents } from "../../types";
import { addCommentToIssue } from "./utils/add-comment-to-issues";

export async function createChatroom(context: Context<"issues.labeled", SupportedEvents["issues.labeled"]>) {
    const { logger, config } = context;
    const bot = TelegramBotSingleton.getInstance().getBot();
    const title = context.payload.issue.title
    const { issue, repository } = context.payload;
    const { full_name } = repository;
    const [owner, repo] = full_name.split("/");

    logger.info(`Creating chatroom for issue ${title}`);

    let forum;
    try {
        forum = await bot.api?.createForumTopic(config.supergroupChatId, title);
        bot.on(":forum_topic_created", async (event) => {
            logger.info(`Forum topic created: ${event.update.message?.message_thread_id}`);
            forum = event;
        });
        await addCommentToIssue(context, `Workroom created: https://t.me/${config.supergroupChatName}/${forum?.message_thread_id}`, owner, repo, issue.number);
    } catch (er) {
        await addCommentToIssue(context, logger.error(`Failed to create chatroom for issue ${title}`, { er }).logMessage.diff, owner, repo, issue.number);
    }

    if (!forum) {
        return { status: "failed", reason: "chatroom_creation_failed" };
    } else {
        return { status: "success", content: forum, reason: "chatroom_created" };
    }
}

export async function closeChatroom(context: Context<"issues.closed", SupportedEvents["issues.closed"]>) {
    const { logger, config } = context;
    const bot = TelegramBotSingleton.getInstance().getBot();
    const title = context.payload.issue.title
    const { issue, repository } = context.payload;
    const { full_name } = repository;
    const [owner, repo] = full_name.split("/");

    logger.info(`Closing chatroom for issue ${title}`);

    const id = 11111 // @TODO: Supabase

    try {
        await bot.api?.closeForumTopic(config.supergroupChatId, id);
        await addCommentToIssue(context, `Workroom closed for issue ${title}`, owner, repo, issue.number);
    } catch (er) {
        await addCommentToIssue(context, logger.error(`Failed to close chatroom for issue ${title}`, { er }).logMessage.diff, owner, repo, issue.number);
    }

    return { status: "success", reason: "chatroom_closed" };
}

