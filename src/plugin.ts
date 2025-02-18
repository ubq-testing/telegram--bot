import { Context } from "./types";
import { proxyCallbacks } from "./handlers/worker-proxy";
import { TelegramBotSingleton } from "./types/telegram-bot-single";
import { PluginContext } from "./types/plugin-context-single";

export async function runPlugin(context: Context, pluginCtx: PluginContext) {
  const { eventName } = context;
  const bot = (await TelegramBotSingleton.initialize({ envSettings: context.env, pluginCtx })).getBot()
  await Promise.resolve(proxyCallbacks(context, { bot, pluginCtx })[eventName]);
}
