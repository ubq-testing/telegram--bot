import { getAppOctokit } from "#root/helpers/authenticated-octokit.js";
import { PluginContext } from "#root/utils/plugin-context-single.js";
import { Context } from "../types";

/**
 * Used by the worker instance to kick off workflows within it's own repository.
 * 
 * These workflows are extensions of the worker allowing for more complex operations
 * to be performed outside of Cloudflare Workers' limitations.
 * 
 * @param env The environment variables for the worker instance. These
 *        will be taken from the repository's secrets.
 * @param args The arguments passed to the workflow.
 * 
 */

export async function repositoryDispatch(context: Context, workflow: string) {
    const inputs = PluginContext.getInstance().getInputs();
    const { logger } = context;
    const repository = "telegram--bot";
    const owner = "ubq-testing";
    const branch = "workflows";
    const octokit = await getAppOctokit(context);

    logger.info(`Dispatching workflow function: ${workflow}`);

    /**
     * We'll hit the main workflow entry and pass in the same inputs so
     * that it essentially runs on the same context as the worker.
     */
    return await octokit.rest.actions.createWorkflowDispatch({
        owner,
        repo: repository,
        workflow_id: "compute.yml",
        ref: branch,
        inputs: {
            ...inputs,
            workflowFunction: workflow // here for the workflow logs, not used in the workflow
        }
    });
}

