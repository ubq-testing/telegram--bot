import { Context } from '#root/types/context.js';
import { TelegramClient } from 'telegram';
import { Api } from 'telegram/tl';
import { MemorySession } from 'telegram/sessions';
import { TelegramClientParams } from 'telegram/client/telegramBaseClient';

/**
 * This is a different client from the worker instance. This requires a Node
 * environment to run and is used to interact with the Telegram API as
 * opposed to just the Bot API that the worker instance uses.
 */
export class MtProtoSingleton {
    private static instance: MtProtoSingleton;
    private static client: TelegramClient;
    private static api: typeof Api;

    private constructor() { }

    static async initialize(env: Context["env"]) {
        if (!MtProtoSingleton.instance) {
            MtProtoSingleton.instance = new MtProtoSingleton();
            MtProtoSingleton.api = Api;
            MtProtoSingleton.client = await mtProtoInit(env, MtProtoSingleton.api);
        }
        return MtProtoSingleton.instance;
    }

    static getInstance(env: Context["env"]) {
        if (!MtProtoSingleton.instance) {
            return this.initialize(env)
        }
        return MtProtoSingleton.instance;
    }

    getClient() {
        return MtProtoSingleton.client;
    }

    getApi() {
        return MtProtoSingleton.api;
    }
}

async function mtProtoInit(env: Context["env"], api: typeof Api) {
    const { TELEGRAM_API_HASH, TELEGRAM_APP_ID, BOT_TOKEN } = env

    if (!TELEGRAM_API_HASH || !TELEGRAM_APP_ID || !BOT_TOKEN) {
        throw new Error("Missing required environment variables for Telegram API")
    }

    const session = new MemorySession();
    session.save();

    const clientParams: TelegramClientParams = {
        connectionRetries: 5,
    }

    const client = new TelegramClient(
        session,
        TELEGRAM_APP_ID,
        TELEGRAM_API_HASH,
        clientParams
    );
    await client.connect();

    client.invoke(new api.auth.ImportBotAuthorization({
        apiId: TELEGRAM_APP_ID,
        apiHash: TELEGRAM_API_HASH,
        botAuthToken: BOT_TOKEN,
    }));


    return client;
}