import { Bot } from "../../bot";
import { Context, SupportedEvents } from "../../types";
import { StorageUser } from "../../types/storage";
import { CallbackResult } from "../../types/proxy";
import { TelegramBotSingleton } from "../../types/telegram-bot-single";
import { logger } from "../../utils/logger";
import { PluginContext } from "../../types/plugin-context-single";

const reminderCommentRegex = /@(\w+), this task has been idle for a while. Please provide an update./gi;
const base64ClaimUrlRegex = /href="https:\/\/[^/]+\/?\?claim=([A-Za-z0-9+/=]+)"/gi;
const amountPatternRegex = /\[\s*\d+(\.\d+)?\s*[A-Z]+\s*\]/gi;
const githubUsernameRegex = /<h6>@([a-zA-Z0-9-]{1,39})<\/h6>/gi;

// we'll have multiple permit comments to parse out here
// the regex is capturing the claim url and the github username

export async function notificationsRequiringComments(
  context: Context<"issue_comment.created" | "issue_comment.edited">
): Promise<CallbackResult> {
  const {
    adapters: { storage },
    payload,
    logger,
  } = context;

  const ctxInstance = PluginContext.getInstance();

  const body = payload.comment.body;
  const paymentComment = body.match(base64ClaimUrlRegex) && body.match(amountPatternRegex) && body.match(githubUsernameRegex);
  // skip if not a bot comment or not a reward comment

  if (!paymentComment && !body.match(reminderCommentRegex)) {
    return { status: 200, reason: "skipped" };
  }

  const base64Matches = body.matchAll(base64ClaimUrlRegex);
  const amountMatches = body.matchAll(amountPatternRegex);
  const usernameMatches = body.matchAll(githubUsernameRegex);

  const results = [];
  const usernames = [];

  for (const match of base64Matches) {
    results.push({ claimUrl: match[1] });
  }

  for (const match of amountMatches) {
    const amount = match[0];
    results.push({ amount });
  }

  for (const match of usernameMatches) {
    const username = match[1];
    usernames.push(username);
  }

  const users = [];

  for (const username of usernames) {
    try {
      const user = await ctxInstance.getStdOctokit().rest.users.getByUsername({ username });
      users.push(await storage.retrieveUserByGithubId(user.data.id));
    } catch (er) {
      logger.error(`Error getting user by github id`, { er });
    }
  }

  let bot;
  try {
    bot = (await TelegramBotSingleton.initialize(context.env)).getBot();
  } catch (er) {
    logger.error(`Error getting bot instance`, { er });
  }

  if (!bot) {
    throw new Error("Bot instance not found");
  }

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
      await handleCommentNotificationTrigger({ trigger, user, telegramId: user.telegram_id, bot, context, claimUrl: results[i].claimUrl });
    }
    i++;
  }

  return { status: 200, reason: "success" };
}

async function handleCommentNotificationTrigger({
  trigger,
  user,
  telegramId,
  bot,
  context,
  claimUrl,
}: {
  trigger: string;
  user: StorageUser;
  telegramId: number | string;
  bot: Bot;
  context: Context<"issue_comment.created" | "issue_comment.edited">;
  claimUrl?: string;
}) {
  if (trigger === "reminder") {
    return handleReminderNotification(user.github_username, telegramId, bot, context);
  } else if (trigger === "payment") {
    return handlePaymentNotification(user.github_username, claimUrl, telegramId, bot);
  }
}

async function handleReminderNotification(
  username: string,
  telegramId: string | number,
  bot: Bot,
  context: Context<"issue_comment.created" | "issue_comment.edited">
) {
  const message = `<b>Hello ${username.charAt(0).toUpperCase() + username.slice(1)}</b>,

This task has been idle for a while, please provide an update on <a href="${context.payload.issue.html_url}">${context.payload.repository.full_name}#${context.payload.issue.number}</a>.`;

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
    await bot?.api.sendMessage(Number(telegramId), message, { parse_mode: "HTML" });
  } catch (er) {
    logger.error(`Error sending message to ${telegramId}`, { er });
  }

  return { status: 200, reason: "success" };
}

async function handlePaymentNotification(username: string, claimUrlBase64String: string | undefined, telegramId: string | number, bot: Bot) {
  if (!claimUrlBase64String) {
    logger.error(`Claim URL not found for ${username}`);
    return;
  }
  const message = `<b>Hello ${username.charAt(0).toUpperCase() + username.slice(1)}</b>,

🎉 A task reward has been generated for you 🎉

You can claim your reward by clicking the link below:

<a href="https://pay.ubq.fi?claim=${claimUrlBase64String}">Claim Your Reward</a>

Thank you for your contribution.`;

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
    await bot?.api.sendMessage(Number(telegramId), message, { parse_mode: "HTML" });
  } catch (er) {
    logger.error(`Error sending message to ${telegramId}`, { er });
  }
}