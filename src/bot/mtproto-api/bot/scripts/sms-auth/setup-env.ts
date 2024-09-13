// @ts-expect-error no types
import input from "input";
// @ts-expect-error no types
import sodium from "libsodium-wrappers";
import { Context } from "../../../../../types";
import { logger } from "#root/utils/logger.js";
import { exit, kill, nextTick } from "node:process";
import { Octokit } from "@octokit/rest";
import dotenv from "dotenv";
import { writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
dotenv.config();
/**
 * This script is used to help guide the user through setting up the environment variables.
 *
 * The user will be prompted to enter the required environment variables, they'll be stored
 * automatically in the `.env` and `.dev.vars` files.
 */

class SetUpHandler {
    private _env: Context["env"] = {
        TELEGRAM_BOT_ENV: {
            botSettings: {
                TELEGRAM_BOT_ADMINS: [],
                TELEGRAM_BOT_TOKEN: "",
                TELEGRAM_BOT_WEBHOOK: "",
                TELEGRAM_BOT_WEBHOOK_SECRET: "",
            },
            mtProtoSettings: {
                TELEGRAM_API_HASH: "",
                TELEGRAM_APP_ID: 0,
            },
            storageSettings: {
                SUPABASE_SERVICE_KEY: "",
                SUPABASE_URL: "",
            },
            ubiquityOsSettings: {
                APP_ID: 0,
                APP_PRIVATE_KEY: "",
            },
        },
    };

    get env() {
        return this._env;
    }

    set env(env: Context["env"]) {
        this._env = env;
    }

    steps = [
        {
            title: "Secret upload",
            questions: [
                {
                    type: "input",
                    name: "GITHUB_PAT_TOKEN",
                    message: "Enter your GitHub PAT token.\n    This is used to store secrets in your repository so it should have the 'repo' scope and be an admin of the repository.",
                },
            ],
        },
        {
            title: "Bot settings",
            questions: [
                {
                    type: "input",
                    name: "TELEGRAM_BOT_TOKEN",
                    message: "Enter your Telegram bot token. This can be obtained from @BotFather",
                },
                {
                    type: "input",
                    name: "TELEGRAM_BOT_WEBHOOK",
                    message: "Enter your Telegram bot webhook. Cloudflare for production, ngrok/smee for development",
                },
                {
                    type: "input",
                    name: "TELEGRAM_BOT_WEBHOOK_SECRET",
                    message: "Enter your Telegram bot webhook secret. This is used to verify incoming requests from Telegram",
                },
                {
                    type: "input",
                    name: "TELEGRAM_BOT_ADMINS",
                    message: "Enter your Telegram bot admin IDs separated with commas. '123456789,987654321'",
                },
            ],
        },
        {
            title: "MTProto settings",
            questions: [
                {
                    type: "input",
                    name: "TELEGRAM_API_HASH",
                    message: "Enter your Telegram API hash. This can be obtained from 'https://my.telegram.org'",
                },
                {
                    type: "input",
                    name: "TELEGRAM_APP_ID",
                    message: "Enter your Telegram app id. This can be obtained from 'https://my.telegram.org'",
                },
            ],
        },
        {
            title: "Storage settings",
            questions: [
                {
                    type: "input",
                    name: "SUPABASE_SERVICE_KEY",
                    message: "Enter your Supabase service key (read/write access)",
                },
                {
                    type: "input",
                    name: "SUPABASE_URL",
                    message: "Enter your Supabase URL (https://<project_id>.supabase.co)",
                },
            ],
        },
        {
            title: "Ubiquity OS settings",
            questions: [
                {
                    type: "input",
                    name: "APP_ID",
                    message: "Enter your Ubiquity OS app id. This can be obtained from your kernel env vars.",
                },
                {
                    type: "input",
                    name: "APP_PRIVATE_KEY",
                    message: "Enter your Ubiquity OS private key. This can be obtained from your kernel env vars.",
                },
            ],
        },
    ];

    async run() {
        const answers: Record<string, Record<string, string>> = {};
        for (const step of this.steps) {
            const questions = step.questions;

            for (const question of questions) {
                if (question.name === "GITHUB_PAT_TOKEN" && await this.testAccessToken()) {
                    continue;
                }
                console.log(step.title);
                const answer = await input.text(`  ${question.message}\n>  `);
                if (question.name === "GITHUB_PAT_TOKEN") {
                    await writeFile(".env", `GITHUB_PAT_TOKEN=${answer}`, "utf-8");
                    logger.ok("GitHub PAT token saved successfully, we must restart the script to continue.");
                    process.exit(0);
                }

                answers[step.title] ??= {};

                if (question.name === "TELEGRAM_BOT_ADMINS") {
                    answers[step.title][question.name] = JSON.stringify(answer.split(",").map((id: string) => Number(id)));
                    continue;
                }
                answers[step.title][question.name] = answer;
            }
        }
        console.clear();

        this.env = {
            TELEGRAM_BOT_ENV: {
                botSettings: {
                    TELEGRAM_BOT_ADMINS: JSON.parse(answers["Bot settings"]["TELEGRAM_BOT_ADMINS"]),
                    TELEGRAM_BOT_TOKEN: answers["Bot settings"]["TELEGRAM_BOT_TOKEN"],
                    TELEGRAM_BOT_WEBHOOK: answers["Bot settings"]["TELEGRAM_BOT_WEBHOOK"],
                    TELEGRAM_BOT_WEBHOOK_SECRET: answers["Bot settings"]["TELEGRAM_BOT_WEBHOOK_SECRET"],
                },
                mtProtoSettings: {
                    TELEGRAM_API_HASH: answers["MTProto settings"]["TELEGRAM_API_HASH"],
                    TELEGRAM_APP_ID: Number(answers["MTProto settings"]["TELEGRAM_APP_ID"]),
                },
                storageSettings: {
                    SUPABASE_SERVICE_KEY: answers["Storage settings"]["SUPABASE_SERVICE_KEY"],
                    SUPABASE_URL: answers["Storage settings"]["SUPABASE_URL"],
                },
                ubiquityOsSettings: {
                    APP_ID: Number(answers["Ubiquity OS settings"]["APP_ID"]),
                    APP_PRIVATE_KEY: answers["Ubiquity OS settings"]["APP_PRIVATE_KEY"],
                },
            },
        };

        await this.validateEnv();
    }

    /**
     * Manually set the env variables below and run `yarn setup-env-manual`
     */
    async manual() {
        this.env = {
            TELEGRAM_BOT_ENV: {
                botSettings: {
                    TELEGRAM_BOT_ADMINS: [],
                    TELEGRAM_BOT_TOKEN: "",
                    TELEGRAM_BOT_WEBHOOK: "",
                    TELEGRAM_BOT_WEBHOOK_SECRET: "",
                },
                mtProtoSettings: {
                    TELEGRAM_API_HASH: "",
                    TELEGRAM_APP_ID: 0,
                },
                storageSettings: {
                    SUPABASE_SERVICE_KEY: "",
                    SUPABASE_URL: "",
                },
                ubiquityOsSettings: {
                    APP_ID: 0,
                    APP_PRIVATE_KEY: "",
                },
            },
        };

        await this.saveEnv();
    }

    async validateEnv() {
        const env = this.env.TELEGRAM_BOT_ENV;
        const { botSettings, mtProtoSettings, storageSettings, ubiquityOsSettings } = env;

        const merged = {
            ...botSettings,
            ...mtProtoSettings,
            ...storageSettings,
            ...ubiquityOsSettings,
        };

        const keys = Object.keys(merged);

        const missing = [];

        for (const key_ of keys) {
            const key = key_ as keyof typeof merged;
            if (!merged[key]) {
                missing.push(key);
            }
        }

        if (missing.length) {
            console.log("Missing keys:", missing);
            await this.run();
        }
        await this.saveEnv();

        logger.ok("Env saved successfully");

        exit();
    }

    async saveEnv() {
        const paths = [".env", ".dev.vars"];

        const envVar = `TELEGRAM_BOT_ENV=${JSON.stringify(this.env.TELEGRAM_BOT_ENV)}`;

        for (const path of paths) {
            await writeFile(path, envVar, "utf-8");
        }

        logger.ok("Local env files saved successfully");
        logger.info("Storing secrets in GitHub");
        await this.storeRepoSecrets();
    }

    async testAccessToken() {
        const octokit = new Octokit({ auth: process.env.GITHUB_PAT_TOKEN });
        const secret = `---`;

        try {
            const pubKey = await octokit.actions.getRepoPublicKey({
                owner: "ubq-testing",
                repo: "telegram--bot",
            });

            const key = pubKey.data.key;
            const encryptedSecret = await this.encryptSecret(secret, key);

            await octokit.actions.createOrUpdateRepoSecret({
                owner: "ubq-testing",
                repo: "telegram--bot",
                secret_name: "TELEGRAM_BOT_ENV",
                encrypted_value: encryptedSecret,
                key_id: pubKey.data.key_id,
            });

            return true
        } catch (err) {
            return false
        }
    }

    async storeRepoSecrets() {
        const octokit = new Octokit({ auth: process.env.GITHUB_PAT_TOKEN });
        const secret = `${JSON.stringify(this.env.TELEGRAM_BOT_ENV)}`;

        try {
            const pubKey = await octokit.actions.getRepoPublicKey({
                owner: "ubq-testing",
                repo: "telegram--bot",
            });

            const key = pubKey.data.key;
            const encryptedSecret = await this.encryptSecret(secret, key);

            await octokit.actions.createOrUpdateRepoSecret({
                owner: "ubq-testing",
                repo: "telegram--bot",
                secret_name: "TELEGRAM_BOT_ENV",
                encrypted_value: encryptedSecret,
                key_id: pubKey.data.key_id,
            });
            logger.ok("Secret stored successfully");
        } catch (err) {
            logger.error("Error storing secret", { err });
        }
        exit();
    }

    async encryptSecret(secret: string, key: string /* Base64 */) {
        await sodium.ready;
        // Convert the secret and key to a Uint8Array.
        const binkey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);
        const binsec = sodium.from_string(secret);

        // Encrypt the secret using libsodium
        const encBytes = sodium.crypto_box_seal(binsec, binkey);

        // Convert the encrypted Uint8Array to Base64
        return sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL);
    }
}

async function guided() {
    const setup = new SetUpHandler();
    await setup.run();
}

async function manual() {
    const setup = new SetUpHandler();
    await setup.manual();
}

if (process.argv.includes("--manual")) {
    manual().catch(console.error);
} else {
    guided().catch(console.error);
}
