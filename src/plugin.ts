import { Context } from "./types";
import { workerCallbacks } from "./github-handlers/worker-proxy";
import { proxyWorkflowCallbacks } from "./github-handlers/workflow-proxy";
import { sendBotFatherRequest } from "./botfather-bot/send-botfather-request";
import { PluginEnvContext } from "./types/plugin-env-context";

export async function runGithubWorkerEntry(context: Context) {
  const { eventName } = context;
  await Promise.resolve(workerCallbacks(context)[eventName]);
}

export async function runGitHubWorkflowEntry(context: Context) {
  const { eventName } = context;
  await Promise.resolve(proxyWorkflowCallbacks(context)[eventName]);
}

export async function runTelegramBotEntry(request: Request, pluginEnvCtx: PluginEnvContext) {
  return await sendBotFatherRequest(request, pluginEnvCtx);
}
