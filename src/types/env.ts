import { Type as T } from "@sinclair/typebox";
import { StaticDecode } from "@sinclair/typebox";
import "dotenv/config";
import { StandardValidator } from "typebox-validators";

/**
 * We can restrict which updates the BotFather bot will receive.
 */
const allowedUpdates = T.Object({
  message: T.String(),
  poll: T.String(),
  edited_message: T.String(),
  channel_post: T.String(),
  edited_channel_post: T.String(),
  business_connection: T.String(),
  business_message: T.String(),
  edited_business_message: T.String(),
  deleted_business_messages: T.String(),
  message_reaction_count: T.String(),
});

const botSettings = T.Object({
  /**
   * The token for the bot given by the BotFather.
   */
  TELEGRAM_BOT_TOKEN: T.String(),
  /**
   * The url to forward updates to.
   */
  TELEGRAM_BOT_WEBHOOK: T.String(),
  /**
   * The secret to use when forwarding updates.
   */
  TELEGRAM_BOT_WEBHOOK_SECRET: T.String(),
  /**
   * Ids of the users who are allowed to use admin commands.
   */
  TELEGRAM_BOT_ADMINS: T.Transform(T.Unknown())
    .Decode((str) => (Array.isArray(str) ? str.map(Number) : [Number(str)]))
    .Encode((arr) => arr.toString()),
  /**
   * Which updates the bot should receive, defaults to all.
   */
  ALLOWED_UPDATES: T.Optional(T.Array(T.Enum(allowedUpdates))),
});

const mtProtoSettings = T.Object({
  /**
   * Obtained from https://my.telegram.org/apps
   */
  TELEGRAM_APP_ID: T.Transform(T.Union([T.String(), T.Number()]))
    .Decode((str) => Number(str))
    .Encode((num) => num.toString()),
  /**
   * Obtained from https://my.telegram.org/apps
   */
  TELEGRAM_API_HASH: T.String(),
});

const ubiquityOsSettings = T.Object({
  /**
   * Your UbiquityOS app id
   */
  APP_ID: T.Transform(T.Unknown())
    .Decode((str) => Number(str))
    .Encode((num) => num.toString()),
  /**
   * Your UbiquityOS private key
   */
  APP_PRIVATE_KEY: T.Transform(T.Unknown())
    .Decode((str) => String(str))
    .Encode((str) => str),
});

const storageSettings = T.Object({
  /**
   * The supabase instance url for storing chats, sessions, etc.
   */
  SUPABASE_URL: T.String(),
  /**
   * The supabase service key for storing chats, sessions, etc.
   */
  SUPABASE_SERVICE_KEY: T.String(),
});

const TELEGRAM_BOT_ENV = T.Object({
  botSettings,
  mtProtoSettings,
  ubiquityOsSettings,
  storageSettings,
});

export const env = T.Object({
  TELEGRAM_BOT_ENV: T.Transform(T.Union([T.String(), TELEGRAM_BOT_ENV]))
    .Decode((str) => {
      if (typeof str === "string") {
        const obj = JSON.parse(str) as StaticDecode<typeof TELEGRAM_BOT_ENV>;

        if (!obj.botSettings || !obj.mtProtoSettings || !obj.ubiquityOsSettings || !obj.storageSettings) {
          throw new Error("Missing required environment variables for Telegram Bot settings");
        }
        return obj;
      }
      return str;
    })
    .Encode((obj) => JSON.stringify(obj)),
});

export type Env = StaticDecode<typeof env>;
export const envValidator = new StandardValidator(env);
