import { Update } from "@grammyjs/types";
import { Context } from "./context";
import { PluginInputs } from "./plugin-inputs";

export function isIssueOpenedEvent(context: Context): context is Context<"issues.opened"> {
  return context.eventName === "issues.opened";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isTelegramPayload(payload: any): payload is Update {
  try {
    return payload.update_id !== undefined;
  } catch {
    return false;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isGithubPayload(inputs: any): inputs is PluginInputs {
  try {
    return inputs.eventName !== undefined;
  } catch {
    return false;
  }
}

export function isIssueLabeledEvent(context: Context): context is Context<"issues.labeled"> {
  return context.eventName === "issues.labeled";
}
