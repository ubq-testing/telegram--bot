import { Context, SharedCtx } from "../types";
import { CallbackResult } from "../types/proxy";
import { workflowDispatch } from "./workflow-dispatch";

/**
 * The logic for this function can be found in [../bot/mtproto-api/workrooms/create-chat.ts](../bot/mtproto-api/workrooms/create-chat.ts)
 */
export async function createWorkroom(context: Context<"issues.assigned">, sharedCtx: SharedCtx): Promise<CallbackResult> {
  await workflowDispatch(context, "create-telegram-chat", sharedCtx.pluginCtx).catch(console.error);
  return { status: 200, reason: "workflow_dispatched" };
}
/**
 * The logic for this function can be found in [../bot/mtproto-api/workrooms/close-chat.ts](../bot/mtproto-api/workrooms/close-chat.ts)
 */
export async function closeWorkroom(context: Context<"issues.closed">, sharedCtx: SharedCtx): Promise<CallbackResult> {
  await workflowDispatch(context, "close-telegram-chat", sharedCtx.pluginCtx).catch(console.error);
  return { status: 200, reason: "workflow_dispatched" };
}

/**
 * The logic for this function can be found in [../bot/mtproto-api/workrooms/reopen-chat.ts](../bot/mtproto-api/workrooms/reopen-chat.ts)
 */
export async function reOpenWorkroom(context: Context<"issues.reopened">, sharedCtx: SharedCtx): Promise<CallbackResult> {
  await workflowDispatch(context, "reopen-telegram-chat", sharedCtx.pluginCtx).catch(console.error);
  return { status: 200, reason: "workflow_dispatched" };
}
