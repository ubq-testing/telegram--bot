import { Context } from "../../../../types";
import { GithubStorage } from "../../../../adapters/github/storage-layer";
import { SuperbaseStorage } from "../../../../adapters/supabase/supabase";
import { GitHubSession } from "./github-session";
import { SupabaseSession } from "./supabase-session";
import { StringSession } from "telegram/sessions";

export interface SessionManager extends StringSession {
  storage: GithubStorage | SuperbaseStorage;
  context: Context;
  session?: string;
  saveSession(): Promise<void>;
  loadSession(): Promise<GitHubSession | SupabaseSession>;
  getSession(): Promise<string>;
  deleteSession(): Promise<void>;
}

export class SessionManagerFactory {
  static sessionManager: SessionManager;
  static storage: GithubStorage | SuperbaseStorage;

  static createSessionManager(shouldUseGithubStorage: boolean, context: Context, session?: string): SessionManager {
    if (this.sessionManager) {
      return this.sessionManager;
    }

    if (shouldUseGithubStorage) {
      this.sessionManager = new GitHubSession(context, session);
    } else {
      this.sessionManager = new SupabaseSession(context, session);
    }

    this.storage = this.sessionManager.storage;
    return this.sessionManager;
  }
}
