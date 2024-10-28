import { Env, envValidator } from "./types";
import { handleGithubWebhook } from "./handlers/github-webhook";
import { handleTelegramWebhook } from "./handlers/telegram-webhook";
import manifest from "../manifest.json";
import { handleUncaughtError } from "./utils/errors";
import { TelegramBotSingleton } from "./types/telegram-bot-single";
import { PluginContext } from "./types/plugin-context-single";
import { Value } from "@sinclair/typebox/value";
import { logger } from "./utils/logger";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === "GET") {
      if (path === "/manifest.json") {
        return new Response(JSON.stringify(manifest), {
          headers: { "content-type": "application/json" },
        });
      }
    }

    let envSettings;

    try {
      envSettings = Value.Decode(envValidator.schema, Value.Default(envValidator.schema, env));
    } catch (err) {
      logger.error("Could not decode env", { err });
      return new Response(JSON.stringify({ err, message: "Invalid environment provided" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    try {
      PluginContext.initialize(await request.clone().json(), envSettings);
    } catch (er) {
      logger.error("Could not initialize PluginContext on fetch", { er });
      return new Response(JSON.stringify({ err: er, message: "Invalid plugin context provided" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    if (["/telegram", "/telegram/"].includes(path)) {
      try {
        await TelegramBotSingleton.initialize(envSettings);
        return await handleTelegramWebhook(request, envSettings);
      } catch (err) {
        logger.error("handleTelegramWebhook failed", { err });
        return handleUncaughtError(err);
      }
    }

    const contentType = request.headers.get("content-type");
    if (contentType !== "application/json") {
      return new Response(JSON.stringify({ error: `Error: ${contentType} is not a valid content type` }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    try {
      return await handleGithubWebhook(request, envSettings);
    } catch (err) {
      logger.error("handleGithubWebhook failed", { err });
      return handleUncaughtError(err);
    }
  },
};
