import { Octokit as OctokitRest } from "@octokit/rest";
import { Octokit } from "octokit";
import { Bot, createBot } from "../bot";
import { createServer } from "../server";
import { logger } from "../utils/logger";
import { PluginEnvContext } from "./plugin-env-context";

/**
 * Singleton for the worker instance of the telegram bot
 *
 * This is for use with the BotFather bot and not the "user" account.
 */
export class TelegramBotSingleton {
  bot: Bot | null = null;
  server: ReturnType<typeof createServer> | null = null;
  pluginEnvCtx: PluginEnvContext | null = null;

  constructor(pluginEnvCtx: PluginEnvContext) {
    this.pluginEnvCtx = pluginEnvCtx;
  }

  async initialize(): Promise<TelegramBotSingleton> {
    if (!this.pluginEnvCtx) {
      throw new Error("PluginEnvContext not initialized");
    }
    const {
      env: {
        TELEGRAM_BOT_ENV: {
          botSettings: { TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_WEBHOOK, ALLOWED_UPDATES, TELEGRAM_BOT_WEBHOOK_SECRET },
        },
      },
    } = this.pluginEnvCtx;

    let octokit: Octokit | OctokitRest | null = null;

    try {
      octokit = await this.pluginEnvCtx.getTelegramEventOctokit();
    } catch (er) {
      logger.error("Error initializing octokit in TelegramBotSingleton", { er });
    }

    if (!octokit) {
      throw new Error("Octokit not initialized");
    }

    try {
      this.bot = await createBot(TELEGRAM_BOT_TOKEN, {
        config: this.pluginEnvCtx.env,
        logger,
        octokit,
        pluginEnvCtx: this.pluginEnvCtx,
      });
    } catch (er) {
      logger.error("Error initializing TelegramBotSingleton", { er: String(er) });
    }

    if (!this.bot) {
      throw new Error("Bot not initialized");
    }

    try {
      await this.bot.api.setWebhook(TELEGRAM_BOT_WEBHOOK, {
        allowed_updates: ALLOWED_UPDATES,
        secret_token: TELEGRAM_BOT_WEBHOOK_SECRET,
      });
    } catch (er) {
      logger.error("Error setting webhook in TelegramBotSingleton", { er: String(er) });
    }

    try {
      this.server = createServer({
        bot: this.bot,
        env: this.pluginEnvCtx.env,
        logger,
      });
    } catch (er) {
      logger.error("Error initializing server in TelegramBotSingleton", { er });
    }
    return this;
  }

  getBot(): Bot {
    if (!this.bot) {
      throw new Error("Bot not initialized");
    }
    return this.bot;
  }

  getServer(): TelegramBotSingleton["server"] {
    if (!this.server) {
      throw new Error("Server not initialized");
    }
    return this.server;
  }
}
