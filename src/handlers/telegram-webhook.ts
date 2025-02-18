import { SharedCtx } from "../types";
import { TelegramBotSingleton } from "../types/telegram-bot-single";
import { logger } from "../utils/logger";

export async function handleTelegramWebhook(request: Request, ctx: SharedCtx): Promise<Response> {
  const botInstance = await initializeBotInstance(ctx);

  if (botInstance) {
    ctx.bot = botInstance.getBot();
  }

  const { server } = getServerFromBot(botInstance);

  const res = await makeServerRequest(server, request, ctx);

  const body = await readResponseBody(res);

  const response = createResponse(res, body);

  return response;
}

async function initializeBotInstance(ctx: SharedCtx) {
  try {
    const botInstance = await TelegramBotSingleton.initialize(ctx);
    return botInstance;
  } catch (er) {
    const errorInfo = {
      message: "Error initializing TelegramBotSingleton",
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
    logger.error(errorInfo.message, { error: er as Error });
    return { server: null, bot: null };
  }
}

async function makeServerRequest(server: ReturnType<TelegramBotSingleton["getServer"]> | null, request: Request, ctx: SharedCtx): Promise<Response> {
  try {
    if (!server) {
      throw new Error("Server is null");
    }
    return await server.fetch(request, ctx.envSettings);
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
