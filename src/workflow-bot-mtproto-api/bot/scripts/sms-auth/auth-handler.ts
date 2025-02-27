// @ts-expect-error no types for this package
import input from "input";
import dotenv from "dotenv";
import { BaseMtProto } from "./base-mtproto";
import { Context } from "../../../../types";
import { logger } from "../../../../utils/logger";
import { GithubStorage } from "../../../../adapters/github/storage-layer";
import { Octokit } from "octokit";
dotenv.config();

/**
 * The account holder must run this script (to my knowledge only once) to login,
 * this will give us the necessary session information to login in the future.
 */
export class AuthHandler {
  private _env;
  private _storage: GithubStorage;

  constructor() {
    const env = process.env.TELEGRAM_BOT_ENV;
    if (!env) {
      throw new Error("Have you ran the setup script? Try running 'yarn setup-env' first.");
    }

    const parsedEnv: Context["env"]["TELEGRAM_BOT_ENV"] = JSON.parse(env);
    if (!parsedEnv) {
      throw new Error("Failed to parse environment variables for Telegram Bot");
    }

    const { botSettings, mtProtoSettings, storageSettings, workflowFunctions } = parsedEnv;

    if (!botSettings || !mtProtoSettings || !storageSettings || !workflowFunctions) {
      throw new Error("Missing required environment variables for Telegram Bot settings");
    }

    const { TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_WEBHOOK } = botSettings;
    const { TELEGRAM_APP_ID, TELEGRAM_API_HASH } = mtProtoSettings;
    const { SOURCE_REPOSITORY, SOURCE_REPO_OWNER, TARGET_BRANCH } = workflowFunctions;

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_BOT_WEBHOOK) {
      throw new Error("Missing required environment variables for Telegram Bot settings");
    }

    if (!TELEGRAM_APP_ID || !TELEGRAM_API_HASH) {
      throw new Error("Missing required environment variables for MtProto settings");
    }

    if (!SOURCE_REPOSITORY || !SOURCE_REPO_OWNER || !TARGET_BRANCH) {
      throw new Error("Missing required environment variables for Workflow functions");
    }

    this._env = {
      TELEGRAM_API_HASH,
      TELEGRAM_APP_ID,
      TELEGRAM_BOT_TOKEN,
    };

    const APP_PRIVATE_KEY = process.env.APP_PRIVATE_KEY;
    const APP_ID = process.env.APP_ID;
    const VOYAGEAI_API_KEY = process.env.VOYAGEAI_API_KEY;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    const TEMP_SAFE_PAT = process.env.TEMP_SAFE_PAT;

    if (!APP_PRIVATE_KEY || !APP_ID || !VOYAGEAI_API_KEY || !OPENAI_API_KEY || !OPENROUTER_API_KEY || !TEMP_SAFE_PAT) {
      throw new Error("Missing required environment variables for App settings");
    }

    // we need to push the session data to GitHub
    this._storage = new GithubStorage({
      octokit: new Octokit({ auth: process.env.REPO_ADMIN_ACCESS_TOKEN || process.env.TEMP_SAFE_PAT }),
      env: {
        TELEGRAM_BOT_ENV: parsedEnv,
        KERNEL_PUBLIC_KEY: process.env.KERNEL_PUBLIC_KEY,
        OPENAI_API_KEY,
        OPENROUTER_API_KEY,
        TEMP_SAFE_PAT,
        APP_ID,
        APP_PRIVATE_KEY,
        VOYAGEAI_API_KEY,
      },
    } as unknown as Context);
  }

  /**
   * You should only need to run this once.
   *
   * You will be prompted in your terminal to enter the following:
   * - Phone number
   * - Code received
   * - Password (if required)
   *
   * In that order and the code will be sent to a Telegram instance
   * which the associated phone number is logged in.
   *
   * The session data will be saved to Supabase for future use.
   */
  async smsLogin() {
    const mtProto = new BaseMtProto();
    // empty string as it's a new session
    if (!this._env.TELEGRAM_API_HASH || !this._env.TELEGRAM_APP_ID) {
      throw new Error("Missing required environment variables for MtProto settings");
    }

    await mtProto.initialize(this._env, "");
    try {
      await mtProto.getMtProtoClient().start({
        phoneNumber: async () => await input.text("Enter your phone number:"),
        password: async () => await input.password("Enter your password if required:"),
        phoneCode: async () => await input.text("Enter the code you received:"),
        onError: (err: unknown) => console.error("Error during login:", { err }),
      });

      if (!(await this._storage.handleSession(mtProto.getStringSessionObject().save(), "create"))) {
        throw new Error("Failed to save session data to GitHub.");
      }
      logger.ok("Successfully logged in and saved session data. You can now run the bot.");
      process.exit(0);
    } catch (err) {
      logger.error("Failed to log in:", { err });
    }
    process.exit(1);
  }
}
