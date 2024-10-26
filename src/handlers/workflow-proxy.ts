import { closeChat } from "../bot/mtproto-api/workrooms/close-chat";
import { createChat } from "../bot/mtproto-api/workrooms/create-chat";
import { reopenChat } from "../bot/mtproto-api/workrooms/reopen-chat";
import { Context, SupportedEventsU } from "../types";
import { ProxyCallbacks } from "../types/proxy";
import { handleCallback } from "./worker-proxy";

/**
 * These functions are run via workflow triggers. They can only run
 * if this plugin is defined in `ubiquibot-config.yml` pointing to the workflow URL,
 * see the README for more information on how to set this up.
 */
export const workflowCallbacks = {
  "issues.closed": [closeChat],
  "issues.reopened": [reopenChat],
  "issues.assigned": [createChat],
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
