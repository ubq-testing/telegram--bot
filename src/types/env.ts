import { Type as T } from "@sinclair/typebox";
import { StaticDecode } from "@sinclair/typebox";
import "dotenv/config";
import { StandardValidator } from "typebox-validators";

/**
 * We can restrict which updates the BotFather bot will receive.
 */

const allowedUpdates = {
  message: "message",
  poll: "poll",
  edited_message: "edited_message",
  channel_post: "channel_post",
  edited_channel_post: "edited_channel_post",
  business_connection: "business_connection",
  business_message: "business_message",
  edited_business_message: "edited_business_message",
  deleted_business_messages: "deleted_business_messages",
  message_reaction_count: "message_reaction_count",
} as const;

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
  TELEGRAM_APP_ID: T.Number(),
  /**
   * Obtained from https://my.telegram.org/apps
   */
  TELEGRAM_API_HASH: T.String(),
});

const workflowFunctions = T.Object(
  {
    SOURCE_REPOSITORY: T.String({ description: "The repository where the workflow functions are located." }),
    SOURCE_REPO_OWNER: T.String({ description: "The owner of the repository where the workflow functions are located." }),
    TARGET_BRANCH: T.String({ description: "The target branch for the workflow functions." }),
  },
  {
    description: "Self-dispatched workflow settings. Forks need to target themselves.",
    default: { SOURCE_REPOSITORY: "ubiquity-os-kernel-telegram", SOURCE_REPO_OWNER: "ubiquity-os-marketplace", TARGET_BRANCH: "development" },
  }
);

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
  storageSettings,
  workflowFunctions,
});

const botEnvValidator = new StandardValidator(TELEGRAM_BOT_ENV);

export const env = T.Object({
  TELEGRAM_BOT_ENV: T.Transform(T.Union([T.String(), TELEGRAM_BOT_ENV]))
    .Decode((str) => {
      if (typeof str === "string") {
        const obj = JSON.parse(str) as StaticDecode<typeof TELEGRAM_BOT_ENV>;

        if (!botEnvValidator.test(obj)) {
          throw new Error("Invalid TELEGRAM_BOT_ENV");
        }

        return obj;
      }
      return str;
    })
    .Encode((obj) => JSON.stringify(obj)),
  APP_ID: T.String(),
  APP_PRIVATE_KEY: T.String(),
  TEMP_SAFE_PAT: T.Optional(T.String()),
  OPENAI_API_KEY: T.Optional(T.String()),
  OPENROUTER_API_KEY: T.Optional(T.String()),
  VOYAGEAI_API_KEY: T.String(),
  KERNEL_PUBLIC_KEY: T.Optional(T.String()),
});

export type Env = StaticDecode<typeof env>;
export const envValidator = new StandardValidator(env);
