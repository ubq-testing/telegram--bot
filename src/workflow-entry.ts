import * as core from "@actions/core";
import * as github from "@actions/github";
import { Value } from "@sinclair/typebox/value";
import { envValidator, pluginSettingsSchema, PluginInputs, pluginSettingsValidator } from "./types";
import { PluginContext } from "./utils/plugin-context-single";
import { proxyWorkflowCallbacks } from "./handlers/callbacks-proxy";
import { bubbleUpErrorComment, sanitizeMetadata } from "./utils/errors";
import dotenv from "dotenv";
dotenv.config();


/**
 * How a GitHub action executes the plugin.
 */
export async function run() {
  const payload = github.context.payload.inputs;
  let env, settings;
  try {
    env = Value.Decode(envValidator.schema, process.env);
  } catch (err) {
    console.log("Error decoding env: ", err);
  }

  try {
    settings = Value.Decode(pluginSettingsSchema, Value.Default(pluginSettingsSchema, JSON.parse(payload.settings)));
  } catch (err) {
    console.log("Error decoding settings: ", err);
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
    return bubbleUpErrorComment(context, err)
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
  .catch((error) => {
    console.error(error);
    core.setFailed(error);
  });
