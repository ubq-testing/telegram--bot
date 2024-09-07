import { Context } from '#root/types/context.js';
import { TelegramClient } from 'telegram';
import { Api } from 'telegram/tl';
import { TelegramClientParams } from 'telegram/client/telegramBaseClient';
import dotenv from "dotenv";
import { StringSession } from 'telegram/sessions';
dotenv.config();

type Env = {
    TELEGRAM_API_HASH: string;
    TELEGRAM_APP_ID: number;
    BOT_TOKEN: string;
}

/**
 * This is a different client from the worker instance. This requires a Node
 * environment to run and is used to interact with the Telegram API as
 * opposed to just the Bot API that the worker instance uses.
 */
export class MtProtoSingleton {
    private static instance: MtProtoSingleton;
    private static client: TelegramClient;
    private static api: typeof Api;
    private static session: StringSession

    private constructor() { }

    static async initialize(env: Env, session: string) {
        if (!MtProtoSingleton.instance) {
            MtProtoSingleton.instance = new MtProtoSingleton();
            MtProtoSingleton.api = Api;
            MtProtoSingleton.session = new StringSession(session)
            MtProtoSingleton.client = await mtProtoInit(env, MtProtoSingleton.session);
        }
        return MtProtoSingleton.instance;
    }

    static getInstance(env: Env, session: string) {
        if (!MtProtoSingleton.instance) {
            return this.initialize(env, session)
        }
        return MtProtoSingleton.instance;
    }

    getClient() {
        return MtProtoSingleton.client;
    }

    getApi() {
        return MtProtoSingleton.api;
    }

    getSession() {
        return MtProtoSingleton.session;
    }

    saveSession() {
        return MtProtoSingleton.session.save();
    }
}

async function mtProtoInit(env: Env, session: StringSession) {
    const { TELEGRAM_API_HASH, TELEGRAM_APP_ID, BOT_TOKEN } = env

    if (!TELEGRAM_API_HASH || !TELEGRAM_APP_ID || !BOT_TOKEN) {
        throw new Error("Missing required environment variables for Telegram API")
    }
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
    return client;
}