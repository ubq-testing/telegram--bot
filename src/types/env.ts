import { Type as T } from "@sinclair/typebox";
import { StaticDecode } from "@sinclair/typebox";
import "dotenv/config";
import { StandardValidator } from "typebox-validators";

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

export const env = T.Object({
    BOT_TOKEN: T.String(),
    BOT_MODE: T.String(),
    LOG_LEVEL: T.String(),
    DEBUG: T.Transform(T.Union([T.String(), T.Boolean()])).Decode((str) => str === "true" || str === "false" ? str === "true" : str).Encode((bool) => bool.toString()),
    BOT_WEBHOOK: T.String(),
    BOT_WEBHOOK_SECRET: T.String(),
    SERVER_HOST: T.String(),
    SERVER_PORT: T.Transform(T.Union([T.String(), T.Number()])).Decode((str) => Number(str)).Encode((num) => num.toString()),
    BOT_ADMINS: T.Transform(T.Union([T.String(), T.Array(T.String())])).Decode((str) => Array.isArray(str) ? str.map(Number) : [Number(str)]).Encode((arr) => arr.map(String)),
    ALLOWED_UPDATES: T.Optional(T.Array(T.KeyOf(allowedUpdates))),

    SUPABASE_URL: T.String(),
    SUPABASE_KEY: T.String(),
});

/**
 * These are the same right now but they will diverge in the future.
 */
export type Env = StaticDecode<typeof env>;
export const envValidator = new StandardValidator(env);