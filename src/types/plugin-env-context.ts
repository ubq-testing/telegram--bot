import { Value } from "@sinclair/typebox/value";
import { createAdapters } from "../adapters";
import { PluginInputs, pluginSettingsSchema } from "./plugin-inputs";
import { Env, envValidator } from "./env";
import { Context } from "./context";
import { App } from "octokit";
import { logger } from "../utils/logger";
import { Octokit } from "@octokit/rest";
import { Octokit as RestOctokitFromApp } from "octokit";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { Bot } from "../bot";

export class PluginEnvContext {
  public _config: Context["config"];
  public _bot: Bot | null = null;

  constructor(
    public readonly inputs: PluginInputs,
    public _env: Env
  ) {
    this._config = this.inputs.settings;
    this._env = _env;
  }

  get env() {
    return Value.Decode(envValidator.schema, Value.Default(envValidator.schema, this._env));
  }

  set env(env: Env) {
    this._env = env;
  }

  get config() {
    return Value.Decode(pluginSettingsSchema, Value.Default(pluginSettingsSchema, this._config ?? {}));
  }

  set config(config: Context["config"]) {
    this._config = config;
  }

  getInputs(): PluginInputs {
    return this.inputs;
  }

  getApp() {
    try {
      const appId = this.env.APP_ID;
      const privateKey = this.env.APP_PRIVATE_KEY;

      if (!appId || !privateKey) {
        throw new Error("Storage app ID or private key not found");
      }

      return new App({
        appId,
        privateKey,
      });
    } catch (er) {
      throw logger.error("Error initializing storage app", { er });
    }
  }

  /**
   * Telegram payloads do not come with a token so we need to use the
   * GitHub app to interact with the GitHub API for bot commands like /register etc.
   *
   * This can be used with events from both Telegram and GitHub, this token comes from
   * the worker's environment variables i.e the Storage App.
   */
  async getTelegramEventOctokit(): Promise<RestOctokitFromApp | Octokit | null> {
    let octokit: RestOctokitFromApp | Octokit | null = null;

    try {
      await this.getApp().eachInstallation((installation) => {
        if (installation.installation.account?.login.toLowerCase() === this.config.storageOwner.toLowerCase()) {
          octokit = installation.octokit;
        }
      });
    } catch (er) {
      logger.error("Error initializing octokit in getTelegramEventOctokit", { er: String(er) });
    }

    if (!octokit) {
      logger.info("Falling back to TEMP_SAFE_PAT for octokit");
      octokit = new Octokit({ auth: this.env.TEMP_SAFE_PAT });
    }

    if (!octokit) {
      throw new Error("Octokit could not be initialized");
    }

    return octokit;
  }

  /**
   * GitHub payloads come with their own token so this can only
   * be used in logic that is triggered by a GitHub event.
   */
  getGitHubEventOctokit() {
    return new Octokit({ auth: this.inputs.authToken });
  }

  /**
   * Prior to GitHub storage which leverages a separate app for storage,
   * this function will not contain an octokit token needed in order to
   * interact with the GitHub API.
   *
   */
  async getContext(): Promise<Context> {
    // use the octokit which we know for sure has a token for both payloads
    const octokit = await this.getTelegramEventOctokit();

    if (!octokit) {
      throw new Error("Octokit could not be initialized");
    }

    const ctx = {
      eventName: this.inputs.eventName,
      payload: this.inputs.eventPayload,
      config: this.config,
      octokit: !this.inputs.authToken ? octokit : this.getGitHubEventOctokit(),
      env: this.env,
      logger: logger as Logs,
      bot: this._bot,
      pluginEnvCtx: this,
    } as unknown as Context;

    return {
      ...ctx,
      adapters: createAdapters(ctx),
    };
  }
}
