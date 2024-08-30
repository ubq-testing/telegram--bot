import { Env, PluginInputs } from "./types";
import { Context } from "./types";
import { isIssueOpenedEvent } from "./types/typeguards";
import { createChatroom } from "./handlers/github/workrooms";
import { PluginContext } from "./utils/plugin-context-single";

/**
 * The main plugin function. Split for easier testing.
 */
export async function runPlugin(context: Context) {
  const { logger, eventName } = context;

  if (isIssueOpenedEvent(context)) {
    return await createChatroom(context);
  }

  logger.error(`Unsupported event: ${eventName}`);
}

/**
 * How a worker executes the plugin.
 */
export async function plugin(inputs: PluginInputs, env: Env) {
  PluginContext.initialize(inputs, env)
  const context: Context = PluginContext.getInstance().getContext()
  return runPlugin(context);
}