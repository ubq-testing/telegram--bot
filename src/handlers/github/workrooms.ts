import { TelegramBotSingleton } from "#root/utils/telegram-bot-single.js";
import { Context } from "../../types";

export async function createChatroom(context: Context) {
    const { logger, config } = context;
    const bot = TelegramBotSingleton.getInstance().getBot();
    const title = context.payload.issue.title

    logger.info(`Creating chatroom for issue ${title}`);

    let forum;
    try {
        forum = await bot.api?.createForumTopic(config.supergroupChatId, title);
        logger.info(`Created chatroom for issue ${title}: ${forum?.message_thread_id}`);
    } catch (er) {
        logger.error(`Failed to create chatroom for issue ${title}`, { er });
    }

    if (forum) {
        await addCommentToIssue(context, `Workroom created: https://t.me/${config.supergroupChatName}/${forum?.message_thread_id}`);
    } else {
        await addCommentToIssue(context, logger.error(`Failed to create chatroom for issue ${title}`).logMessage.diff);
    }
}


async function addCommentToIssue(context: Context, msg: string) {
    const { logger, octokit } = context;
    const { repository: { full_name }, issue } = context.payload;
    const [owner, repo] = full_name.split("/");

    logger.info(`Adding comment to issue ${issue.number}`);

    try {
        await octokit.issues.createComment({
            owner,
            repo,
            issue_number: issue.number,
            body: msg,
        });
        logger.info(`Added comment to issue ${issue.number}`);
    } catch (er) {
        logger.error(`Failed to add comment to issue ${issue.number}`, { er });
    }
}
