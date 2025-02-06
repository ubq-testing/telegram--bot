import * as core from "@actions/core";
import * as github from "@actions/github";
import { Value } from "@sinclair/typebox/value";
import { envValidator, pluginSettingsSchema, PluginInputs, pluginSettingsValidator } from "./types";
import { PluginContext } from "./types/plugin-context-single";
import dotenv from "dotenv";
import { logger } from "./utils/logger";
import { proxyWorkflowCallbacks } from "./handlers/workflow-proxy";
dotenv.config();

/**
 * Main entry point for the workflow functions
 */
export async function run() {
  const payload = github.context.payload.inputs;

  let env, settings;

  const payloadEnv = {
    TELEGRAM_BOT_ENV: process.env.TELEGRAM_BOT_ENV,
    APP_ID: process.env.APP_ID,
    APP_PRIVATE_KEY: process.env.APP_PRIVATE_KEY,
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
    command: payload.command,
    signature: payload.signature,
  };

  PluginContext.initialize(inputs, env);

  const context = await PluginContext.getInstance().getContext();
  return proxyWorkflowCallbacks(context)[inputs.eventName];
}

run()
  .then((result) => {
    core.setOutput("result", result);
  })
  .catch((err) => {
    logger.error("Error running workflow: ", { err });
    core.setFailed(err);

    if ("errorMessage" in err && err.errorMessage === "AUTH_KEY_DUPLICATED") {
      /**
       * Basically the server has decided that we are kicked at this point and
       * will manual handling by a CODEOWNER or project admin that has the
       * access needed in order to actually reset the auth key.
       *
       * We could try using the Bot API to send a message to the admins of the bot here
       */
    }

    process.exit(0);
  });
