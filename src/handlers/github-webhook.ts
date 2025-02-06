import { Value, ValueError } from "@sinclair/typebox/value";
import { plugin } from "../plugin";
import { pluginSettingsSchema, pluginSettingsValidator, PluginInputs, Env } from "../types";
import { logger } from "../utils/logger";

export async function handleGithubWebhook(request: Request, env: Env): Promise<Response> {
  let webhookPayload: PluginInputs;
  try {
    webhookPayload = (await request.json()) as PluginInputs;
    const parsedSettings = JSON.parse(webhookPayload.settings as unknown as string);
    const settings = Value.Decode(pluginSettingsSchema, Value.Default(pluginSettingsSchema, parsedSettings));

    if (!pluginSettingsValidator.test(settings)) {
      const errors: ValueError[] = [];
      for (const err of pluginSettingsValidator.errors(settings)) {
        errors.push(err);
      }
      return new Response(JSON.stringify({ error: logger.error(`Error: "Invalid settings provided."`, { errors }).logMessage.raw }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    webhookPayload.settings = settings;
  } catch (err) {
    logger.error("", { err: String(err) });
    throw new Error("Invalid payload provided");
  }

  try {
    await plugin(webhookPayload, env);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    logger.error("", { err: String(err) });
    throw new Error("Error processing the webhook payload");
  }
}
