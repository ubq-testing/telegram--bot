import { Value } from "@sinclair/typebox/value";
import { envValidator, Env } from "../types";
import { TelegramBotSingleton } from "#root/types/telegram-bot-single.js";
import { logger } from "#root/utils/logger.js";

export async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
  const isOk = envValidator.test(env);
  if (!isOk) {
    const errors = Array.from(envValidator.errors(env));
    logger.error(`Invalid bot env: `, { errors });
  }

  const settings = Value.Decode(envValidator.schema, Value.Default(envValidator.schema, env));

  const server = TelegramBotSingleton.getInstance().getServer();

  return server.fetch(request, settings);
}
