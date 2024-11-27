import { BotConfig, StorageAdapter } from "grammy";
import { Bot as TelegramBot, Context as GrammyContext } from "grammy";
import { autoChatAction } from "@grammyjs/auto-chat-action";
import { hydrate } from "@grammyjs/hydrate";
import { hydrateReply, parseMode } from "@grammyjs/parse-mode";
import { Octokit as RestOctokitFromApp } from "octokit";
import { Octokit } from "@octokit/rest";

import { Logger } from "../utils/logger";
import { createContextConstructor, SessionData } from "./helpers/grammy-context";
import { errorHandler } from "./handlers/error";

import { adminFeature } from "./features/admin/admin";
import { setWebhookFeature } from "./features/admin/set-webhook";
import { userIdFeature } from "./features/commands/private-chat/user-id";
import { chatIdFeature } from "./features/commands/shared/chat-id";
import { botIdFeature } from "./features/commands/private-chat/bot-id";
import { registerFeature } from "./features/commands/private-chat/register";
import { notifySubscribeFeature } from "./features/commands/private-chat/notify-subscribe";
import { walletFeature } from "./features/commands/private-chat/wallet";
import { banCommand } from "./features/commands/groups/ban";
import { welcomeFeature } from "./features/start-command";
import { unhandledFeature } from "./features/helpers/unhandled";
import { Context } from "../types";
import { session } from "./middlewares/session";
import { askFeature } from "./features/commands/shared/ask-command";
import { newTaskFeature } from "./features/commands/shared/task-creation";

interface Dependencies {
  config: Context["env"];
  logger: Logger;
  octokit: RestOctokitFromApp | Octokit;
}

interface Options {
  botSessionStorage?: StorageAdapter<SessionData>;
  botConfig?: Omit<BotConfig<GrammyContext>, "ContextConstructor">;
}

function getSessionKey(ctx: Omit<GrammyContext, "session">) {
  return ctx.chat?.id.toString();
}

export async function createBot(token: string, dependencies: Dependencies, options: Options = {}) {
  const { logger } = dependencies;

  const bot = new TelegramBot(token, {
    ...options.botConfig,
    ContextConstructor: await createContextConstructor(dependencies),
    client: {
      timeoutSeconds: 500,
    },
  });

  // Error handling
  bot.catch(errorHandler);

  // Configure bot API
  bot.api.config.use(parseMode("HTML"));

  // Middleware usage
  bot.use(hydrate());
  bot.use(hydrateReply);
  bot.use(autoChatAction());

  // Session middleware
  bot.use(
    session({
      getSessionKey,
      storage: options.botSessionStorage,
    })
  );

  // Log middleware initialization
  logger.info("Initializing middlewares and features...");

  // Feature middlewares
  bot.use(welcomeFeature);

  // Admin commands
  bot.use(adminFeature);
  bot.use(setWebhookFeature);

  // Development commands
  bot.use(userIdFeature);
  bot.use(chatIdFeature);
  bot.use(botIdFeature);

  // Private chat commands
  bot.use(registerFeature);
  bot.use(notifySubscribeFeature);
  bot.use(walletFeature);

  // Group commands
  bot.use(banCommand);

  // shared commands
  bot.use(askFeature);
  bot.use(newTaskFeature);

  // Unhandled command handler
  bot.use(unhandledFeature);

  // Log bot is ready
  logger.info("Bot is initialized and ready to handle updates.");

  return bot;
}

export type Bot = Awaited<ReturnType<typeof createBot>>;
