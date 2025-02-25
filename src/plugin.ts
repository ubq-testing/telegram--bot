import { Context } from "./types";
import { proxyCallbacks } from "./github-handlers/worker-proxy";

export async function runPlugin(context: Context) {
  const { eventName } = context;
  await Promise.resolve(proxyCallbacks(context)[eventName]);
}
