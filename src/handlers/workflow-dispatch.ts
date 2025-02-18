import { App } from "octokit";
import { Context } from "../types";
import { PluginContext } from "../types/plugin-context-single";

export async function workflowDispatch(context: Context, workflowFunctionName: string) {
  const inputs = PluginContext.getInstance().getInputs();
  const { logger } = context;

  /**
   * These should probably remain hardcoded so that it is not
   * possible to dispatch workflows to other repositories.
   */
  const repository = "ubiquity-os-kernel-telegram";
  const owner = "ubiquity-os-marketplace";
  const branch = "development";

  const {
    env: { APP_ID, APP_PRIVATE_KEY },
  } = context;
  const app = new App({ appId: APP_ID, privateKey: APP_PRIVATE_KEY });
  const installation = await app.octokit.rest.apps.getRepoInstallation({ owner, repo: repository });

  const octokit = await app.getInstallationOctokit(installation.data.id);

  logger.info(`Dispatching workflow function`, {
    repository,
    owner,
    branch,
    workflowFunctionName,
  });

  Reflect.deleteProperty(inputs, "signature");

  return await octokit.rest.actions.createWorkflowDispatch({
    owner,
    repo: repository,
    workflow_id: "compute.yml",
    ref: branch,
    inputs: {
      ...inputs,
      eventPayload: JSON.stringify(context.payload),
      settings: JSON.stringify(context.config),
    },
  });
}
