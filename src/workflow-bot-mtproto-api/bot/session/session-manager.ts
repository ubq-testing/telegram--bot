import { Context } from "../../../types";
import { GithubStorage } from "../../../adapters/github/storage-layer";
import { GitHubSession } from "./github-session";
import { StringSession } from "telegram/sessions";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface SessionManager extends StringSession {
  getStorageHandler(): GithubStorage;
  saveSession(): Promise<void>;
  loadSession(): Promise<GitHubSession>;
  getSession(): Promise<string>;
  deleteSession(): Promise<void>;
  getClient(): SupabaseClient | void;
}

export class SessionManagerFactory {
  // eslint-disable-next-line sonarjs/public-static-readonly
  static sessionManager: SessionManager;
  // eslint-disable-next-line sonarjs/public-static-readonly
  static storage: GithubStorage;

  static createSessionManager(context: Context, session?: string): SessionManager {
    if (this.sessionManager) {
      return this.sessionManager;
    }

    const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = context.pluginEnvCtx.getEnv().TELEGRAM_BOT_ENV.storageSettings;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    this.sessionManager = new GitHubSession(context, supabaseClient, session);

    return this.sessionManager;
  }
}
