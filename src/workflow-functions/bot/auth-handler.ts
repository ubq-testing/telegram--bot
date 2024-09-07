import input from 'input';
import { MtProtoSingleton } from './mtproto-single';
import { Api, TelegramClient } from 'telegram';
import dotenv from "dotenv";
import { createClient, SupabaseClient } from '@supabase/supabase-js';
dotenv.config();

/**
 * STEP 1: SMS Login
 * - The account holder must run this script (to my knowledge only once) to login
 * - This will give us the necessary session information to login in the future
 * 
 * STEP 2: User Login with Token
 * - Any future logins will be done with the saved session information
 * - As this is new ground, it may require refreshing the session information
 *   which will require the account holder to run the SMS Login script again.
 *   This is a limitation of the current implementation and may be improved in the future.
 */

export class AuthHandler {
    private client: TelegramClient | null = null;
    private api: typeof Api | null = null;
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
        // Get the Telegram Client instance
        const mtProto = await MtProtoSingleton.getInstance(this.env, "");
        this.client = mtProto.getClient();
        this.api = mtProto.getApi();

        try {
            // Start the login process
            await this.client.start({
                phoneNumber: async () => await input.text('Enter your phone number:'),
                password: async () => await input.text('Enter your password if required:'),
                phoneCode: async () => await input.text('Enter the code you received:'),
                onError: (err: unknown) => console.error('Error during login:', err),
            });

            const sesh = mtProto.getSession();
            const futureAuthToken = sesh.save();

            await this.supabase?.from('tg-bot-sessions').insert([
                { session_data: futureAuthToken },
            ]);
        } catch (error) {
            console.error('Failed to log in:', error);
        }
    }

    async userLoginWithToken() {
        const session = await this.supabase?.from('tg-bot-sessions').select('session_data').single()

        if (!session?.data?.session_data) {
            throw new Error("No session found. Please run the SMS Login script first.")
        }

        const mtProto = await MtProtoSingleton.getInstance(this.env, session.data.session_data);
        this.client = mtProto.getClient();
        this.api = mtProto.getApi();

        const newChat = await this.client.invoke(
            new this.api.messages.CreateChat({
                users: [],
                title: "Test Chat",
            }))

        return !!newChat;
    }

    getClient() {
        return this.client;
    }

    getApi() {
        return this.api;
    }
}