import { Context } from "../types";
import { CallbackResult } from "../types/proxy";
import { workflowDispatch } from "./workflow-dispatch";

/**
 * Should only be called by the worker-proxy.
 *
 * The logic for this function can be found in [../workflow-bot-mtproto-api/workrooms/create-chat.ts](../workflow-bot-mtproto-api/workrooms/create-chat.ts)
 */
export async function createWorkroom(context: Context<"issues.assigned">): Promise<CallbackResult> {
  await workflowDispatch(context, "create-telegram-chat").catch(console.error);
  return { status: 200, reason: "workflow_dispatched" };
}
/**
 * Should only be called by the worker-proxy.
 *
 * The logic for this function can be found in [../workflow-bot-mtproto-api/workrooms/close-chat.ts](../workflow-bot-mtproto-api/workrooms/close-chat.ts)
 */
export async function closeWorkroom(context: Context<"issues.closed">): Promise<CallbackResult> {
  await workflowDispatch(context, "close-telegram-chat").catch(console.error);
  return { status: 200, reason: "workflow_dispatched" };
}

/**
 * Should only be called by the worker-proxy.
 *
 * The logic for this function can be found in [../workflow-bot-mtproto-api/workrooms/reopen-chat.ts](../workflow-bot-mtproto-api/workrooms/reopen-chat.ts)
 */
export async function reOpenWorkroom(context: Context<"issues.reopened">): Promise<CallbackResult> {
  await workflowDispatch(context, "reopen-telegram-chat").catch(console.error);
  return { status: 200, reason: "workflow_dispatched" };
}
