import { App } from "octokit";
import { Context } from "../types";

export async function getAppOctokit(context: Context) {
    const { env } = context;
    const { APP_ID, APP_PRIVATE_KEY } = env;
    const app = new App({
        appId: APP_ID,
        privateKey: APP_PRIVATE_KEY,
    })

    return app.octokit;
}