import { closeChat } from "#root/bot/mtproto-api/workrooms/close-chat.js";
import { createChat } from "#root/bot/mtproto-api/workrooms/create-chat.js";
import { reopenChat } from "#root/bot/mtproto-api/workrooms/reopen-chat.js";
import { ProxyCallbacks } from "#root/types/proxy.js";
import { Context, SupportedEventsU } from "../types";
import { handleCallback } from "./worker-proxy";

/**
 * These are function which get dispatched by this worker to fire off workflows
 * in the repository. We enter through the main `compute.yml` just like a typical
 * action plugin would, we forward the same payload that the worker received to
 * the workflow the same way that the kernel does.
 *
 * - First event fires, `issues.labeled` and the worker catches it.
 * - The worker then dispatches a workflow to `compute.yml` with the event name as the input.
 * - The workflow receives a `issues.labeled` payload and runs the `createChat` function.
 *
 * I.e we're essentially running the first dual action/worker plugin which is
 * ideal for telegram-bot as it's a bot that needs to be able to be super flexible.
 */
export const workflowCallbacks = {
  "issues.labeled": [createChat],
  "issues.closed": [closeChat],
  "issues.reopened": [reopenChat],
} as ProxyCallbacks;

export function proxyWorkflowCallbacks(context: Context): ProxyCallbacks {
  return new Proxy(workflowCallbacks, {
    get(target, prop: SupportedEventsU) {
      if (!target[prop]) {
        context.logger.info(`No callbacks found for event ${prop}`);
        return { status: 204, reason: "skipped" };
      }

      return (async () => {
        await Promise.all(target[prop].map((callback) => handleCallback(callback, context)));
        await exit(0);
      })();
    },
  });
}

/**
 * Workflows will hang if we don't force an exit here. We do not want
 * to end the session, logout or anything else. We just want the workflow
 * to perform it's action and then exit.
 *
 * 0 - Success
 * 1 - Failure
 */
async function exit(status: number = 0) {
  process.exit(status);
}
