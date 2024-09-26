import { Env, envValidator } from "./types";
import { handleGithubWebhook } from "./handlers/github-webhook";
import { handleTelegramWebhook } from "./handlers/telegram-webhook";
import manifest from "../manifest.json";
import { handleUncaughtError } from "./utils/errors";
import { TelegramBotSingleton } from "./types/telegram-bot-single";
import { PluginContext } from "./types/plugin-context-single";
import { Value } from "@sinclair/typebox/value";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    let envSettings;

    try {
      envSettings = Value.Decode(envValidator.schema, Value.Default(envValidator.schema, env));
    } catch (err) {
      return new Response(JSON.stringify({ error: "Invalid environment provided" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    if (["/telegram", "/telegram/"].includes(path)) {
      try {
        await TelegramBotSingleton.initialize(envSettings);
        PluginContext.initialize(await request.clone().json(), envSettings);
        return await handleTelegramWebhook(request, envSettings);
      } catch (err) {
        console.log("/webhook entry error", err);
        return handleUncaughtError(err);
      }
    }

    if (request.method === "GET") {
      if (path === "/manifest.json") {
        return new Response(JSON.stringify(manifest), {
          headers: { "content-type": "application/json" },
        });
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
      console.log("github entry error", err);
      return handleUncaughtError(err);
    }
  },
};
