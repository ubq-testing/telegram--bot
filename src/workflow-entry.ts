import * as core from "@actions/core";
import * as github from "@actions/github";
import { Value } from "@sinclair/typebox/value";
import { envValidator, pluginSettingsSchema, PluginInputs, pluginSettingsValidator } from "./types";
import { PluginContext } from "./types/plugin-context-single";
import { bubbleUpErrorComment } from "./utils/errors";
import dotenv from "dotenv";
import { proxyWorkflowCallbacks } from "./handlers/workflow-proxy";
dotenv.config();

/**
 * Main entry point for the workflow functions
 */
export async function run() {
  const payload = github.context.payload.inputs;

  let env, settings;

  const payloadEnv = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    BOT_MODE: process.env.BOT_MODE,
    LOG_LEVEL: process.env.LOG_LEVEL,
    DEBUG: process.env.DEBUG,
    BOT_WEBHOOK: process.env.BOT_WEBHOOK,
    BOT_WEBHOOK_SECRET: process.env.BOT_WEBHOOK_SECRET,
    BOT_ADMINS: process.env.BOT_ADMINS,
    TELEGRAM_APP_ID: process.env.TELEGRAM_APP_ID,
    TELEGRAM_API_HASH: process.env.TELEGRAM_API_HASH,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
    APP_PRIVATE_KEY: process.env.APP_PRIVATE_KEY,
    APP_ID: process.env.APP_ID,
  };

  try {
    env = Value.Decode(envValidator.schema, payloadEnv);
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
  .catch((error) => {
    console.error(error);
    core.setFailed(error);
  });
