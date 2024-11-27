import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { webhookCallback } from "grammy";
import { Context as UbiquityOsContext } from "../types";
import { Logger } from "../utils/logger";
import { Bot } from "../bot";
import { setLogger } from "./middlewares/logger";
import { requestLogger } from "./middlewares/request-logger";
import type { Env } from "hono";
import { cors, jsonErrorHandler, rateLimit, securityHeaders } from "./middlewares/wares";

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

export function createServer(dependencies: Dependencies) {
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
