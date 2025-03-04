import { BaseMtProto } from "./base-mtproto";
import { Context } from "../../../../types";
import { SessionManager, SessionManagerFactory } from "../../session/session-manager";
import dotenv from "dotenv";
dotenv.config();

export class MtProtoWrapper extends BaseMtProto {
  private _context: Context;
  private _sessionManager: SessionManager;
  private _botIdString: string | null = null;

  constructor(context: Context) {
    super();
    this._context = context;
    this._sessionManager = SessionManagerFactory.createSessionManager(context);
  }

  async initialize() {
    const session = await this._sessionManager.getSession();
    const initialized = await super.initialize(this._context.env.TELEGRAM_BOT_ENV.mtProtoSettings, session);
    await initialized.client.getDialogs();
    this._botIdString = await initialized.client.getPeerId(this._context.config.botId, true);
    return initialized;
  }

  getBotIdString() {
    if (!this._botIdString) {
      throw new Error("Bot ID is not available");
    }
    return this._botIdString;
  }

  _getContext() {
    return this._context;
  }
}
