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

export class BaseMtProto {
    // @ts-expect-error properties not defined in constructor, not required in baseclass
    _client: TelegramClient; _api: typeof Api;
    _session: StringSession | null = null;

    async initialize(env: Env, session: string) {
        this._api = Api;
        this._session = new StringSession(session)
        this._client = await this.mtProtoInit(env, this._session);
    }

    get api() {
        return this._api;
    }

    get client() {
        return this._client;
    }

    get session() {
        return this._session;
    }

    private async mtProtoInit(env: Env, session: StringSession) {
        const { TELEGRAM_API_HASH, TELEGRAM_APP_ID } = env

        if (!TELEGRAM_API_HASH || !TELEGRAM_APP_ID) {
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
}

