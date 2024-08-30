import { Value } from "@sinclair/typebox/value";
import { envValidator, Env } from "../../types";
import { TelegramBotSingleton } from "#root/utils/telegram-bot-single.js";

export async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
    const result = envValidator.test(env);
    if (!result) {
        const errors = Array.from(envValidator.errors(env));
        console.error(`Invalid tg bot env: `, errors);
    }
    const settings = Value.Decode(envValidator.schema, Value.Default(envValidator.schema, env));

    const server = TelegramBotSingleton.getInstance().getServer();

    return server.fetch(request, settings);
}