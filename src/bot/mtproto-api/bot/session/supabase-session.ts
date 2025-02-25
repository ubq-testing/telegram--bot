import { SupabaseClient } from "@supabase/supabase-js";
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
  _storage: SuperbaseStorage;
  _supabase: SupabaseClient;

  constructor(client: SupabaseClient, octokit: Context["octokit"], session?: string) {
    super(session);
    this._supabase = client;
    this._storage = new SuperbaseStorage(octokit, this._supabase);
  }

  getStorageHandler(): SuperbaseStorage {
    return this._storage;
  }

  getClient() {
    return this._supabase;
  }

  async saveSession(): Promise<void> {
    await this._supabase?.from("tg-bot-sessions").insert([{ session_data: super.save() }]);
  }

  async loadSession(): Promise<SupabaseSession> {
    const session = await this._supabase?.from("tg-bot-sessions").select("session_data").single();

    if (session.data) {
      return new SupabaseSession(this._supabase, this._storage.octokit, session.data.session_data);
    } else {
      throw new Error("No session found. Please run the SMS Login script first.");
    }
  }

  async getSession(): Promise<string> {
    const session = await this._supabase?.from("tg-bot-sessions").select("session_data").single();

    if (session.data) {
      return session.data.session_data;
    } else {
      throw new Error("No session found. Please run the SMS Login script first.");
    }
  }

  async deleteSession(): Promise<void> {
    await this._supabase?.from("tg-bot-sessions").delete();
  }
}
