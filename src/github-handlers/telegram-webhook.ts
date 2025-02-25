import { PluginEnvContext } from "../types/plugin-env-context";
import { BotFatherInitializer } from "../types/botfather-initializer";
import { logger } from "../utils/logger";

export async function handleTelegramWebhook(request: Request, pluginEnvCtx: PluginEnvContext): Promise<Response> {
  const botFatherInstance = await initializeBotFatherInstance(pluginEnvCtx);

  if (botFatherInstance) {
    const res = await makeServerRequest(botFatherInstance.server, request, pluginEnvCtx);
    const body = await readResponseBody(res);
    return createResponse(res, body);
  }

  return new Response("Internal Server Error", { status: 500 });
}

export async function initializeBotFatherInstance(pluginEnvCtx: PluginEnvContext) {
  try {
    return await (new BotFatherInitializer(pluginEnvCtx)).initialize();
  } catch (er) {
    const errorInfo = {
      message: "initializeBotInstance Error",
      error: er instanceof Error ? er.message : String(er),
      stack: er instanceof Error ? er.stack : undefined,
    };
    logger.error(errorInfo.message, { error: er as Error });
    return null;
  }
}

async function makeServerRequest(
  server: BotFatherInitializer["_server"],
  request: Request,
  pluginEnvCtx: PluginEnvContext
): Promise<Response> {
  if (!server) {
    throw new Error("Server is null");
  }
  try {
    return await server.fetch(request, pluginEnvCtx.getEnv());
  } catch (er) {
    const errorInfo = {
      message: "Error fetching request from hono server",
      error: er instanceof Error ? er.message : String(er),
      stack: er instanceof Error ? er.stack : undefined,
    };
    logger.error(errorInfo.message, { error: er as Error });
    return new Response("Internal Server Error", { status: 500 });
  }
}

async function readResponseBody(res: Response): Promise<string> {
  let body;
  try {
    body = await res.text();
  } catch (er) {
    logger.error("Error reading .text() from hono server", { er });
  }

  try {
    return typeof body === "string" ? body : JSON.stringify(body);
  } catch (er) {
    const errorInfo = {
      message: "Error reading response from hono server",
      error: er instanceof Error ? er.message : String(er),
      stack: er instanceof Error ? er.stack : undefined,
    };
    logger.error(errorInfo.message, { error: er as Error });
    return "";
  }
}

function createResponse(res: Response, body: string): Response {
  try {
    if (!res) {
      throw new Error("Response is null");
    }
    const { status, statusText, headers } = res;
    return new Response(body, { status, statusText, headers });
  } catch (er) {
    const errorInfo = {
      message: "Error creating response from hono server",
      error: er instanceof Error ? er.message : String(er),
      stack: er instanceof Error ? er.stack : undefined,
    };
    logger.error(errorInfo.message, { error: er as Error });
    return new Response("Internal Server Error", { status: 500 });
  }
}
