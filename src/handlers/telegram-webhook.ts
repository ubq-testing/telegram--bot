import { Env } from "../types";
import { TelegramBotSingleton } from "../types/telegram-bot-single";
import { logger } from "../utils/logger";

export async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
  const failures: unknown[] = [];
  logger.info("Handling telegram webhook request", { request });

  // Initialize bot instance
  const botInstance = await initializeBotInstance(env, failures);

  // Get server and bot from botInstance
  const { server, bot } = getServerFromBot(botInstance, failures);

  // Make server request even if server is null to collect all failures
  const res = await makeServerRequest(server, request, env, failures);

  // Read response body even if res is null to collect all failures
  const body = await readResponseBody(res, failures);

  // Create final response
  const response = createResponse(res, body, failures);

  // Try to send error messages if any
  await sendErrorMessages(bot, env, failures);

  return response;
}

async function initializeBotInstance(env: Env, failures: unknown[]) {
  try {
    const botInstance = await TelegramBotSingleton.initialize(env);
    logger.info("Initialized TelegramBotSingleton");
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
    logger.info("Getting server from bot");
    const server = botInstance?.getServer();
    const bot = botInstance?.getBot();
    if (!server || !bot) {
      throw new Error("Server or bot is undefined");
    }
    logger.info("Got server from bot");
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
    logger.info("Making hono server request");
    const res = await server.fetch(request, env);
    logger.info("Hono server request made", { res });
    return res;
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
    logger.info("Response from hono server", { body });
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
    logger.info("Creating response from hono server", { status, statusText, headers });
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

async function sendErrorMessages(bot: ReturnType<TelegramBotSingleton["getBot"]> | null, env: Env, failures: unknown[]): Promise<void> {
  if (failures.length) {
    const errorMessage = failures.map((failure, index) => `Error ${index + 1}:\n${JSON.stringify(failure, null, 2)}`).join("\n\n");
    try {
      await bot?.api.sendMessage(env.TELEGRAM_BOT_ENV.botSettings.TELEGRAM_BOT_ADMINS[0], `Error handling webhook request:\n\n${errorMessage}`);
    } catch (er) {
      logger.error("Error sending error message to admin", { er });
    }
  }
}
