import { Context } from '#root/types/context.js';
import dotenv from "dotenv";
import { BaseMtProto } from './scripts/sms-auth/base-mtproto';
import { SupabaseSession } from './session';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
dotenv.config();

export class MtProto extends BaseMtProto {
    private supabase: SupabaseClient | null = null;
    private context: Context;
    _session: SupabaseSession;

    constructor(context: Context) {
        super();

        const key = context.env.SUPABASE_SERVICE_KEY;
        const url = context.env.SUPABASE_URL;

        if (!key || !url) {
            throw new Error("Missing required environment variables for Supabase")
        }

        this.supabase = createClient(url, key);
        this.context = context;
        this._session = new SupabaseSession(this.supabase, this.context);
    }

    async initialize() {
        const session = await this._session.getSession();
        await super.initialize(this.context.env, session);
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


