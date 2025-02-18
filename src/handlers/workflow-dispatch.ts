import { App } from "octokit";
import { Context } from "../types";

export async function workflowDispatch(context: Context, workflowFunctionName: string) {
  const inputs = context.pluginCtx.getInputs();
  const {
    logger,
    env: {
      TELEGRAM_BOT_ENV: {
        workflowFunctions: { SOURCE_REPOSITORY, SOURCE_REPO_OWNER, TARGET_BRANCH },
      },
    },
  } = context;

  const {
    env: { APP_ID, APP_PRIVATE_KEY },
  } = context;
  const app = new App({ appId: APP_ID, privateKey: APP_PRIVATE_KEY });
  const installation = await app.octokit.rest.apps.getRepoInstallation({ owner: SOURCE_REPO_OWNER, repo: SOURCE_REPOSITORY });

  const octokit = await app.getInstallationOctokit(installation.data.id);

  logger.info(`Dispatching workflow function`, {
    SOURCE_REPOSITORY,
    SOURCE_REPO_OWNER,
    TARGET_BRANCH,
    workflowFunctionName,
  });

  Reflect.deleteProperty(inputs, "signature");

  return await octokit.rest.actions.createWorkflowDispatch({
    owner: SOURCE_REPO_OWNER,
    repo: SOURCE_REPOSITORY,
    workflow_id: "compute.yml",
    ref: TARGET_BRANCH,
    inputs: {
      ...inputs,
      eventPayload: JSON.stringify(context.payload),
      settings: JSON.stringify(context.config),
    },
  });
}
