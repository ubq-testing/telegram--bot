import { Context, Env } from "./types";
import { proxyCallbacks } from "./handlers/worker-proxy";
import { PluginContext } from "./types/plugin-context-single";
import { Bot } from "./bot";

export async function runPlugin(context: Context, pluginCtx: PluginContext) {
  const { eventName } = context;
  await Promise.resolve(proxyCallbacks(context, { pluginCtx, bot: {} as Bot, envSettings: {} as Env })[eventName]);
}
