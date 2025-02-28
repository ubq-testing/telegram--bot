import * as core from "@actions/core";
import * as github from "@actions/github";
import { Value } from "@sinclair/typebox/value";
import { envValidator, pluginSettingsSchema, PluginInputs, pluginSettingsValidator, Env } from "./types";
import { PluginEnvContext } from "./types/plugin-env-context";
import { logger } from "./utils/logger";
import dotenv from "dotenv";
import { runGitHubWorkflowEntry } from "./plugin";
import { initializeBotFatherInstance } from "./botfather-bot/initialize-botfather-instance";
dotenv.config();

async function initWorkflowPluginContext(inputs: PluginInputs, env: Env) {
  const pluginEnvContext = new PluginEnvContext(inputs, env);
  const botFatherInstance = await initializeBotFatherInstance(pluginEnvContext);
  if (!botFatherInstance) {
    throw new Error("BotFatherInstance not initialized");
  }
  pluginEnvContext.setBotFatherContext(botFatherInstance);
  return pluginEnvContext;
}

async function run() {
  const payload = github.context.payload.inputs;

  let env, settings;

  const payloadEnv = {
    TELEGRAM_BOT_ENV: process.env.TELEGRAM_BOT_ENV,
    APP_ID: process.env.APP_ID,
    APP_PRIVATE_KEY: process.env.APP_PRIVATE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    VOYAGEAI_API_KEY: process.env.VOYAGEAI_API_KEY ?? "", // not used through workflows
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

  const pluginEnvContext = await initWorkflowPluginContext(inputs, env);
  const context = await pluginEnvContext.createFullPluginInputsContext(inputs);
  return await runGitHubWorkflowEntry(context);
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
