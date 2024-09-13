// @ts-expect-error no types
import input from "input";
import { writeFile } from "node:fs/promises";
import { Context } from "../../../../../types";
import { logger } from "#root/utils/logger.js";
import { exit } from "node:process";
import { Octokit } from "@octokit/rest";

/**
 * This script is used to help guide the user through setting up the environment variables.
 * 
 * The user will be prompted to enter the required environment variables, they'll be stored 
 * automatically in the `.env` and `.dev.vars` files.
 */

class SetUpHandler {
    private _env: Context["env"] = {
        telegramBotEnv: {
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
                    message: "Enter your Telegram bot admin IDs seperated with commas. '123456789,987654321'",
                }
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
                    message: "Enter your Ubiquity OS app id. This can be obtained from 'https://github.com/settings/apps'",
                },
                {
                    type: "input",
                    name: "APP_PRIVATE_KEY",
                    message: "Enter your Ubiquity OS private key. This can be obtained from 'https://github.com/settings/apps'",
                },
            ],
        },
    ];

    async run() {
        const answers: Record<string, Record<string, string>> = {};
        for (const step of this.steps) {
            console.log(step.title);
            const questions = step.questions;

            for (const question of questions) {
                const answer = await input.text(question.message);
                console.log("Answer:", answer);
                answers[step.title] ??= {};
                if (question.name === "TELEGRAM_BOT_ADMINS") {
                    answers[step.title][question.name] = JSON.stringify(answer.split(",").map((id: string) => Number(id)))
                    continue;
                }
                answers[step.title][question.name] = answer;
            }
        }

        console.clear();

        this.env = {
            telegramBotEnv: {
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
     * Manually set the env variables and run `yarn setup-env-manual`
     */
    async manual() {
        this.env = {
            telegramBotEnv: {
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
        const env = this.env.telegramBotEnv;
        const { botSettings, mtProtoSettings, storageSettings, ubiquityOsSettings } = env

        const merged = {
            ...botSettings,
            ...mtProtoSettings,
            ...storageSettings,
            ...ubiquityOsSettings,
        }

        const keys = Object.keys(merged);

        const missing = []

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

        exit()
    }

    async saveEnv() {
        const paths = [
            ".env",
            ".dev.vars",
        ]

        const envVar = `telegramBotEnv=${JSON.stringify(this.env.telegramBotEnv)}`

        for (const path of paths) {
            await writeFile(path, envVar, "utf-8");
        }

        logger.ok("Local env files saved successfully");
        logger.info("Storing secrets in GitHub");
        await this.storeRepoSecrets();
    }

    async storeRepoSecrets() {
        const octokit = new Octokit({ auth: process.env.GITHUB_PAT_TOKEN });
        const secret = `${JSON.stringify(this.env.telegramBotEnv)}`;

        try {
            await octokit.actions.createOrUpdateRepoSecret({
                owner: "ubq-testing",
                repo: "telegram--bot",
                secret_name: "telegramBotEnv",
                encrypted_value: secret,
            });
            logger.ok("Secret stored successfully");
        } catch (err) {
            logger.error("Error storing secret", { err });
        }
        exit();
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
    manual().catch(logger.error);
} else {
    guided().catch(logger.error);
}