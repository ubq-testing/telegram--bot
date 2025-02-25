import { Context } from "./types";
import { workerCallbacks } from "./github-handlers/worker-proxy";
import { proxyWorkflowCallbacks } from "./github-handlers/workflow-proxy";

export async function runGithubWorkerEntry(context: Context) {
  const { eventName } = context;
  await Promise.resolve(workerCallbacks(context)[eventName]);
}

export async function runGitHubWorkflowEntry(context: Context) {
  const { eventName } = context;
  await Promise.resolve(proxyWorkflowCallbacks(context)[eventName]);
}