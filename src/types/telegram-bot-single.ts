import { Octokit as OctokitRest } from "@octokit/rest";
import { Octokit } from "octokit";
import { Env } from ".";
import { Bot, createBot } from "../bot";
import { createServer } from "../server";
import { logger } from "../utils/logger";
import { PluginContext } from "./plugin-context-single";

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
      TELEGRAM_BOT_ENV: {
        botSettings: { TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_WEBHOOK, ALLOWED_UPDATES, TELEGRAM_BOT_WEBHOOK_SECRET },
      },
    } = env;

    let octokit: Octokit | OctokitRest | null = null;

    try {
      octokit = await PluginContext.getInstance().getTelegramEventOctokit();
    } catch (er) {
      logger.error("Error initializing octokit in TelegramBotSingleton", { er });
    }

    if (!octokit) {
      throw new Error("Octokit not initialized");
    }

    if (!TelegramBotSingleton._instance) {
      TelegramBotSingleton._instance = new TelegramBotSingleton();
      try {
        TelegramBotSingleton._bot = await createBot(TELEGRAM_BOT_TOKEN, {
          config: env,
          logger,
          octokit,
        });
      } catch (er) {
        logger.error("Error initializing TelegramBotSingleton", { er });
      }

      try {
        await TelegramBotSingleton._bot.api.setWebhook(TELEGRAM_BOT_WEBHOOK, {
          allowed_updates: ALLOWED_UPDATES,
          secret_token: TELEGRAM_BOT_WEBHOOK_SECRET,
        });
      } catch (er) {
        logger.error("Error setting webhook in TelegramBotSingleton", { er });
      }

      try {
        TelegramBotSingleton._server = createServer({
          bot: TelegramBotSingleton._bot,
          env,
          logger,
        });
      } catch (er) {
        logger.error("Error initializing server in TelegramBotSingleton", { er });
      }
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
