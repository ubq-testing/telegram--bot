import dotenv from "dotenv";
import { BaseMtProto } from "./scripts/sms-auth/base-mtproto";
import { Context } from "../../../types";
import { SessionManager, SessionManagerFactory } from "./session/session-manager";
dotenv.config();

/**
 * This class MUST ONLY be used in the context of workflows as
 * it requires a Node.js environment which is not available with Cloudflare Workers.
 *
 * An extension of the BaseMtProto class that integrates with the GitHub
 * storage based session management.
 */
export class MtProto extends BaseMtProto {
  private _context: Context;
  _session: SessionManager;

  constructor(context: Context) {
    super();
    this._context = context;
    this._session = SessionManagerFactory.createSessionManager(context);
  }

  async initialize() {
    const session = await this._session.getSession();
    await super.initialize(this._context.env.TELEGRAM_BOT_ENV.mtProtoSettings, session);
  }

  async saveSession() {
    await this._session.saveSession();
  }

  async deleteSession() {
    await this._session.deleteSession();
  }

  async loadSession() {
    await this._session.loadSession();
  }
}
