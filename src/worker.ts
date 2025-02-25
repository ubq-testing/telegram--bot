import { Context, Env, envValidator, PluginInputs, pluginSettingsValidator } from "./types";
import { handleTelegramWebhook } from "./handlers/telegram-webhook";
import manifest from "../manifest.json";
import { PluginEnvContext } from "./types/plugin-env-context";
import { ExecutionContext } from "hono";
import { createPlugin } from "@ubiquity-os/plugin-sdk";
import { runPlugin } from "./plugin";
import { Manifest } from "@ubiquity-os/plugin-sdk/manifest";
import { decodeEnvSettings } from "./utils/env-parsing";
import { logger } from "./utils/logger";
import { handleUncaughtError } from "./utils/errors";
import { createAdapters } from "./adapters";

export default {
  async fetch(request: Request, env: Env, executionCtx?: ExecutionContext) {
    // The SDK handles this but it's cleaner if we handle it here
    if (new URL(request.url).pathname === "/manifest.json") {
      return new Response(JSON.stringify(manifest), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const envSettings = await initPluginContext(request, env);

    await Promise.all([telegramRoute(request, envSettings), githubRoute(request, envSettings, executionCtx)]);

    return new Response("OK", { status: 200 });
  },
};

async function initPluginContext(request: Request, env: Env) {
  const payload = (await request.clone().json()) as PluginInputs; // required cast
  const envSettings = await decodeEnvSettings(env);
  let pluginEnvCtx: PluginEnvContext;

  try {
    pluginEnvCtx = new PluginEnvContext(payload, envSettings);
  } catch (er) {
    throw handleUncaughtError(er);
  }

  return pluginEnvCtx;
}

/**
 * This route handles any GitHub-sided updates which the kernel sends.
 *
 * - `issues.assigned` => kernel sends webhook to the worker > worker fires off the action
 *
 * Any requests passing through here need to conform to [`input-schema`](https://github.com/ubiquity-os/plugin-sdk/blob/development/src/types/input-schema.ts#L5)
 * otherwise the SDK will throw an error `Invalid Body`.
 */
async function githubRoute(request: Request, pluginEnvCtx: PluginEnvContext, executionCtx?: ExecutionContext) {
  return createPlugin<Context>(
    (context) => {
      const ctx = context as unknown as Context;
      ctx.adapters = createAdapters(ctx);
      ctx.pluginEnvCtx = pluginEnvCtx;
      return runPlugin(ctx);
    },
    manifest as Manifest,
    {
      envSchema: envValidator.schema,
      postCommentOnError: true,
      settingsSchema: pluginSettingsValidator.schema,
      logLevel: "debug",
      kernelPublicKey: pluginEnvCtx.env.KERNEL_PUBLIC_KEY,
      bypassSignatureVerification: process.env.NODE_ENV === "local",
    }
  ).fetch(request, pluginEnvCtx.env, executionCtx);
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
      return await handleTelegramWebhook(request, pluginEnvCtx);
    } catch (err) {
      logger.error("handleTelegramWebhook failed", { err });
      return handleUncaughtError(err);
    }
  }
}
