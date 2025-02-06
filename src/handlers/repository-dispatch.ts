import { App } from "octokit";
import { Context } from "../types";
import { PluginContext } from "../types/plugin-context-single";

export async function repositoryDispatch(context: Context, workflow: string) {
  const inputs = PluginContext.getInstance().getInputs();
  const { logger } = context;

  const repository = "telegram--bot";
  const owner = "ubq-testing";
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
    workflow,
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
