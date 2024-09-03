import { Octokit } from "@octokit/rest";
import { Context } from "../types";

export async function getAppOctokit(context: Context) {
    const { env } = context;
    const { APP_ID, APP_PRIVATE_KEY } = env;
    const appOctokit = new Octokit({
        auth: {
            appId: APP_ID,
            privateKey: APP_PRIVATE_KEY,
        },
    });

    return appOctokit;
}