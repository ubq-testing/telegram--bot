import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { webhookCallback } from "grammy";
import { getPath } from "hono/utils/url";
import { Context as UbiquityOsContext } from "../types";
import { Logger } from "../utils/logger";
import { Bot } from "../bot";
import { setLogger } from "./middlewares/logger";
import { requestLogger } from "./middlewares/request-logger";

interface Dependencies {
  bot: Bot;
  env: UbiquityOsContext["env"];
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
  const { bot, env, logger } = dependencies;
  const {
    TELEGRAM_BOT_ENV: {
      botSettings: { TELEGRAM_BOT_WEBHOOK_SECRET },
    },
  } = env;

  const server = new Hono<HonoEnv>();

  server.use(setLogger(logger));
  server.use(requestLogger());

  server.onError(async (error, c) => {
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

  server.post(
    webhookCallback(bot, "hono", {
      secretToken: TELEGRAM_BOT_WEBHOOK_SECRET,
    })
  );

  return server;
}
