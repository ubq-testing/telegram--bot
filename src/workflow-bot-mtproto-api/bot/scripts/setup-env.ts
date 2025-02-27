import dotenv from "dotenv";
import { promptUser } from "./prompt-handler";
import { logger } from "../../../utils/logger";
import { storeSecret } from "./secret-handling";
import { Context } from "../../../types";
import { appendFile } from "node:fs/promises";

dotenv.config();

const steps = [
    {
        title: "Repository settings",
        questions: [
            {
                type: "input",
                name: "TELEGRAM_BOT_REPOSITORY_FULL_NAME",
                message: "Enter your repository name (owner/repo). Need to store your secrets in your repository.",
            },
        ],
    },
    {
        title: "Secret upload",
        questions: [
            {
                type: "input",
                name: "REPO_ADMIN_ACCESS_TOKEN",
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
                message: "Any URL (except smee.io) used should end with '/telegram'. e.g 'https://example.com/telegram'",
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
                message: "Enter your Supabase service key. This can be obtained from the Supabase dashboard.",
            },
            {
                type: "input",
                name: "SUPABASE_URL",
                message: "Enter your Supabase URL. This can be obtained from the Supabase dashboard.",
            },
        ],
    },
    {
        title: "Workflow Functions",
        questions: [
            {
                type: "input",
                name: "SOURCE_REPOSITORY",
                message: "Enter the repository where the workflow functions are located.",
            },
            {
                type: "input",
                name: "SOURCE_REPO_OWNER",
                message: "Enter the owner of the repository where the workflow functions are located.",
            },
            {
                type: "input",
                name: "TARGET_BRANCH",
                message: "Enter the target branch for the workflow functions.",
            },
        ],
    },
    {
        title: "API keys",
        questions: [
            {
                type: "input",
                name: "VOYAGEAI_API_KEY",
                message: "Enter your Voyage AI API key. This can be obtained from the Voyage AI dashboard.",
            },
            {
                type: "input",
                name: "OPENAI_API_KEY",
                message: "Enter your OpenAI API key. This can be obtained from the OpenAI dashboard.",
            },
            {
                type: "input",
                name: "OPENROUTER_API_KEY",
                message: "Enter your OpenRouter API key. This can be obtained from the OpenRouter dashboard.",
            },
            {
                type: "input",
                name: "APP_ID",
                message: "Enter your kernel app id. This can be obtained from your kernel .env file.",
            },
            {
                type: "input",
                name: "APP_PRIVATE_KEY",
                message: "Enter your kernel private key. This can be obtained from your kernel .env file.",
            },
            {
                type: "input",
                name: "KERNEL_PUBLIC_KEY",
                message: "Enter your Kernel public key. This can be obtained from your Kernel private key.",
                optional: true,
            },
            {
                type: "input",
                name: "TEMP_SAFE_PAT",
                message: "Enter your temporary safe personal access token. This is used for telegram side github api calls.",
            }
        ],
    },
] as const;
const answers: Record<string, Record<string, string>> = {};

async function run() {
    for (const step of steps) {
        for (const question of step.questions) {
            const answer = await promptUser(question);
            if (answer) {
                if (question.name === "REPO_ADMIN_ACCESS_TOKEN") {
                    const success = await testAccessToken(answer);
                    if (!success) {
                        logger.error("Invalid access token provided");
                        return;
                    }
                }

                if (question.name === "TELEGRAM_BOT_ADMINS") {
                    const adminArray = answer.split(",").map((id: string) => Number(id.trim()));
                    answers[step.title] ??= {};
                    answers[step.title][question.name] = adminArray;
                    continue;
                }

                answers[step.title] ??= {};
                answers[step.title][question.name] = answer;
            } else {
                logger.error("No answer provided for question", { question });
            }
        }
    }

    const parsedEnv = {
        TELEGRAM_BOT_ENV: {
            botSettings: answers["Bot settings"],
            mtProtoSettings: answers["MTProto settings"],
            storageSettings: answers["Storage settings"],
            workflowFunctions: answers["Workflow Functions"],
        },
        APP_ID: answers["API keys"]["APP_ID"],
        APP_PRIVATE_KEY: answers["API keys"]["APP_PRIVATE_KEY"],
        VOYAGEAI_API_KEY: answers["API keys"]["VOYAGEAI_API_KEY"],
        KERNEL_PUBLIC_KEY: answers["API keys"]["KERNEL_PUBLIC_KEY"],
        OPENAI_API_KEY: answers["API keys"]["OPENAI_API_KEY"],
        OPENROUTER_API_KEY: answers["API keys"]["OPENROUTER_API_KEY"],
        TEMP_SAFE_PAT: answers["API keys"]["TEMP_SAFE_PAT"],
    } as unknown as Context["env"];

    await saveEnv(parsedEnv);

    for (const [key, value] of Object.entries(parsedEnv)) {
        // push each one to the repository
        await storeSecret(key, value, answers["Repository settings"]["TELEGRAM_BOT_REPOSITORY_FULL_NAME"], answers["Secret upload"]["REPO_ADMIN_ACCESS_TOKEN"]);
    }

    logger.ok("Environment setup completed successfully");
}

function getOwnerRepo() {
    const ownerRepo = answers["Repository settings"]["TELEGRAM_BOT_REPOSITORY_FULL_NAME"];
    const [owner, repo] = ownerRepo.split("/");
    return { owner, repo };
}

async function testAccessToken(token: string) {
    const secret = `{}`;
    try {
        const { owner, repo } = getOwnerRepo();
        await storeSecret("TELEGRAM_BOT_ENV", secret, `${owner}/${repo}`, token);
        return true;
    } catch (e) {
        logger.error("Error testing access token", { e });
        return false;
    }
}

export async function saveEnv(envVars: Context["env"]) {
    const paths = [".env", ".dev.vars"];

    for (const path of paths) {
        for (const [key, value] of Object.entries(envVars)) {
            if (typeof value === "object") {
                await appendFile(path, `${key}=${JSON.stringify(value)}\n`, "utf-8");
            } else {
                await appendFile(path, `${key}=${value}\n`, "utf-8");
            }
        }
    }
}

run().catch(console.error);
