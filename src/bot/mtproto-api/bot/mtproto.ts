import { Context } from "#root/types/context.js";
import dotenv from "dotenv";
import { BaseMtProto } from "./scripts/sms-auth/base-mtproto";
import { SupabaseSession } from "./session";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
dotenv.config();

/**
 * This class MUST ONLY be used in the context of workflow-functions as
 * it requires a Node.js environment which is not available with Cloudflare Workers.
 *
 * An extension of the BaseMtProto class that integrates with the Supabase based
 * session management.
 */
export class MtProto extends BaseMtProto {
  private _supabase: SupabaseClient | null = null;
  private _context: Context;
  _session: SupabaseSession;

  constructor(context: Context) {
    super();

    const key = context.env.SUPABASE_SERVICE_KEY;
    const url = context.env.SUPABASE_URL;

    if (!key || !url) {
      throw new Error("Missing required environment variables for Supabase");
    }

    this._supabase = createClient(url, key);
    this._context = context;
    this._session = new SupabaseSession(this._supabase, this._context);
  }

  async initialize() {
    const session = await this._session.getSession();
    await super.initialize(this._context.env, session);
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
