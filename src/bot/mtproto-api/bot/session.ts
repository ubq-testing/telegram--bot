import { SupabaseClient } from "@supabase/supabase-js";
import { StringSession } from "telegram/sessions";
import { Context } from "../../../types";

/**
 * This class extends the StringSession class from the Telegram library.
 *
 * It adds the ability to save and load the session data from Supabase.
 */
export class SupabaseSession extends StringSession {
  supabase: SupabaseClient;
  context: Context;

  constructor(supabase: SupabaseClient, context: Context, session?: string) {
    super(session);
    this.supabase = supabase;
    this.context = context;
  }

  async saveSession(): Promise<void> {
    await this.supabase?.from("tg-bot-sessions").insert([{ session_data: super.save() }]);
  }

  async loadSession(): Promise<SupabaseSession> {
    const session = await this.supabase?.from("tg-bot-sessions").select("session_data").single();

    if (session.data) {
      return new SupabaseSession(this.supabase, this.context, session.data.session_data);
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
