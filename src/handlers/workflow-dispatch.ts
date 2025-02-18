import { App } from "octokit";
import { Context, PluginContextAndEnv } from "../types";

export async function workflowDispatch(context: Context, workflowFunctionName: string, ctx: PluginContextAndEnv) {
  const inputs = ctx.pluginCtx.getInputs();
  const { logger, config: { workflowfunctions: {
    targetBranch,
    sourceRepoOwner,
    sourceRepository
  } } } = context;

  const {
    env: { APP_ID, APP_PRIVATE_KEY },
  } = context;
  const app = new App({ appId: APP_ID, privateKey: APP_PRIVATE_KEY });
  const installation = await app.octokit.rest.apps.getRepoInstallation({ owner: sourceRepoOwner, repo: sourceRepository });

  const octokit = await app.getInstallationOctokit(installation.data.id);

  logger.info(`Dispatching workflow function`, {
    sourceRepository,
    sourceRepoOwner,
    targetBranch,
    workflowFunctionName,
  });

  Reflect.deleteProperty(inputs, "signature");

  return await octokit.rest.actions.createWorkflowDispatch({
    owner: sourceRepoOwner,
    repo: sourceRepository,
    workflow_id: "compute.yml",
    ref: targetBranch,
    inputs: {
      ...inputs,
      eventPayload: JSON.stringify(context.payload),
      settings: JSON.stringify(context.config),
    },
  });
}
