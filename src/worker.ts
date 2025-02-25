import { Context, Env, envValidator, PluginInputs, pluginSettingsValidator } from "./types";
import { PluginEnvContext } from "./types/plugin-env-context";
import { ExecutionContext } from "hono";
import { createPlugin } from "@ubiquity-os/plugin-sdk";
import { runGithubWorkerEntry, runTelegramBotEntry } from "./plugin";
import { Manifest } from "@ubiquity-os/plugin-sdk/manifest";
import { logger } from "./utils/logger";
import { handleUncaughtError } from "./utils/errors";
import { createAdapters } from "./adapters/create-adapters";
import manifest from "../manifest.json";
import { initializeBotFatherInstance } from "./botfather-bot/initialize-botfather-instance";

export default {
  async fetch(request: Request, env: Env, executionCtx?: ExecutionContext) {
    // The SDK handles this but it's cleaner if we handle it here
    if (new URL(request.url).pathname === "/manifest.json") {
      return new Response(JSON.stringify(manifest), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const pluginEnvContext = await initWorkerPluginContext(request, env);
    const results = await Promise.all([
      telegramRoute(request, pluginEnvContext),
      githubRoute(request, pluginEnvContext, executionCtx)
    ]);

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" },
    });
  },
};

async function initWorkerPluginContext(request: Request, env: Env) {
  const payload = (await request.clone().json()) as PluginInputs; // required cast
  const pluginEnvContext = new PluginEnvContext(payload, env);
  const botFatherInstance = await initializeBotFatherInstance(pluginEnvContext);
  if (!botFatherInstance) {
    throw new Error("BotFatherInstance not initialized");
  }
  pluginEnvContext.setBotFatherContext(botFatherInstance);
  return pluginEnvContext;
}

async function githubRoute(request: Request, pluginEnvCtx: PluginEnvContext, executionCtx?: ExecutionContext) {
  return createPlugin<Context>(
    (context) => {
      const ctx = context as unknown as Context;
      ctx.adapters = createAdapters(ctx);
      ctx.pluginEnvCtx = pluginEnvCtx;

      return runGithubWorkerEntry(ctx);
    },
    manifest as Manifest,
    {
      envSchema: envValidator.schema,
      postCommentOnError: true,
      settingsSchema: pluginSettingsValidator.schema,
      logLevel: "debug",
      kernelPublicKey: pluginEnvCtx.getEnv().KERNEL_PUBLIC_KEY,
      bypassSignatureVerification: process.env.NODE_ENV === "local",
    }
  ).fetch(request, pluginEnvCtx.getEnv(), executionCtx);
}

/**
 * This route handles updates directly from Telegram and so it's a separate route
 * because the payloads are different which would cause the SDK to throw an error.
 *
 * - This route is used for the Telegram bot commands like `/register` etc.
 *
 * Because the kernel is _not_ forwarding the payload, we need to rely on
 * `Value.Default` to populate the `env` and `config` properties.
 */
async function telegramRoute(request: Request, pluginEnvCtx: PluginEnvContext) {
  if (["/telegram", "/telegram/"].includes(new URL(request.url).pathname)) {
    try {
      return await runTelegramBotEntry(request, pluginEnvCtx)
    } catch (err) {
      logger.error("handleTelegramWebhook failed", { err });
      return handleUncaughtError(err);
    }
  }
}
