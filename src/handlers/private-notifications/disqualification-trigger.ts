import { Context } from "../../types";
import { CallbackResult } from "../../types/proxy";
import { logger } from "../../utils/logger";

export async function disqualificationNotification(context: Context<"issues.unassigned">): Promise<CallbackResult> {
  const {
    adapters: { storage },
    payload,
  } = context;

  const unassignedUser = payload.assignee?.login;

  if (!unassignedUser) {
    throw new Error("No user found in the payload");
  }

  const dbUser = await storage.retrieveUserByGithubId(payload.assignee?.id);
  if (!dbUser) {
    throw new Error("User not found in the database");
  }

  const ownerRepo = payload.repository.full_name;
  const issueNumber = payload.issue.number;

  // skip if they've unassigned themselves
  if (payload.sender.login === unassignedUser) {
    return { status: 200, reason: "skipped" };
  }

  if (dbUser.listening_to["disqualification"]) {
    await handleDisqualificationNotification(dbUser.github_username, dbUser.telegram_id, ownerRepo, issueNumber, context);
  } else {
    return { status: 200, reason: "skipped" };
  }

  return { status: 200, reason: "success" };
}

async function handleDisqualificationNotification(
  username: string,
  telegramId: number,
  ownerRepo: string,
  issueNumber: number,
  context: Context<"issues.unassigned">
) {
  const message = `<b>Hello ${username.charAt(0).toUpperCase() + username.slice(1)}</b>,

You have been disqualified from <a href="${context.payload.issue.html_url}">${ownerRepo}#${issueNumber}</a>.

You will not be able to self-assign this task again.
`;

  let userPrivateChat;

  if (!context.bot) {
    throw new Error("Bot instance not found");
  }

  try {
    userPrivateChat = await context.bot?.api.getChat(telegramId);
  } catch (er) {
    logger.error(`Error getting chat for ${telegramId}`, { er });
  }

  if (!userPrivateChat) {
    logger.error(`This user has not started a chat with the bot yet`, { telegramId });
    return;
  }

  try {
    await context.bot?.api.sendMessage(telegramId, message, { parse_mode: "HTML" });
  } catch (er) {
    logger.error(`Error sending message to ${telegramId}`, { er });
  }
}
