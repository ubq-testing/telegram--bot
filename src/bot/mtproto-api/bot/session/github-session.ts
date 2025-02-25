import { StringSession } from "telegram/sessions";
import { GithubStorage } from "../../../../adapters/github/storage-layer";
import { SessionManager } from "./session-manager";

/**
 * This class extends the StringSession class from the Telegram library.
 *
 * It adds the ability to save and load the session data from GitHub storage.
 */
export class GitHubSession extends StringSession implements SessionManager {
  private _storage: GithubStorage;
  private _session?: string;

  constructor(session?: string) {
    super(session);
    this._storage = new GithubStorage();
    this._session = session;
  }

  getClient() {
    return;
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
      return new GitHubSession(session);
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
