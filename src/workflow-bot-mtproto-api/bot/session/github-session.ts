import { StringSession } from "telegram/sessions";
import { GithubStorage } from "../../../adapters/storage-layer";
import { SessionManager } from "./session-manager";
import { Context } from "../../../types";
import { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "../encryption";

/**
 * This class extends the StringSession class from the Telegram library.
 *
 * It adds the ability to save and load the session data from GitHub storage.
 */
export class GitHubSession extends StringSession implements SessionManager {
  private _storage: GithubStorage;

  constructor(
    private _context: Context,
    private _supabase: SupabaseClient,
    private _session?: string
  ) {
    super(_session ?? decrypt(_context.env.APP_PRIVATE_KEY, _session));
    this._storage = new GithubStorage(_context);
  }

  getClient() {
    return this._supabase;
  }

  getStorageHandler(): GithubStorage {
    return this._storage;
  }

  async saveSession(): Promise<void> {
    if (!this._session) {
      throw new Error("No session found. Please run the SMS Login script first.");
    }
    await this._storage.handleSession(this._session, "create");
  }

  async loadSession() {
    const session = await this._storage.retrieveSession();

    if (session) {
      return new GitHubSession(this._context, this._supabase, session);
    } else {
      throw new Error("No session found. Please run the SMS Login script first.");
    }
  }

  async getSession(): Promise<string> {
    const session = await this._storage.retrieveSession();

    if (session) {
      return session;
    } else {
      throw new Error("No session found. Please run the SMS Login script first.");
    }
  }

  async deleteSession(): Promise<void> {
    if (!this._session) {
      throw new Error("No session found. Please run the SMS Login script first.");
    }
    await this._storage.handleSession(this._session, "delete");
  }
}
