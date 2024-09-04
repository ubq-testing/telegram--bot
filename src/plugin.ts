import { Env, PluginInputs } from "./types";
import { Context } from "./types";
import { PluginContext } from "./utils/plugin-context-single";
import { proxyCallbacks } from "./handlers/callbacks-proxy";
import { bubbleUpErrorComment, sanitizeMetadata } from "./utils/errors";

export async function runPlugin(context: Context) {
  const { eventName } = context;

  try {
    return proxyCallbacks(context)[eventName]
  } catch (err) {
    return bubbleUpErrorComment(context, err)
  }
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