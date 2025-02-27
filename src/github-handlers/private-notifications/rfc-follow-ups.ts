import { Context } from "../../types";
import { RfcComment, StorageUser } from "../../types/storage";
import { logger } from "../../utils/logger";
import { Bot } from "../../botfather-bot/create-bot";
import { retrieveUsersByGithubUsernames } from "./comment-triggers";

const rfcCommentRegex = /rfc @(\w+)|rfc @(\w+)|request for comment @(\w+)/gi;

export function shouldSaveRfcComment(context: Context<"issue_comment.created" | "issue_comment.edited">) {
    const { body } = context.payload.comment;
    const rfcMatches = body.match(rfcCommentRegex);
    return rfcMatches && rfcMatches.length > 0;
}

/**
 * Stores RFC comments in the user's storage
 */
export async function captureAndSaveRfcComment(context: Context<"issue_comment.created" | "issue_comment.edited">) {
    const { body } = context.payload.comment;
    const rfcMatches = body.match(rfcCommentRegex) || [];

    let username;

    for (const match of rfcMatches) {
        if (match) {
            username = match.split(" ")[1];
            break;
        }
    }

    if (!username) {
        logger.error(`Username not found in RFC comment`, { body });
        return;
    }

    const fetchedUsers = await retrieveUsersByGithubUsernames([username], context);
    if (!fetchedUsers || fetchedUsers.length === 0) {
        logger.error(`User not found for ${username}`);
        return;
    }

    const fetchedUser = fetchedUsers[0];
    const listeningTo = fetchedUser.listening_to;
    let rfcComments = fetchedUser.rfc_comments;

    if (!listeningTo.rfc) {
        // We could inject team members github names via the config and bypass this check
        return;
    }

    rfcComments ??= [];

    const { comment } = context.payload;

    const rfcComment = {
        comment_id: context.payload.comment.id,
        comment: comment.body,
        created_at: context.payload.comment.created_at,
        updated_at: context.payload.comment.updated_at,
        comment_url: context.payload.comment.html_url,
    };

    const existingComment = rfcComments?.find((c) => c.comment_id === rfcComment.comment_id);
    if (existingComment) {
        existingComment.comment = rfcComment.comment;
        existingComment.updated_at = rfcComment.updated_at;
    } else {
        rfcComments.push(rfcComment);
    }

    fetchedUser.rfc_comments = rfcComments;
    fetchedUser.last_rfc_check = new Date().toISOString();

    await context.adapters.storage.handleUserBaseStorage(fetchedUser, "update");
}

/**
 * This is going to act like a wildcard event since it's running on every comment.
 *
 * We'll see if the comment author is subscribed to RFC notifications and if they have
 * then we'll check if they should respond to any of the existing RFC comments.
 *
 * If they've been active in the issue since the RFC comment was made, we'll remove the RFC comment
 * from their storage.
 */
export async function sendRfcNotifications(bot: Bot, context: Context<"issue_comment.created" | "issue_comment.edited">) {
    const allUsers = await context.adapters.storage.getAllUsers();
    const { octokit } = context;

    for (const user of allUsers) {
        if (!shouldFollowUpRfc(user)) {
            continue;
        }

        const rfcsCommentsToFollowUp = getRfcsCommentsToFollowUp(user);

        if (rfcsCommentsToFollowUp.length === 0) {
            continue;
        }

        for (const rfcComment of rfcsCommentsToFollowUp) {
            await processRfcComment(rfcComment, user, bot, context, octokit);
        }

        user.last_rfc_check = new Date().toISOString();
        await context.adapters.storage.handleUserBaseStorage(user, "update");
    }

    return { status: 200, reason: "success" };
}

export function shouldFollowUpRfc(user: StorageUser): boolean {
    const { listening_to, rfc_comments, github_username } = user;

    if (!rfc_comments || !github_username || !listening_to.rfc) {
        console.log("No RFC comments or github username or not listening to RFC", { rfc_comments, github_username, listening_to });
        return false;
    }

    const now = new Date();
    const lastRfcCheck = new Date(user.last_rfc_check);
    const rfcFollowUpTime = 1000;

    if (now.getTime() - lastRfcCheck.getTime() < rfcFollowUpTime) {
        console.log("Not enough time has passed since last check", { now, lastRfcCheck });
        return false;
    }

    return true;
}

export function getRfcsCommentsToFollowUp(user: StorageUser): RfcComment[] {
    const now = new Date();
    const rfcFollowUpTime = 1000;

    return user.rfc_comments.filter((c) => {
        const commentDate = new Date(c.created_at);
        return now.getTime() - commentDate.getTime() > rfcFollowUpTime;
    });
}

export async function processRfcComment(
    rfcComment: RfcComment,
    user: StorageUser,
    bot: Bot,
    context: Context<"issue_comment.created" | "issue_comment.edited">,
    octokit: Context["octokit"]
) {
    const commentUrl = ownerRepoNumberFromCommentUrl(rfcComment.comment_url);

    if (!commentUrl) {
        logger.error(`Comment url not found`, { rfcComment });
        return;
    }

    const { owner, repo, number } = commentUrl;

    const issueComments = await octokit.rest.issues.listComments({ owner, repo, issue_number: number });
    const comment = issueComments.data.find((c) => c.id === rfcComment.comment_id);

    if (!comment) {
        logger.error(`Comment not found`, { rfcComment });
        return;
    }

    const rfcCommentDate = new Date(rfcComment.created_at);
    const commentsAfterRfc = issueComments.data.filter((c) => new Date(c.created_at).getTime() > rfcCommentDate.getTime());

    if (commentsAfterRfc.length > 0 && commentsAfterRfc.some((c) => c.user?.login === user.github_username)) {
        user.rfc_comments = user.rfc_comments.filter((c) => c.comment_id !== rfcComment.comment_id);
        await context.adapters.storage.handleUserBaseStorage(user, "update");
        return;
    }

    await sendRfcNotification(rfcComment, user.github_username, user.telegram_id, bot, context);
}

export function ownerRepoNumberFromCommentUrl(url: string) {
    url = url.split("#")[0];
    const urlRegex = /https:\/\/github\.com\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/issues\/(?<number>\d+)/;
    const match = urlRegex.exec(url);
    if (match?.groups) {
        const { owner, repo, number } = match.groups;
        return { owner, repo, number: parseInt(number, 10) };
    }
}

export async function sendRfcNotification(
    rfcComment: { comment: string; created_at: string; updated_at: string; comment_id: number },
    githubUsername: string,
    telegramId: string | number,
    bot: Bot,
    context: Context<"issue_comment.created" | "issue_comment.edited">
) {
    const rfcMessage = `<b>Hello ${githubUsername.charAt(0).toUpperCase() + githubUsername.slice(1)}</b>,
  
    It seems you have not responded to the RFC comment yet. Please provide your feedback on the proposed changes:
  
    ${rfcComment.comment}
  
    You can reply to the comment <a href="${context.payload.comment.html_url}">here</a>.
    `;

    let userPrivateChat;

    try {
        userPrivateChat = await bot?.api.getChat(telegramId);
    } catch (er) {
        logger.error(`Error getting chat for ${telegramId}`, { er });
    }

    if (!userPrivateChat) {
        logger.error(`This user has not started a chat with the bot yet`, { telegramId });
        return;
    }

    try {
        await bot?.api.sendMessage(Number(telegramId), rfcMessage, { parse_mode: "HTML" });
    } catch (er) {
        logger.error(`Error sending message to ${telegramId}`, { er });
    }
}
