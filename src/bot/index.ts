import type { BotConfig, StorageAdapter } from "grammy";
import { Bot as TelegramBot } from "grammy";
import type { Context, SessionData } from "#root/bot/helpers/grammy-context.js";
import { createContextConstructor } from "#root/bot/helpers/grammy-context.js";
import type { Logger } from "#root/utils/logger.js";
import { Context as UbiquityOsContext } from "../types";
import { welcomeFeature } from "#root/bot/features/welcome.js";
import { unhandledFeature } from "#root/bot/features/helpers/unhandled.js";
import { errorHandler } from "#root/bot/handlers/error.js";
import { session } from "#root/bot/middlewares/session.js";
import { autoChatAction } from "@grammyjs/auto-chat-action";
import { hydrate } from "@grammyjs/hydrate";
import { hydrateReply, parseMode } from "@grammyjs/parse-mode";
import { adminFeature } from "./features/admin/admin";
import { userIdFeature } from "./features/commands/private-chat/user-id";
import { chatIdFeature } from "./features/commands/shared/chat-id";
import { botIdFeature } from "./features/commands/private-chat/bot-id";
import { banCommand } from "./features/commands/groups/ban";
import { setWebhookFeature } from "./features/commands/private-chat/set-webhook";

interface Dependencies {
  config: UbiquityOsContext["env"];
  logger: Logger;
}

interface Options {
  botSessionStorage?: StorageAdapter<SessionData>;
  botConfig?: Omit<BotConfig<Context>, "ContextConstructor">;
}

function getSessionKey(ctx: Omit<Context, "session">) {
  return ctx.chat?.id.toString();
}

export function createBot(token: string, dependencies: Dependencies, options: Options = {}) {
  const { config, logger } = dependencies;

  const bot = new TelegramBot(token, {
    ...options.botConfig,
    ContextConstructor: createContextConstructor({
      logger,
      config,
    }),
  });
  const protectedBot = bot.errorBoundary(errorHandler);

  bot.api.config.use(parseMode("HTML"));

  protectedBot.use(autoChatAction(bot.api));
  protectedBot.use(hydrateReply);
  protectedBot.use(hydrate());
  protectedBot.use(session({ getSessionKey, storage: options.botSessionStorage }));

  // the `/start` command for a traditional TG bot, doubt we need this as-is
  // but a variation of can be built for various scenarios.
  protectedBot.use(welcomeFeature);

  // admin commands
  protectedBot.use(adminFeature);
  protectedBot.use(setWebhookFeature);

  // development commands
  protectedBot.use(userIdFeature);
  protectedBot.use(chatIdFeature);
  protectedBot.use(botIdFeature);

  // group commands
  protectedBot.use(banCommand);

  // unhandled command handler
  protectedBot.use(unhandledFeature);

  return bot;
}

export type Bot = ReturnType<typeof createBot>;
