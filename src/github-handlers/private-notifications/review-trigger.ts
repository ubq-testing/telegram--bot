import { Context } from "../../types";
import { CallbackResult } from "../../types/proxy";
import { logger } from "../../utils/logger";

export async function reviewNotification(context: Context<"pull_request.review_requested">): Promise<CallbackResult> {
  const {
    adapters: { storage },
    payload,
  } = context;
  const requestedReviewer = payload.requested_reviewer?.login;

  if (!requestedReviewer) {
    throw new Error("No user found in the payload");
  }

  const dbUser = await storage.retrieveUserByGithubId(payload.requested_reviewer?.id);

  if (!dbUser) {
    throw new Error("User not found in the database");
  }

  const ownerRepo = payload.repository.full_name;
  const issueNumber = payload.pull_request.number;

  // skip if they've requested review from themselves
  if (payload.sender.login === requestedReviewer) {
    return { status: 200, reason: "skipped" };
  }

  if (dbUser.listening_to["review"]) {
    await handleReviewNotification(dbUser.github_username, dbUser.telegram_id, ownerRepo, issueNumber, context);
  } else {
    return { status: 200, reason: "skipped" };
  }

  return { status: 200, reason: "success" };
}

async function handleReviewNotification(
  username: string,
  telegramId: number,
  ownerRepo: string,
  issueNumber: number,
  context: Context<"pull_request.review_requested">
) {
  const prAuthor = context.payload.pull_request.user?.login;
  const message = `<b>Hello ${username.charAt(0).toUpperCase() + username.slice(1)}</b>,

${prAuthor} has requested a review from you on <a href="${context.payload.pull_request.html_url}">${ownerRepo}#${issueNumber}</a>.`;

  let userPrivateChat;
  const bot = context.pluginEnvCtx.getBotFatherBot();

  try {
    userPrivateChat = await bot.api.getChat(telegramId);
  } catch (er) {
    logger.error(`Error getting chat for ${telegramId}`, { er });
  }

  if (!userPrivateChat) {
    logger.error(`This user has not started a chat with the bot yet`, { telegramId });
    return;
  }

  try {
    await bot.api.sendMessage(telegramId, message, { parse_mode: "HTML" });
  } catch (er) {
    logger.error(`Error sending message to ${telegramId} `, { er });
  }
}
