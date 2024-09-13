import { GrammyTelegramUpdate } from "#root/bot/helpers/grammy-context.js";
import { PluginInputs } from "./plugin-inputs";

export function isTelegramPayload(payload: unknown): payload is GrammyTelegramUpdate {
  if (typeof payload !== "object" || !payload) return false;
  return "update_id" in payload && payload.update_id !== undefined;
}

export function isGithubPayload(inputs: unknown): inputs is PluginInputs {
  if (typeof inputs !== "object" || !inputs) return false;
  return "eventName" in inputs && inputs.eventName !== undefined;
}
