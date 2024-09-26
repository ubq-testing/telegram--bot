// @ts-expect-error no types
import input from "input";
// @ts-expect-error no types
import sodium from "libsodium-wrappers";
import { Context } from "../../../../../types";
import { logger } from "#root/utils/logger.js";
import { exit } from "node:process";
import { Octokit } from "@octokit/rest";
import dotenv from "dotenv";
import { appendFile, writeFile } from "node:fs/promises";
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
      title: "Repository settings",
      questions: [
        {
          type: "input",
          name: "TELEGRAM_BOT_REPOSITORY_FULL_NAME",
          message: "Enter your repository name (owner/repo).",
        },
      ],
    },
    {
      title: "Secret upload",
      questions: [
        {
          type: "input",
          name: "GITHUB_PAT_TOKEN",
          message:
            "Enter your GitHub PAT token.\n    This is used to store secrets in your repository so it should have the 'repo' scope and be an admin of the repository.",
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
          message: "Any URL used should end with '/telegram'. e.g 'https://example.com/telegram'",
        },
        {
          type: "input",
          name: "TELEGRAM_BOT_WEBHOOK_SECRET",
          message: "Enter your Telegram bot webhook secret. Random 12 char-min e.g '123456123456'",
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

  shouldTestToken = !!process.env.GITHUB_PAT_TOKEN;
  hasSetRepository = !!process.env.TELEGRAM_BOT_REPOSITORY_FULL_NAME;

  async handleFirstTwo(question: { name: string; message: string }, answer: string) {
    if (question.name === "TELEGRAM_BOT_REPOSITORY_FULL_NAME") {
      if (!answer.includes("/")) {
        logger.error("Invalid repository name. Please enter in the format 'owner/repo'");
        process.exit(1);
      }
      await writeFile(".env", `TELEGRAM_BOT_REPOSITORY_FULL_NAME=${answer}`, "utf-8");
      logger.ok("Repository name saved successfully");
    }

    if (question.name === "GITHUB_PAT_TOKEN") {
      await appendFile(".env", `\nGITHUB_PAT_TOKEN=${answer}`, "utf-8");
      logger.ok("GitHub PAT token saved successfully, we must restart the script to continue.");
      process.exit(0);
    }
  }

  async run() {
    const answers: Record<string, Record<string, string>> = {};
    for (const step of this.steps) {
      const questions = step.questions;

      for (const question of questions) {
        if (
          (question.name === "TELEGRAM_BOT_REPOSITORY_FULL_NAME" && this.hasSetRepository) ||
          (question.name === "GITHUB_PAT_TOKEN" && (await this.testAccessToken()))
        ) {
          continue;
        }
        console.log(step.title);
        const answer = await input.text(`  ${question.message}\n>  `);

        await this.handleFirstTwo(question, answer);

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

    const telegramBotEnv = `TELEGRAM_BOT_ENV=${JSON.stringify(this.env.TELEGRAM_BOT_ENV)}`;
    const repositoryEnv = `TELEGRAM_BOT_REPOSITORY_FULL_NAME=${process.env.TELEGRAM_BOT_REPOSITORY_FULL_NAME}`;

    for (const path of paths) {
      const envVar = `${repositoryEnv}\n${telegramBotEnv}`;
      await writeFile(path, envVar, "utf-8");
    }

    logger.ok("Local env files saved successfully");
    logger.info("Storing secrets in GitHub");
    await this.storeRepoSecrets();
  }

  getOwnerRepo() {
    if (!process.env.TELEGRAM_BOT_REPOSITORY_FULL_NAME) {
      logger.error("No repository found in environment variables");
      exit(1);
    }
    const [owner, repo] = process.env.TELEGRAM_BOT_REPOSITORY_FULL_NAME.split("/");
    return { owner, repo };
  }

  async testAccessToken() {
    if (!this.shouldTestToken) {
      return false;
    }
    const octokit = new Octokit({ auth: process.env.GITHUB_PAT_TOKEN });
    const secret = `{}`;

    try {
      const { owner, repo } = this.getOwnerRepo();
      const pubKey = await octokit.actions.getRepoPublicKey({
        owner,
        repo,
      });

      const key = pubKey.data.key;
      const encryptedSecret = await this.encryptSecret(secret, key);

      await octokit.actions.createOrUpdateRepoSecret({
        owner,
        repo,
        secret_name: "TELEGRAM_BOT_ENV",
        encrypted_value: encryptedSecret,
        key_id: pubKey.data.key_id,
      });

      return true;
    } catch {
      return false;
    }
  }

  async storeRepoSecrets() {
    const octokit = new Octokit({ auth: process.env.GITHUB_PAT_TOKEN });
    const secrets = {
      TELEGRAM_BOT_ENV: this.env.TELEGRAM_BOT_ENV,
      TELEGRAM_BOT_REPOSITORY_FULL_NAME: process.env.TELEGRAM_BOT_REPOSITORY_FULL_NAME,
    };

    try {
      for (const [key, value] of Object.entries(secrets)) {
        const { owner, repo } = this.getOwnerRepo();
        const pubKey = await octokit.actions.getRepoPublicKey({
          owner,
          repo,
        });

        const secret = typeof value === "object" ? JSON.stringify(value) : value;

        if (!secret) {
          throw new Error(`No secret found to save for key ${key}`);
        }

        const encryptedSecret = await this.encryptSecret(secret, pubKey.data.key);

        await octokit.actions.createOrUpdateRepoSecret({
          owner,
          repo,
          secret_name: key,
          encrypted_value: encryptedSecret,
          key_id: pubKey.data.key_id,
        });

        logger.ok(`Secret ${key} stored successfully`);
      }
    } catch (err) {
      logger.error("Error storing secret", { err });
    }
    exit();
  }

  async encryptSecret(secret: string, key: string /* Base64 */) {
    await sodium.ready;
    const binkey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);
    const binsec = sodium.from_string(secret);
    const encBytes = sodium.crypto_box_seal(binsec, binkey);
    return sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL);
  }
}

async function guided() {
  const setup = new SetUpHandler();
  await setup.run();
}

guided().catch(console.error);
