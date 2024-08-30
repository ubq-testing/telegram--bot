import { Value } from "@sinclair/typebox/value";
import { Env, envValidator } from "../types";
import { Bot, createBot } from "../bot";
import { createServer } from "../server";
import { logger } from "../logger";

export class TelegramBotSingleton {
    private static instance: TelegramBotSingleton;
    private static bot: Bot;
    private static server: ReturnType<typeof createServer>;

    private constructor(
    ) { }

    static initialize(env: Env): TelegramBotSingleton {
        if (!TelegramBotSingleton.instance) {
            TelegramBotSingleton.instance = new TelegramBotSingleton();
            TelegramBotSingleton.bot = createBot(env.BOT_TOKEN, {
                config: Value.Decode(envValidator.schema, Value.Default(envValidator.schema, env)),
                logger,
            });
            TelegramBotSingleton.server = createServer({
                bot: TelegramBotSingleton.bot,
                config: Value.Decode(envValidator.schema, Value.Default(envValidator.schema, env)),
                logger
            });
        }
        return TelegramBotSingleton.instance;
    }

    static getInstance(): TelegramBotSingleton {
        if (!TelegramBotSingleton.instance) {
            throw new Error("TelegramBotSingleton is not initialized. Call initialize() first.");
        }
        return TelegramBotSingleton.instance;
    }

    getBot(): Bot {
        return TelegramBotSingleton.bot;
    }

    getServer(): ReturnType<typeof createServer> {
        return TelegramBotSingleton.server;
    }

}
