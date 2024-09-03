import { Update } from "@grammyjs/types";
import { Context } from "./context";
import { PluginInputs } from "./plugin-inputs";
import { WORKFLOW_FUNCTIONS } from "../workflow-functions";

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


export function isIssueLabeledEvent(context: Context): context is Context<"issues.labeled"> {
  return context.eventName === "issues.labeled";
}

export function isWorkflowFunction(event: string): event is keyof typeof WORKFLOW_FUNCTIONS {
  return Object.keys(WORKFLOW_FUNCTIONS).includes(event);
}