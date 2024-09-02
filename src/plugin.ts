import { Env, PluginInputs } from "./types";
import { Context } from "./types";
import { PluginContext } from "./utils/plugin-context-single";
import { proxyCallbacks } from "./handlers/callbacks-proxy";
import { LogReturn } from "@ubiquity-dao/ubiquibot-logger";
import { addCommentToIssue } from "./handlers/github/utils/add-comment-to-issues";

export async function runPlugin(context: Context) {
  const { logger, eventName } = context;

  try {
    return proxyCallbacks(context)[eventName]
  } catch (err) {
    let errorMessage;
    if (err instanceof LogReturn) {
      errorMessage = err;
    } else if (err instanceof Error) {
      errorMessage = context.logger.error(err.message, { error: err });
    } else {
      errorMessage = context.logger.error("An error occurred", { err });
    }
    await addCommentToIssue(context, `${errorMessage?.logMessage.diff}\n<!--\n${sanitizeMetadata(errorMessage?.metadata)}\n-->`);
  }

  logger.error(`Unsupported event: ${eventName}`);
}


function sanitizeMetadata(obj: LogReturn["metadata"]): string {
  return JSON.stringify(obj, null, 2).replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/--/g, "&#45;&#45;");
}

/**
 * How a worker executes the plugin.
 */
export async function plugin(inputs: PluginInputs, env: Env) {
  PluginContext.initialize(inputs, env)
  const context = PluginContext.getInstance().getContext()
  const res = await runPlugin(context);
  return res;
}