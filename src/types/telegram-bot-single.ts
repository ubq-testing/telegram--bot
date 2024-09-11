import { Value } from "@sinclair/typebox/value";
import { Env, envValidator } from ".";
import { Bot, createBot } from "../bot";
import { createServer } from "../server";
import { logger } from "../utils/logger";

/**
 * Singleton for the worker instance of the telegram bot
 *
 * This is for use with the BotFather bot and not the "user" account.
 */
export class TelegramBotSingleton {
  private static _instance: TelegramBotSingleton;
  private static _bot: Bot;
  private static _server: ReturnType<typeof createServer>;

  static async initialize(env: Env): Promise<TelegramBotSingleton> {
    if (!TelegramBotSingleton._instance) {
      TelegramBotSingleton._instance = new TelegramBotSingleton();
      TelegramBotSingleton._bot = createBot(env.BOT_TOKEN, {
        config: Value.Decode(envValidator.schema, Value.Default(envValidator.schema, env)),
        logger,
      });

      await TelegramBotSingleton._bot.api.setWebhook(env.BOT_WEBHOOK, {
        allowed_updates: env.ALLOWED_UPDATES,
        drop_pending_updates: true,
      });

      TelegramBotSingleton._server = createServer({
        bot: TelegramBotSingleton._bot,
        config: Value.Decode(envValidator.schema, Value.Default(envValidator.schema, env)),
        logger,
      });
    }

    return TelegramBotSingleton._instance;
  }

  static getInstance(): TelegramBotSingleton {
    if (!TelegramBotSingleton._instance) {
      throw new Error("TelegramBotSingleton is not initialized. Call initialize() first.");
    }
    return TelegramBotSingleton._instance;
  }

  getBot(): Bot {
    return TelegramBotSingleton._bot;
  }

  getServer(): ReturnType<typeof createServer> {
    return TelegramBotSingleton._server;
  }
}
