import { Value } from "@sinclair/typebox/value";
import { Logs } from "@ubiquity-dao/ubiquibot-logger";
import { createAdapters } from "../adapters";
import { PluginInputs, pluginSettingsSchema } from "./plugin-inputs";
import { Env, envValidator } from "./env";
import { Context } from "./context";
import { App } from "octokit";
import { logger } from "../utils/logger";
import { Octokit } from "@octokit/rest";

/**
 * Singleton for the plugin context making accessing it throughout
 * the "two branches" of the codebase easier.
 *
 * This is used with both the worker and the workflows.
 */
export class PluginContext {
  private static _instance: PluginContext;
  public _config: Context["config"];

  private constructor(
    public readonly inputs: PluginInputs,
    public _env: Env
  ) {
    this._config = this.inputs.settings;
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

  static initialize(inputs: PluginInputs, env: Env): Context {
    PluginContext._instance = new PluginContext(inputs, env);
    return PluginContext._instance.getContext();
  }

  static getInstance(): PluginContext {
    if (!PluginContext._instance) {
      throw new Error("PluginContext not initialized");
    }
    return PluginContext._instance;
  }

  getInputs(): PluginInputs {
    return this.inputs;
  }

  getApp() {
    try {
      const appId = this.env.STORAGE_APP_ID;
      const privateKey = this.env.STORAGE_APP_PRIVATE_KEY;

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

  getAppOctokit() {
    const app = this.getApp();
    return app.octokit;
  }

  getStdOctokit() {
    return new Octokit({ auth: this.inputs.authToken });
  }

  /**
   * Prior to GitHub storage which leverages a separate app for storage,
   * this function will not contain an octokit token needed in order to
   * interact with the GitHub API.
   *
   */
  getContext(): Context {
    const octokit: Context["octokit"] = this.getApp().octokit;

    if (!octokit) {
      throw new Error("Octokit could not be initialized");
    }

    const ctx = {
      eventName: this.inputs.eventName,
      payload: this.inputs.eventPayload,
      config: this.config,
      octokit,
      env: this.env,
      logger: new Logs("verbose"),
    } as Context;

    return {
      ...ctx,
      adapters: createAdapters(ctx),
    };
  }
}
