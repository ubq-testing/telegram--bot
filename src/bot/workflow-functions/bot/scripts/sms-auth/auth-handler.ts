// @ts-expect-error no types for this package
import input from 'input';
import dotenv from "dotenv";
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BaseMtProto } from './base-mtproto';
dotenv.config();

/**
 * The account holder must run this script (to my knowledge only once) to login,
 * this will give us the necessary session information to login in the future.
 */

export class AuthHandler {
    private supabase: SupabaseClient | null = null;
    private env = {
        TELEGRAM_API_HASH: "",
        TELEGRAM_APP_ID: 0,
        BOT_TOKEN: "",
    }

    constructor() {
        const key = process.env.SUPABASE_SERVICE_KEY;
        const url = process.env.SUPABASE_URL;
        if (!key || !url) {
            throw new Error("Missing required environment variables for Supabase")
        }
        this.supabase = createClient(url, key);

        const hash = process.env.TELEGRAM_API_HASH
        const tgAppId = process.env.TELEGRAM_APP_ID
        const botToken = process.env.BOT_TOKEN

        if (!hash || !tgAppId || !botToken) {
            throw new Error("Missing required environment variables for Telegram API")
        }

        this.env = {
            TELEGRAM_API_HASH: hash,
            TELEGRAM_APP_ID: Number(tgAppId),
            BOT_TOKEN: botToken
        }
    }

    /**
     * This method will handle the SMS login process.
     */
    async smsLogin() {
        const mtProto = new BaseMtProto();
        await mtProto.initialize(this.env, "");
        try {
            // Start the login process
            await mtProto.client?.start({
                phoneNumber: async () => await input.text('Enter your phone number:'),
                password: async () => await input.text('Enter your password if required:'),
                phoneCode: async () => await input.text('Enter the code you received:'),
                onError: (err: unknown) => console.error('Error during login:', err),
            });

            await this.supabase?.from('tg-bot-sessions').insert([
                { session_data: mtProto.session?.save() },
            ]);
        } catch (error) {
            console.error('Failed to log in:', error);
        }
    }
}