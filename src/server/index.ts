import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { webhookCallback } from "grammy";
import { getPath } from "hono/utils/url";
import { setLogger } from "#root/server/middlewares/logger.js";
import type { Bot } from "#root/bot/index.js";
import { requestLogger } from "#root/server/middlewares/request-logger.js";
import type { Logger } from "#root/utils/logger.js";
import { Context as UbiquityOsContext } from "../types";

interface Dependencies {
  bot: Bot;
  config: UbiquityOsContext["env"];
  logger: Logger;
}

interface HonoEnv {
  Variables: {
    requestId: string;
    logger: Logger;
  };
}
/**
 * Creates the Hono server instance for handling Bot API requests.
 */
export function createServer(dependencies: Dependencies) {
  const { bot, config, logger } = dependencies;

  const server = new Hono<HonoEnv>();

  server.use(setLogger(logger));
  server.use(requestLogger());

  server.onError(async (error, c) => {
    console.error(c);
    if (error instanceof HTTPException) {
      if (error.status < 500)
        c.var.logger.info("Request info failed", {
          err: error,
        });
      else
        c.var.logger.fatal("Request failed", {
          err: error,
        });

      return error.getResponse();
    }

    c.var.logger.error("Unexpected error occurred", {
      err: error,
      method: c.req.raw.method,
      path: getPath(c.req.raw),
    });
    return c.json(
      {
        error: "Oops! Something went wrong.",
      },
      500
    );
  });

  server.get("/", (c) => c.json({ status: true }));
  server.post(
    "/webhook",
    webhookCallback(bot, "hono", {
      secretToken: config.telegramBotSettings.TELEGRAM_BOT_WEBHOOK_SECRET,
    })
  );

  return server;
}

export type Server = Awaited<ReturnType<typeof createServer>>;
