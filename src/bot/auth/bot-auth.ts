import { Context } from '#root/types/context.js';
import { PluginContext } from '#root/utils/plugin-context-single.js';
import { TelegramClient } from 'telegram';
import { Api } from 'telegram/tl';
import { MemorySession } from 'telegram/sessions';
import { TelegramClientParams, TelegramBaseClient } from 'telegram/client/telegramBaseClient';

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

import crypto from 'node:crypto';

async function mtProtoInit(env: Context["env"], api: typeof Api) {
    const crpytoFns = Object.keys(crypto);
    console.log("crypto functions", crpytoFns);
    try {
        const b = crypto.randomBytes(16);
        console.log("BBBB, ", b);
    } catch (error) {
        console.error('Error using crypto.getRandomValues:', error);
    }


    const { TELEGRAM_API_HASH, TELEGRAM_APP_ID, BOT_TOKEN } = env

    if (!TELEGRAM_API_HASH || !TELEGRAM_APP_ID || !BOT_TOKEN) {
        throw new Error("Missing required environment variables for Telegram API")
    }

    const session = new MemorySession();
    session.save();

    const osVersion = "Windows NT 11.0; Win64; x64";

    const clientParams: TelegramClientParams = {
        connectionRetries: 5,
        systemVersion: osVersion,
        appVersion: "1.0.0",
        deviceModel: "PC",
    }

    const client = new TelegramClient(
        session,
        TELEGRAM_APP_ID || 23868159,
        TELEGRAM_API_HASH,
        clientParams
    );
    client.invoke(new api.auth.ImportBotAuthorization({
        apiId: TELEGRAM_APP_ID || 23868159,
        apiHash: TELEGRAM_API_HASH,
        botAuthToken: BOT_TOKEN,
    }));

    await client.connect();

    // const me = await client.getMe();
    // console.log(`Logged in as ${me.username}`);

    // const dialogs = await client.getDialogs();
    // console.log(`You have ${dialogs.length} chats`);

    // const newGroup = await client.invoke(new api.messages.CreateChat({
    //     title: "New Group",
    //     users: [me.id],
    // }));

    // console.log(`Created new group: `, { newGroup });

    return client;
}