import { StringSession } from "telegram/sessions";
import { Context } from "../../../../types";
import { GithubStorage } from "../../../../adapters/github/storage-layer";
import { SessionManager } from "./session-manager";

/**
 * This class extends the StringSession class from the Telegram library.
 *
 * It adds the ability to save and load the session data from GitHub storage.
 */
export class GitHubSession extends StringSession implements SessionManager {
  storage: GithubStorage;
  context: Context;
  session?: string;

  constructor(context: Context, session?: string) {
    super(session);
    this.storage = new GithubStorage();
    this.context = context;
    this.session = session;
  }

  getClient() {
    return;
  }

  async saveSession(): Promise<void> {
    if (!this.session) {
      throw new Error("No session found. Please run the SMS Login script first.");
    }
    await this.storage.handleSession(this.session, "create");
  }

  async loadSession() {
    const session = await this.storage.retrieveSession();

    if (session) {
      return new GitHubSession(this.context, session);
    } else {
      throw new Error("No session found. Please run the SMS Login script first.");
    }
  }

  async getSession(): Promise<string> {
    const session = await this.storage.retrieveSession();

    if (session) {
      return session;
    } else {
      throw new Error("No session found. Please run the SMS Login script first.");
    }
  }

  async deleteSession(): Promise<void> {
    if (!this.session) {
      throw new Error("No session found. Please run the SMS Login script first.");
    }
    await this.storage.handleSession(this.session, "delete");
  }
}
