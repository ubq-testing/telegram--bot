// @ts-expect-error no types for this package
import input from "input";
import dotenv from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { BaseMtProto } from "./base-mtproto";
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
    BOT_TOKEN: "",
  };

  constructor() {
    const key = process.env.SUPABASE_SERVICE_KEY;
    const url = process.env.SUPABASE_URL;
    if (!key || !url) {
      throw new Error("Missing required environment variables for Supabase");
    }
    this._supabase = createClient(url, key);

    const hash = process.env.TELEGRAM_API_HASH;
    const tgAppId = process.env.TELEGRAM_APP_ID;
    const botToken = process.env.BOT_TOKEN;

    if (!hash || !tgAppId || !botToken) {
      throw new Error("Missing required environment variables for Telegram API");
    }

    this._env = {
      TELEGRAM_API_HASH: hash,
      TELEGRAM_APP_ID: Number(tgAppId),
      BOT_TOKEN: botToken,
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
        password: async () => await input.text("Enter your password if required:"),
        phoneCode: async () => await input.text("Enter the code you received:"),
        onError: (err: unknown) => console.error("Error during login:", err),
      });

      const data = await this._supabase?.from("tg-bot-sessions").insert([{ session_data: mtProto.session?.save() }]);

      if (data?.error) {
        throw new Error("Failed to save session data to Supabase.");
      }

      console.log("Successfully logged in and saved session data. You can now run the bot.");
      process.exit(0);
    } catch (error) {
      console.error("Failed to log in:", error);
    }
  }
}
