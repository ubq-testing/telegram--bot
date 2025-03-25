import { TelegramClient } from "telegram";
import { Api } from "telegram/tl";
import { TelegramClientParams } from "telegram/client/telegramBaseClient";
import { StringSession } from "telegram/sessions";
import { Context } from "../../types";
import CryptoJS from "crypto-js";
import dotenv from "dotenv";
dotenv.config();

/**
 * @dev Not abstract because we need it to be instantiated for sms-auth
 *
 * Base class for initializing the Telegram client and API used for
 * handling the sms-auth aspect of configuring the bot.
 */
export class BaseMtProto {
  // @ts-expect-error properties not defined in constructor, not required in baseclass
  private _client: TelegramClient;
  private _api: typeof Api = Api;
  private _session: StringSession | null = null;

  async initialize(env: Context["env"], session?: string) {
    this._api = Api;
    const sessionString = session ?? this._decrypt(env.APP_PRIVATE_KEY, session);
    this._session = new StringSession(sessionString);
    this._client = await this._mtProtoInit(env.TELEGRAM_BOT_ENV.mtProtoSettings, this._session);

    return {
      client: this.getMtProtoClient(),
      api: this.getMtProtoApi(),
    };
  }

  getMtProtoClient() {
    return this._client;
  }

  getMtProtoApi() {
    return this._api;
  }

  getStringSessionObject() {
    if (!this._session) {
      throw new Error("Session object is not initialized");
    }
    return this._session;
  }

  private async _mtProtoInit(env: Context["env"]["TELEGRAM_BOT_ENV"]["mtProtoSettings"], session: StringSession) {
    const { TELEGRAM_API_HASH, TELEGRAM_APP_ID } = env;

    if (!TELEGRAM_API_HASH || !TELEGRAM_APP_ID) {
      throw new Error("Missing required environment variables for Telegram API");
    }
    const clientParams: TelegramClientParams = {
      connectionRetries: 5,
    };

    const client = new TelegramClient(session ?? "", TELEGRAM_APP_ID, TELEGRAM_API_HASH, clientParams);
    await client.connect();
    return client;
  }

  private _decrypt(privateKey: string, text?: string): string {
    if (!text) {
      return "";
    }
    return CryptoJS.AES.decrypt(text, privateKey).toString(CryptoJS.enc.Utf8);
  }
}
