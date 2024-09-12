import { CallbackResult } from "#root/types/proxy.js";
import { Context, SupportedEvents } from "../types";
import { repositoryDispatch } from "./repository-dispatch";

/**
 * It is expected that these workflows being dispatched are in the same repository
 * as the worker.
 *
 * Each workflow enters through `compute.yml` like a typical action plugin with
 * the worker forwarding the payload to the appropriate workflow event handler.
 *
 * The workflow instance has access and more privileges than the worker instance
 * because it is connected through the MTProto API vs the Bot rest API.
 *
 * Consider the following:
 *
 * - The worker is a bot that can only perform actions that are allowed by the
 *   Telegram Bot API.
 *
 * - The workflow is a personal user account that can perform any action that is
 *   allowed by the Telegram API.
 *
 * - If the worker needs to perform an action that is not allowed by the Bot API,
 *   it should dispatch a workflow to perform the action instead.
 */

/**
 * The logic for this function can be found in [../bot/mtproto-api/workrooms/create-chat.ts](../bot/mtproto-api/workrooms/create-chat.ts)
 */
export async function createWorkroom(context: Context<"issues.labeled", SupportedEvents["issues.labeled"]>): Promise<CallbackResult> {
  await repositoryDispatch(context, "create-telegram-chat").catch(console.error);
  return { status: 200, reason: "workflow_dispatched" };
}
/**
 * The logic for this function can be found in [../bot/mtproto-api/workrooms/close-chat.ts](../bot/mtproto-api/workrooms/close-chat.ts)
 */
export async function closeWorkroom(context: Context<"issues.closed", SupportedEvents["issues.closed"]>): Promise<CallbackResult> {
  await repositoryDispatch(context, "close-telegram-chat").catch(console.error);
  return { status: 200, reason: "workflow_dispatched" };
}

/**
 * The logic for this function can be found in [../bot/mtproto-api/workrooms/reopen-chat.ts](../bot/mtproto-api/workrooms/reopen-chat.ts)
 */
export async function reOpenWorkroom(context: Context<"issues.reopened", SupportedEvents["issues.reopened"]>): Promise<CallbackResult> {
  await repositoryDispatch(context, "reopen-telegram-chat").catch(console.error);
  return { status: 200, reason: "workflow_dispatched" };
}
