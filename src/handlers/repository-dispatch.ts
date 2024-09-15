import { PluginContext } from "#root/types/plugin-context-single.js";
import { App } from "octokit";
import { Context } from "../types";

/**
 * Used by the worker instance to kick off workflows within it's own repository.
 *
 * These workflows are extensions of the worker allowing for more complex operations
 * to be performed outside of Cloudflare Workers' limitations.
 */
export async function repositoryDispatch(context: Context, workflow: string) {
  const inputs = PluginContext.getInstance().getInputs();
  const {
    logger,
    env: { TELEGRAM_BOT_REPOSITORY_FULL_NAME },
  } = context;
  if (!TELEGRAM_BOT_REPOSITORY_FULL_NAME) {
    throw new Error("TELEGRAM_BOT_REPOSITORY_FULL_NAME env variable is not set");
  }

  const [owner, repository] = TELEGRAM_BOT_REPOSITORY_FULL_NAME.split("/");

  const {
    env: {
      TELEGRAM_BOT_ENV: {
        ubiquityOsSettings: { APP_ID, APP_PRIVATE_KEY },
      },
    },
    config: { targetBranch },
  } = context;
  const app = new App({ appId: APP_ID, privateKey: APP_PRIVATE_KEY });
  const installation = await app.octokit.rest.apps.getRepoInstallation({ owner, repo: repository });

  const octokit = await app.getInstallationOctokit(installation.data.id);

  logger.info(`Dispatching workflow function: ${workflow}`);

  /**
   * We'll hit the main workflow entry and pass in the same inputs so
   * that it essentially runs on the same context as the worker.
   */

  Reflect.deleteProperty(inputs, "signature");

  return await octokit.rest.actions.createWorkflowDispatch({
    owner,
    repo: repository,
    workflow_id: "compute.yml",
    ref: targetBranch ?? "development",
    inputs: {
      ...inputs,
      eventPayload: JSON.stringify(context.payload),
      settings: JSON.stringify(context.config),
    },
  });
}
