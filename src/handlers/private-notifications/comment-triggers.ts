import { Bot } from "../../bot";
import { Context, SupportedEvents } from "../../types";
import { StorageUser } from "../../types/github-storage";
import { CallbackResult } from "../../types/proxy";
import { TelegramBotSingleton } from "../../types/telegram-bot-single";
import { Logger, logger } from "../../utils/logger";

const rewardCommentRegex = /href="https:\/\/[^/]+\/?\?claim=([A-Za-z0-9+/=]+)"[^>]*>\s*\[.*?\]\s*<\/a>\s*<\/h3>\s*<h6>\s*@([a-zA-Z0-9-_]+)\s*<\/h6>/g;
// we'll have multiple permit comments to parse out here
// the regex is capturing the claim url and the github username

export async function notificationsRequiringComments(
  context: Context<"issue_comment.created" | "issue_comment.edited", SupportedEvents["issue_comment.created" | "issue_comment.edited"]>
): Promise<CallbackResult> {
  const {
    adapters: { github },
    payload,
    logger,
  } = context;

  // For now only payments are supported so this naive check will be improved
  // to support multiple triggers in the future

  // skip if not a bot comment or not a reward comment
  if (payload.comment.user?.type !== "Bot" || !payload.comment.body.match(rewardCommentRegex)) {
    return { status: 200, reason: "skipped" };
  }

  const users = await github.retrieveStorageDataObject("userBase", false);

  if (!users) {
    logger.error("No users found in the database.");
    return { status: 500, reason: "No users found in the database." };
  }

  const usernameToClaimUrls: Record<string, string> = parsePaymentComment(payload.comment.body);

  let bot;
  try {
    bot = (await TelegramBotSingleton.initialize(context.env)).getBot();
  } catch (er) {
    logger.error(`Error getting bot instance`, { er });
  }

  if (!bot) {
    throw new Error("Bot instance not found");
  }

  for (const [telegramId, user] of Object.entries(users)) {
    if (!user.listeningTo?.length) {
      continue;
    }

    if (user.listeningTo.length === 1) {
      const trigger = user.listeningTo[0];
      await handleCommentNotificationTrigger(trigger, user, usernameToClaimUrls, telegramId, bot, logger);
    } else {
      for (const trigger of user.listeningTo) {
        await handleCommentNotificationTrigger(trigger, user, usernameToClaimUrls, telegramId, bot, logger);
      }
    }
  }

  return { status: 200, reason: "success" };
}

async function handleCommentNotificationTrigger(
  trigger: string,
  user: StorageUser,
  usernameToClaimUrls: Record<string, string>,
  telegramId: string,
  bot: Bot,
  logger: Logger
) {
  try {
    if (trigger === "payment") {
      for (const [username, claimUrl] of Object.entries(usernameToClaimUrls)) {
        if (user.githubUsername === username) {
          await handlePaymentNotification(username, claimUrl, telegramId, bot);
        }
      }
    } else {
      logger.error(`Trigger ${trigger} not implemented yet.`);
    }
  } catch (er) {
    logger.error(`Error sending message to ${telegramId}`, { er });
  }
}

async function handlePaymentNotification(username: string, claimUrlBase64String: string, telegramId: string, bot: Bot) {
  const message = `**Hello ${username},**

🎉 A task reward has been generated for you! 🎉

You can claim your reward by clicking the link below:

[Claim Your Reward](https://pay.ubq.fi?claim=${claimUrlBase64String})

Thank you for your contribution!`;

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
    await bot?.api.sendMessage(telegramId, message, { parse_mode: "MarkdownV2" });
  } catch (er) {
    logger.error(`Error sending message to ${telegramId}`, { er });
  }
}

function parsePaymentComment(comment: string) {
  const claims: Record<string, string> = {};

  for (const match of comment.matchAll(rewardCommentRegex)) {
    const [, claim, username] = match;
    claims[username] = claim;
  }

  return claims;
}
