import { Env } from ".";
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
    const {
      telegramBotEnv: {
        botSettings: { TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_WEBHOOK, ALLOWED_UPDATES },
      },
    } = env;
    if (!TelegramBotSingleton._instance) {
      TelegramBotSingleton._instance = new TelegramBotSingleton();
      TelegramBotSingleton._bot = createBot(TELEGRAM_BOT_TOKEN, {
        config: env,
        logger,
      });

      await TelegramBotSingleton._bot.api.setWebhook(TELEGRAM_BOT_WEBHOOK, {
        allowed_updates: ALLOWED_UPDATES,
        drop_pending_updates: true,
        secret_token: env.telegramBotEnv.botSettings.TELEGRAM_BOT_WEBHOOK_SECRET,
      });

      TelegramBotSingleton._server = createServer({
        bot: TelegramBotSingleton._bot,
        config: env,
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
