import { Octokit as OctokitRest } from "@octokit/rest";
import { Octokit } from "octokit";
import { Bot, createBot } from "../botfather-bot";
import { logger } from "../utils/logger";
import { PluginEnvContext } from "./plugin-env-context";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { webhookCallback } from "grammy";
import { Context as UbiquityOsContext } from "../types";
import { Logger } from "../utils/logger";
import type { Env } from "hono";
import { setLogger } from "../botfather-bot/middlewares/logger";
import { requestLogger } from "../botfather-bot/middlewares/request-logger";
import { cors, jsonErrorHandler, rateLimit, securityHeaders } from "../botfather-bot/middlewares/wares";

interface Dependencies {
  bot: Bot;
  env: UbiquityOsContext["env"];
  logger: Logger;
}

interface HonoEnv extends Env {
  Variables: {
    requestId: string;
    logger: Logger;
  };
}

export class BotFatherInitializer {
  private _bot: Bot | null = null;
  private _server: Hono<HonoEnv> | null = null;

  constructor(
    private _pluginEnvCtx: PluginEnvContext | null = null,
  ) { }

  async initialize(): Promise<{ bot: Bot, server: Hono<HonoEnv> }> {
    if (!this._pluginEnvCtx) {
      throw new Error("PluginEnvContext not initialized");
    }
    const {
      TELEGRAM_BOT_ENV: {
        botSettings: { TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_WEBHOOK, ALLOWED_UPDATES, TELEGRAM_BOT_WEBHOOK_SECRET },
      },
    } = this._pluginEnvCtx.getEnv();

    let octokit: Octokit | OctokitRest | null = null;

    try {
      octokit = await this._pluginEnvCtx.getTelegramEventOctokit();
    } catch (er) {
      logger.error("Error initializing octokit in BotFatherInitializer", { er });
    }

    if (!octokit) {
      throw new Error("Octokit not initialized");
    }

    try {
      this._bot = await createBot(TELEGRAM_BOT_TOKEN, {
        logger,
        octokit,
        pluginEnvCtx: this._pluginEnvCtx,
      });
    } catch (er) {
      logger.error("Error initializing BotFatherInitializer", { er: String(er) });
    }

    if (!this._bot) {
      throw new Error("Bot not initialized");
    }

    try {
      await this._bot.api.setWebhook(TELEGRAM_BOT_WEBHOOK, {
        allowed_updates: ALLOWED_UPDATES,
        secret_token: TELEGRAM_BOT_WEBHOOK_SECRET,
      });
    } catch (er) {
      logger.error("Error setting webhook in BotFatherInitializer", { er: String(er) });
    }

    try {
      this._server = await this._createBotfatherHonoApp({
        bot: this._bot,
        env: this._pluginEnvCtx.getEnv(),
        logger,
      });
    } catch (er) {
      logger.error("Error initializing server in BotFatherInitializer", { er });
    }

    if (!this._server) {
      throw new Error(`[BotFatherInitializer] Server not initialized`);
    }

    return {
      bot: this._bot,
      server: this._server,
    }
  }

  private async _createBotfatherHonoApp(dependencies: Dependencies): Promise<Hono<HonoEnv>> {
    const { bot, env, logger } = dependencies;
    const {
      TELEGRAM_BOT_ENV: {
        botSettings: { TELEGRAM_BOT_WEBHOOK_SECRET },
      },
    } = env;

    const server = new Hono<HonoEnv>();

    // Middleware
    server.use("*", setLogger(logger));
    server.use("*", requestLogger());
    server.use("*", rateLimit({ windowMs: 60000, max: 100 }));
    server.use("*", cors());
    server.use("*", securityHeaders());
    server.use("*", jsonErrorHandler());

    // Error Handling
    server.onError((error, c) => {
      if (error instanceof HTTPException) {
        if (error.status < 500) {
          logger.error("Server error occurred", { err: error });
        }
        return c.json({ error: error.message }, error.status);
      }

      logger.error("Unexpected error occurred", {
        err: error,
        method: c.req.method,
        path: c.req.path,
      });
      let message = "Internal Server Error";

      if ("NODE_ENV" in process.env && process.env.NODE_ENV === "development") {
        message = error.message;
      }

      return c.json({ error: message }, 500);
    });

    // Routes
    server.post(
      "/telegram",
      async (c, next) => {
        // Request size limiting
        const contentLength = c.req.header("content-length");
        if (contentLength && parseInt(contentLength) > 1e6) {
          throw new HTTPException(413, { message: "Payload Too Large" });
        }

        // Secret token validation
        const secret = c.req.header("x-telegram-bot-api-secret-token");
        if (secret !== TELEGRAM_BOT_WEBHOOK_SECRET) {
          logger.error("Secret token mismatch", { secret });
          throw new HTTPException(401, { message: "Unauthorized" });
        }

        await next();
      },
      webhookCallback(bot, "hono", {
        secretToken: TELEGRAM_BOT_WEBHOOK_SECRET,
        timeoutMilliseconds: 60_000,
      })
    );

    // 404 Handler
    server.notFound((c) => {
      return c.json({ error: "Not Found" }, 404);
    });

    return server;
  }

  private _getServer(): BotFatherInitializer["_server"] {
    if (!this._server) {
      throw new Error("Server not initialized");
    }
    return this._server;
  }

  getBotFatherBot(): BotFatherInitializer["_bot"] {
    return this._bot;
  }
}
