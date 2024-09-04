import { App } from "octokit";
import { Context } from "../types";

export async function getAppOctokit(context: Context) {
    const { env: { APP_ID, APP_PRIVATE_KEY } } = context;
    return new App({ appId: APP_ID, privateKey: APP_PRIVATE_KEY });
}