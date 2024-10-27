import { Env, PluginInputs } from "./types";
import { Context } from "./types";
import { PluginContext } from "./types/plugin-context-single";
import { proxyCallbacks } from "./handlers/worker-proxy";

export async function runPlugin(context: Context) {
  const { eventName } = context;
  return proxyCallbacks(context)[eventName];
}

export async function plugin(inputs: PluginInputs, env: Env) {
  const context = await PluginContext.initialize(inputs, env).getContext();
  return await runPlugin(context);
}
