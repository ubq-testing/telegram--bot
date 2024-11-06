import { Context } from "../../../../types";
import { GithubStorage } from "../../../../adapters/github/storage-layer";
import { SuperbaseStorage } from "../../../../adapters/supabase/supabase";
import { GitHubSession } from "./github-session";
import { SupabaseSession } from "./supabase-session";
import { StringSession } from "telegram/sessions";
import { SupabaseClient } from "@supabase/supabase-js";

export interface SessionManager extends StringSession {
  storage: GithubStorage | SuperbaseStorage;
  context: Context;
  session?: string;
  saveSession(): Promise<void>;
  loadSession(): Promise<GitHubSession | SupabaseSession>;
  getSession(): Promise<string>;
  deleteSession(): Promise<void>;
  getClient(): SupabaseClient | void;
}

export class SessionManagerFactory {
  // eslint-disable-next-line sonarjs/public-static-readonly
  static sessionManager: SessionManager;
  // eslint-disable-next-line sonarjs/public-static-readonly
  static storage: GithubStorage | SuperbaseStorage;

  static createSessionManager(context: Context, session?: string): SessionManager {
    if (this.sessionManager) {
      return this.sessionManager;
    }

    if (context.config.shouldUseGithubStorage) {
      this.sessionManager = new GitHubSession(context, session);
    } else {
      this.sessionManager = new SupabaseSession(context, session);
    }

    this.storage = this.sessionManager.storage;
    return this.sessionManager;
  }
}
