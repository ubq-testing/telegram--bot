import { PluginContext } from "../types/plugin-context-single";
import { TelegramBotSingleton } from "../types/telegram-bot-single";
import { logger } from "../utils/logger";

export async function handleTelegramWebhook(request: Request, pluginCtx: PluginContext): Promise<Response> {
  const botInstance = await initializeBotInstance(pluginCtx);

  if (botInstance) {
    pluginCtx._bot = botInstance.getBot();
  }

  const { server } = getServerFromBot(botInstance);

  const res = await makeServerRequest(server, request, pluginCtx);

  const body = await readResponseBody(res);

  const response = createResponse(res, body);

  return response;
}

async function initializeBotInstance(pluginCtx: PluginContext) {
  try {
    return await TelegramBotSingleton.initialize(pluginCtx);
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

function getServerFromBot(botInstance: TelegramBotSingleton | null) {
  try {
    const server = botInstance?.getServer();
    const bot = botInstance?.getBot();
    if (!server || !bot) {
      throw new Error("Server or bot is undefined");
    }
    return { server, bot };
  } catch (er) {
    const errorInfo = {
      message: "Error getting server from bot",
      error: er instanceof Error ? er.message : String(er),
      stack: er instanceof Error ? er.stack : undefined,
    };
    logger.error(errorInfo.message, { error: er as Error, botInstance });
    return { server: null, bot: null };
  }
}

async function makeServerRequest(server: ReturnType<TelegramBotSingleton["getServer"]> | null, request: Request, pluginCtx: PluginContext): Promise<Response> {
  try {
    if (!server) {
      throw new Error("Server is null");
    }
    return await server.fetch(request, pluginCtx.env);
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
