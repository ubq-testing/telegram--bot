import * as core from "@actions/core";
import * as github from "@actions/github";
import { Value } from "@sinclair/typebox/value";
import { envValidator, pluginSettingsSchema, PluginInputs, pluginSettingsValidator } from "./types";
import { PluginContext } from "./types/plugin-context-single";
import { bubbleUpErrorComment } from "./utils/errors";
import dotenv from "dotenv";
import { proxyWorkflowCallbacks } from "./handlers/workflow-proxy";
import { logger } from "./utils/logger";
dotenv.config();

/**
 * Main entry point for the workflow functions
 */
export async function run() {
  const payload = github.context.payload.inputs;

  let env, settings;

  const payloadEnv = {
    TELEGRAM_BOT_ENV: process.env.TELEGRAM_BOT_ENV,
  };

  try {
    env = Value.Decode(envValidator.schema, payloadEnv);
  } catch (err) {
    logger.error("Error decoding env: ", { err });
  }

  try {
    settings = Value.Decode(pluginSettingsSchema, Value.Default(pluginSettingsSchema, JSON.parse(payload.settings)));
  } catch (err) {
    logger.error("Error decoding settings: ", { err });
  }

  if (!(settings && env)) {
    throw new Error("Invalid settings or env provided");
  }

  if (!pluginSettingsValidator.test(settings)) {
    throw new Error("Invalid settings provided");
  }

  const inputs: PluginInputs = {
    stateId: payload.stateId,
    eventName: payload.eventName,
    eventPayload: JSON.parse(payload.eventPayload),
    settings,
    authToken: payload.authToken,
    ref: payload.ref,
  };

  PluginContext.initialize(inputs, env);

  const context = PluginContext.getInstance().getContext();

  try {
    return proxyWorkflowCallbacks(context)[inputs.eventName];
  } catch (err) {
    return bubbleUpErrorComment(context, err);
  }
}

// Might use this later to receive data back from it's own workflows
// async function returnDataToKernel(repoToken: string, stateId: string, output: object) {
//   const octokit = new Octokit({ auth: repoToken });
//   await octokit.repos.createDispatchEvent({
//     owner: github.context.repo.owner,
//     repo: github.context.repo.repo,
//     event_type: "return_data_to_ubiquibot_kernel",
//     client_payload: {
//       state_id: stateId,
//       output: JSON.stringify(output),
//     },
//   });
// }

run()
  .then((result) => {
    core.setOutput("result", result);
  })
  .catch((err) => {
    logger.error("Error running workflow: ", { err });
    core.setFailed(err);
  });
