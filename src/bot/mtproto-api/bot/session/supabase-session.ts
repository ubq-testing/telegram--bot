import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { StringSession } from "telegram/sessions";
import { Context } from "../../../../types";
import { SessionManager } from "./session-manager";
import { SuperbaseStorage } from "../../../../adapters/supabase/supabase";

/**
 * This class extends the StringSession class from the Telegram library.
 *
 * It adds the ability to save and load the session data from Supabase.
 */
export class SupabaseSession extends StringSession implements SessionManager {
  storage: SuperbaseStorage;
  supabase: SupabaseClient;
  context: Context;
  session?: string;

  constructor(context: Context, session?: string) {
    super(session);
    const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = context.env.TELEGRAM_BOT_ENV.storageSettings;
    this.supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    this.storage = new SuperbaseStorage(context, this.supabase);
    this.context = context;
  }

  /**
   * Returns the Supabase client.
   */
  getClient() {
    return this.supabase;
  }

  async saveSession(): Promise<void> {
    await this.supabase?.from("tg-bot-sessions").insert([{ session_data: super.save() }]);
  }

  async loadSession(): Promise<SupabaseSession> {
    const session = await this.supabase?.from("tg-bot-sessions").select("session_data").single();

    if (session.data) {
      return new SupabaseSession(this.context, session.data.session_data);
    } else {
      throw new Error("No session found. Please run the SMS Login script first.");
    }
  }

  async getSession(): Promise<string> {
    const session = await this.supabase?.from("tg-bot-sessions").select("session_data").single();

    if (session.data) {
      return session.data.session_data;
    } else {
      throw new Error("No session found. Please run the SMS Login script first.");
    }
  }

  async deleteSession(): Promise<void> {
    await this.supabase?.from("tg-bot-sessions").delete();
  }
}
