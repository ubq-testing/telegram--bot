import { Update } from "@grammyjs/types";
import { Context } from "./context";
import { PluginInputs } from "./plugin-inputs";

export function isIssueOpenedEvent(context: Context): context is Context<"issues.opened"> {
  return context.eventName === "issues.opened";
}

export function isTelegramPayload(payload: any): payload is Update {
  try {
    return payload.update_id !== undefined;
  } catch (e) {
    return false;
  }
}

export function isGithubPayload(inputs: any): inputs is PluginInputs {
  try {
    return inputs.eventName !== undefined
  } catch (e) {
    return false;
  }
}
