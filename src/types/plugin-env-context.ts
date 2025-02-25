import { PluginInputs, pluginSettingsSchema } from "./plugin-inputs";
import { Env, envValidator } from "./env";
import { Context } from "./context";
import { App } from "octokit";
import { logger } from "../utils/logger";
import { Octokit } from "@octokit/rest";
import { Octokit as RestOctokitFromApp } from "octokit";
import { Value } from "@sinclair/typebox/value";
import { createAdapters } from "../adapters";
import { BotFatherInitializer } from "./botfather-initializer";
import { Bot } from "../botfather-bot/create-bot";

export class PluginEnvContext {
  private _config: Context["config"];
  private _botFatherHonoApp: BotFatherInitializer["_server"] | null = null;
  private _botFatherBot: Bot | null = null;

  constructor(
    private readonly _inputs: PluginInputs,
    private _env: Env
  ) {
    this._config = this._inputs.settings;
  }

  async createFullPluginInputsContext(inputs?: PluginInputs): Promise<Context> {
    let payload: Context["payload"];

    // Using a ternary will produce a union too complex for TypeScript to understand
    if (inputs?.eventPayload) {
      payload = inputs.eventPayload;
    } else {
      payload = this._inputs.eventPayload;
    }

    const ctx = {
      eventName: inputs?.eventName ?? this._inputs.eventName,
      payload,
      config: this._config,
      octokit: new Octokit({ auth: inputs?.authToken ?? this._inputs.authToken }),
      env: this._env,
      logger: logger,
      pluginEnvCtx: this,
    } as unknown as Context;

    return {
      ...ctx,
      adapters: createAdapters(ctx),
    };
  }

  setBotFatherContext({ bot, server }: { server: BotFatherInitializer["_server"]; bot: Bot }) {
    this._botFatherBot = bot;
    this._botFatherHonoApp = server;
  }

  getBotFatherHonoApp(): BotFatherInitializer["_server"] {
    if (!this._botFatherHonoApp) {
      throw new Error("BotFatherHonoApp not initialized");
    }
    return this._botFatherHonoApp;
  }

  getBotFatherBot(): Bot {
    if (!this._botFatherBot) {
      throw new Error("BotFatherBot not initialized");
    }
    return this._botFatherBot;
  }

  getInputs(): PluginInputs {
    return this._inputs;
  }

  getEnv(): Env {
    return Value.Decode(envValidator.schema, Value.Default(envValidator.schema, this._env));
  }

  getPluginConfigSettings(): Context["config"] {
    return Value.Decode(pluginSettingsSchema, Value.Default(pluginSettingsSchema, this._config ?? {}));
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
      await this._getApp().eachInstallation((installation) => {
        if (installation.installation.account?.login.toLowerCase() === this._config.storageOwner.toLowerCase()) {
          octokit = installation.octokit;
        }
      });
    } catch (er) {
      logger.error("Error initializing octokit in getTelegramEventOctokit", { er: String(er) });
    }

    if (!octokit) {
      logger.info("Falling back to TEMP_SAFE_PAT for octokit");
      octokit = new Octokit({ auth: this._env.TEMP_SAFE_PAT });
    }

    if (!octokit) {
      throw new Error("Octokit could not be initialized");
    }

    return octokit;
  }

  private _getApp() {
    try {
      const appId = this._env.APP_ID;
      const privateKey = this._env.APP_PRIVATE_KEY;

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
}
