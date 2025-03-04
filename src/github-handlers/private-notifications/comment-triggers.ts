import { Context } from "../../types";
import { StorageUser } from "../../types/storage";
import { CallbackResult } from "../../types/proxy";
import { logger } from "../../utils/logger";

const reminderCommentRegex = /@(\w+), this task has been idle for a while/gi;
// eslint-disable-next-line sonarjs/duplicates-in-character-class
const base64ClaimUrlRegex = /href="https:\/\/[^/]+\/?\?claim=([A-Za-z0-9+/=]+)"/gi;
const amountPatternRegex = /\[\s*\d+(\.\d+)?\s*[A-Z]+\s*\]/gi;
// eslint-disable-next-line sonarjs/duplicates-in-character-class
const githubUsernameRegex = /@([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?)/gi;

// we'll have multiple permit comments to parse out here
// the regex is capturing the claim url and the github username

async function getUsersFromStorage(
  context: Context<"issue_comment.created" | "issue_comment.edited">,
  body: string
): Promise<{ results: { claimUrl?: string }[]; users: StorageUser[] }> {
  const isPaymentComment = base64ClaimUrlRegex.test(body) && amountPatternRegex.test(body) && githubUsernameRegex.test(body);
  const isReminderComment = reminderCommentRegex.test(body);

  if (!isPaymentComment && !isReminderComment) {
    return { results: [], users: [] };
  }

  const base64Matches = body.match(base64ClaimUrlRegex);
  const usernameMatches = body.match(githubUsernameRegex);

  const results = [];
  const usernames = [];

  if (isPaymentComment) {
    for (const match of base64Matches || []) {
      results.push({ claimUrl: match[1] });
    }

    for (const username of usernameMatches || []) {
      usernames.push(username);
    }
  } else if (isReminderComment) {
    usernames.push(body.match(reminderCommentRegex)?.[0].split(",")[0].replace("@", ""));
  } else {
    throw logger.error("Invalid notification trigger or not implemented yet", { body });
  }

  const users = await fetchUsers(
    usernames.filter((u): u is string => !!u),
    context
  );
  return { results, users: users.filter((u): u is StorageUser => !!u) };
}

async function fetchUsers(usernames: string[], context: Context<"issue_comment.created" | "issue_comment.edited">) {
  const {
    adapters: { storage },
    octokit,
  } = context;

  const users: StorageUser[] = [];

  for (const username of usernames) {
    if (!username) {
      continue;
    }
    try {
      const user = await octokit.rest.users.getByUsername({ username: username.replace("@", "") });
      const storageUser = await storage.retrieveUserByGithubId(user.data.id);
      if (storageUser) {
        users.push(storageUser);
      }
    } catch (er) {
      logger.error(`Error getting user by github id`, { er });
    }
  }

  return users;
}

export async function notificationsRequiringComments(context: Context<"issue_comment.created" | "issue_comment.edited">): Promise<CallbackResult> {
  const { payload } = context;
  const { body } = payload.comment;
  const { results, users } = await getUsersFromStorage(context, body);

  const commentDependantTriggers = ["payment", "reminder"];
  let i = 0;

  for (const user of users.filter((u): u is StorageUser => !!u)) {
    if (!user) {
      i++;
      continue;
    }

    for (const [trigger, isActive] of Object.entries(user.listening_to)) {
      if (!isActive || !commentDependantTriggers.includes(trigger)) {
        continue;
      }
      await handleCommentNotificationTrigger({ trigger, user, telegramId: user.telegram_id, context, claimUrl: results[i]?.claimUrl });
    }
    i++;
  }

  return { status: 200, reason: "success" };
}

async function handleCommentNotificationTrigger({
  trigger,
  user,
  telegramId,
  context,
  claimUrl,
}: {
  trigger: string;
  user: StorageUser;
  telegramId: number | string;
  context: Context<"issue_comment.created" | "issue_comment.edited">;
  claimUrl?: string;
}) {
  if (trigger === "reminder" && !claimUrl) {
    return handleReminderNotification(user.github_username, telegramId, context);
  } else if (trigger === "payment" && claimUrl) {
    return handlePaymentNotification(user, claimUrl, telegramId, context);
  }
}

async function handleReminderNotification(username: string, telegramId: string | number, context: Context<"issue_comment.created" | "issue_comment.edited">) {
  const message = `<b>Hello ${username.charAt(0).toUpperCase() + username.slice(1)}</b>,

This task has been idle for a while, please provide an update on <a href="${context.payload.issue.html_url}">${context.payload.repository.full_name}#${context.payload.issue.number}</a>.`;

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
    await bot.api.sendMessage(Number(telegramId), message, { parse_mode: "HTML" });
  } catch (er) {
    logger.error(`Error sending message to ${telegramId}`, { er });
  }

  return { status: 200, reason: "success" };
}

async function handlePaymentNotification(
  user: StorageUser,
  claimUrlBase64String: string | undefined,
  telegramId: string | number,
  context: Context<"issue_comment.created" | "issue_comment.edited">
) {
  const { wallet_address, github_username: username } = user;
  const bot = context.pluginEnvCtx.getBotFatherBot();

  if (!wallet_address) {
    logger.error(`Wallet address not found for ${username}`);
    const noWalletMessage = `<b>Hello ${username.charAt(0).toUpperCase() + username.slice(1)}</b>,

It seems you are subscribed to payment notifications and may have received a payment. However, we couldn't find a registered wallet address for you.
  
Please use the \`/wallet\` command to set your wallet address for future notifications.

You can view the comment <a href="${context.payload.comment.html_url}">here</a>.
`;

    try {
      await bot.api.sendMessage(Number(telegramId), noWalletMessage, { parse_mode: "HTML" });
    } catch (er) {
      logger.error(`Error sending message to ${telegramId}`, { er });
    }
    return;
  }

  let userPrivateChat;

  try {
    userPrivateChat = await bot.api.getChat(telegramId);
  } catch (er) {
    logger.error(`Error getting chat for ${telegramId}`, { er });
  }

  if (!userPrivateChat) {
    logger.error(`This user has not started a chat with the bot yet`, { telegramId });
    return;
  }

  const notificationMessage = `<b>Hello ${username.charAt(0).toUpperCase() + username.slice(1)}</b>,

  🎉 A task reward has been generated for you 🎉
  
  You can claim your reward by clicking the link below:
  
  <a href="https://pay.ubq.fi?claim=${claimUrlBase64String}">Claim Your Reward</a>
  
  Thank you for your contribution.`;

  try {
    await bot.api.sendMessage(Number(telegramId), notificationMessage, { parse_mode: "HTML" });
  } catch (er) {
    logger.error(`Error sending message to ${telegramId}`, { er });
  }
}
