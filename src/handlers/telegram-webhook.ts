import { Env } from "../types";
import { TelegramBotSingleton } from "../types/telegram-bot-single";
import { logger } from "../utils/logger";

export async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
  const failures: unknown[] = [];
  // Initialize bot instance
  const botInstance = await initializeBotInstance(env, failures);

  // Get server and bot from botInstance
  const { server } = getServerFromBot(botInstance, failures);

  // Make server request even if server is null to collect all failures
  const res = await makeServerRequest(server, request, env, failures);

  // Read response body even if res is null to collect all failures
  const body = await readResponseBody(res, failures);

  // Create final response
  const response = createResponse(res, body, failures);

  return response;
}

async function initializeBotInstance(env: Env, failures: unknown[]) {
  try {
    const botInstance = await TelegramBotSingleton.initialize(env);
    return botInstance;
  } catch (er) {
    const errorInfo = {
      message: "Error initializing TelegramBotSingleton",
      error: er instanceof Error ? er.message : String(er),
      stack: er instanceof Error ? er.stack : undefined,
    };
    failures.push(errorInfo);
    logger.error(errorInfo.message, { error: er as Error });
    return null;
  }
}

function getServerFromBot(botInstance: TelegramBotSingleton | null, failures: unknown[]) {
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
    failures.push(errorInfo);
    logger.error(errorInfo.message, { error: er as Error });
    return { server: null, bot: null };
  }
}

async function makeServerRequest(
  server: ReturnType<TelegramBotSingleton["getServer"]> | null,
  request: Request,
  env: Env,
  failures: unknown[]
): Promise<Response> {
  try {
    if (!server) {
      throw new Error("Server is null");
    }
    return await server.fetch(request, env);
  } catch (er) {
    const errorInfo = {
      message: "Error fetching request from hono server",
      error: er instanceof Error ? er.message : String(er),
      stack: er instanceof Error ? er.stack : undefined,
    };
    failures.push(errorInfo);
    logger.error(errorInfo.message, { error: er as Error });
    return new Response("Internal Server Error", { status: 500 });
  }
}

async function readResponseBody(res: Response, failures: unknown[]): Promise<string> {
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
    failures.push(errorInfo);
    logger.error(errorInfo.message, { error: er as Error });
    return "";
  }
}

function createResponse(res: Response, body: string, failures: unknown[]): Response {
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
    failures.push(errorInfo);
    logger.error(errorInfo.message, { error: er as Error });
    return new Response("Internal Server Error", { status: 500 });
  }
}
