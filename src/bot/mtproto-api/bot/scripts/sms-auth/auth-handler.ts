// @ts-expect-error no types for this package
import input from "input";
import dotenv from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { BaseMtProto } from "./base-mtproto";
import { Context } from "#root/types/context.js";
import { logger } from "#root/utils/logger.js";
dotenv.config();

/**
 * The account holder must run this script (to my knowledge only once) to login,
 * this will give us the necessary session information to login in the future.
 */
export class AuthHandler {
  private _supabase: SupabaseClient | null = null;
  private _env = {
    TELEGRAM_API_HASH: "",
    TELEGRAM_APP_ID: 0,
    TELEGRAM_BOT_TOKEN: "",
  };

  constructor() {
    const env = process.env.TELEGRAM_BOT_ENV;
    if (!env) {
      throw new Error("Have you ran the setup script? Try running 'yarn setup-env-guided' first.");
    }

    const parsedEnv: Context["env"]["TELEGRAM_BOT_ENV"] = JSON.parse(env);
    if (!parsedEnv) {
      throw new Error("Failed to parse environment variables for Telegram Bot");
    }

    const { botSettings, mtProtoSettings, ubiquityOsSettings, storageSettings } = parsedEnv;

    if (!botSettings || !mtProtoSettings || !ubiquityOsSettings || !storageSettings) {
      throw new Error("Missing required environment variables for Telegram Bot settings");
    }

    const { TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_WEBHOOK } = botSettings;
    const { TELEGRAM_APP_ID, TELEGRAM_API_HASH } = mtProtoSettings;
    const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = storageSettings;
    const { APP_ID, APP_PRIVATE_KEY } = ubiquityOsSettings;

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_BOT_WEBHOOK) {
      throw new Error("Missing required environment variables for Telegram Bot settings");
    }

    if (!TELEGRAM_APP_ID || !TELEGRAM_API_HASH) {
      throw new Error("Missing required environment variables for MtProto settings");
    }

    if (!APP_ID || !APP_PRIVATE_KEY) {
      throw new Error("Missing required environment variables for UbiquityOS settings");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error("Missing required environment variables for storage settings");
    }

    this._supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    this._env = {
      TELEGRAM_API_HASH,
      TELEGRAM_APP_ID,
      TELEGRAM_BOT_TOKEN,
    };
  }

  /**
   * You should only need to run this once.
   *
   * You will be prompted in your terminal to enter the following:
   * - Phone number
   * - Code received
   * - Password (if required)
   *
   * In that order and the code will be sent to a Telegram instance
   * which the associated phone number is logged in.
   *
   * The session data will be saved to Supabase for future use.
   */
  async smsLogin() {
    const mtProto = new BaseMtProto();
    // empty string as it's a new session
    await mtProto.initialize(this._env, "");
    try {
      await mtProto.client?.start({
        phoneNumber: async () => await input.text("Enter your phone number:"),
        password: async () => await input.password("Enter your password if required:"),
        phoneCode: async () => await input.text("Enter the code you received:"),
        onError: (err: unknown) => logger.error("Error during login:", { err }),
      });

      const data = await this._supabase?.from("tg-bot-sessions").insert([{ session_data: mtProto.session?.save() }]);

      if (data?.error) {
        throw new Error("Failed to save session data to Supabase.");
      }

      logger.ok("Successfully logged in and saved session data. You can now run the bot.");
      process.exit(0);
    } catch (err) {
      logger.error("Failed to log in:", { err });
    }
  }
}
