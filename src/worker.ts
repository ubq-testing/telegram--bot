import { Context, Env, envValidator, PluginContextAndEnv, PluginInputs, pluginSettingsValidator } from "./types";
import { handleTelegramWebhook } from "./handlers/telegram-webhook";
import manifest from "../manifest.json";
import { PluginContext } from "./types/plugin-context-single";
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

    const payload = (await request.clone().json()) as PluginInputs; // required cast
    const envSettings = await initPluginContext(payload, env);

    await Promise.all([telegramRoute(request, envSettings), githubRoute(request, envSettings, executionCtx)]);

    return new Response("OK", { status: 200 });
  },
};

async function initPluginContext(payload: PluginInputs, env: Env): Promise<PluginContextAndEnv> {
  // the sdk parses the env but we need to pass it to the plugin context
  const envSettings = await decodeEnvSettings(env);
  let pluginCtx: PluginContext;

  try {
    pluginCtx = PluginContext.initialize(payload, envSettings);
  } catch (er) {
    throw handleUncaughtError(er);
  }

  return {
    pluginCtx,
    envSettings,
  }
}

/**
 * Plugins are required (I think) to use the SDK to interact with the kernel.
 *
 * Handles any github-sided events.
 */
async function githubRoute(request: Request, ctx_: PluginContextAndEnv, executionCtx?: ExecutionContext) {
  return createPlugin<Context>(
    (context) => {
      const ctx = context as unknown as Context;
      ctx.adapters = createAdapters(ctx);
      return runPlugin(ctx, ctx_.pluginCtx);
    },
    manifest as Manifest,
    {
      envSchema: envValidator.schema,
      postCommentOnError: true,
      settingsSchema: pluginSettingsValidator.schema,
      logLevel: "debug",
      kernelPublicKey: ctx_.envSettings.KERNEL_PUBLIC_KEY,
      bypassSignatureVerification: process.env.NODE_ENV === "local",
    }
  ).fetch(request, ctx_.envSettings, executionCtx);
}

/**
 * Afaik, the sdk does not support route handling out of the box and
 * so hybrids are required to handle routes manually.
 *
 * This route handles any Telegram-sided updates.
 */
async function telegramRoute(request: Request, ctx: PluginContextAndEnv) {
  if (["/telegram", "/telegram/"].includes(new URL(request.url).pathname)) {
    try {
      return await handleTelegramWebhook(request, ctx);
    } catch (err) {
      logger.error("handleTelegramWebhook failed", { err });
      return handleUncaughtError(err);
    }
  }
}
