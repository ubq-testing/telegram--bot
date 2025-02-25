import type { Update, UserFromGetMe } from "@grammyjs/types";
import { Octokit } from "@octokit/rest";
import { type Api, Context as DefaultContext, type SessionFlavor } from "grammy";
import type { AutoChatActionFlavor } from "@grammyjs/auto-chat-action";
import type { HydrateFlavor } from "@grammyjs/hydrate";
import type { ParseModeFlavor } from "@grammyjs/parse-mode";
import { Context as UbiquityOsContext } from "../../types";
import { Logger } from "../../utils/logger";
import { createAdapters } from "../../adapters";
import { PluginEnvContext } from "../../types/plugin-env-context";
import { Octokit as RestOctokitFromApp } from "octokit";

export type GrammyTelegramUpdate = Update;

export interface SessionData {
  field?: string;
}

interface Dependencies {
  logger: Logger;
  config: UbiquityOsContext["env"];
  octokit: RestOctokitFromApp | Octokit;
  pluginEnvCtx: PluginEnvContext;
}

interface ExtendedContextFlavor extends Dependencies {
  adapters: ReturnType<typeof createAdapters>;
}

export type GrammyContext = ParseModeFlavor<HydrateFlavor<DefaultContext & ExtendedContextFlavor & SessionFlavor<SessionData> & AutoChatActionFlavor>>;

export async function createContextConstructor({ logger, config, octokit, pluginEnvCtx }: Dependencies) {
  const adapters = (await pluginEnvCtx.getContext()).adapters;

  if (!adapters) {
    throw new Error("Adapters not initialized");
  }

  return class extends DefaultContext implements ExtendedContextFlavor {
    logger: Logger;
    octokit: RestOctokitFromApp | Octokit = octokit;
    config: UbiquityOsContext["env"];
    adapters: ReturnType<typeof createAdapters>;
    pluginEnvCtx: PluginEnvContext = pluginEnvCtx;

    constructor(update: GrammyTelegramUpdate, api: Api, me: UserFromGetMe) {
      super(update, api, me);
      this.logger = logger;
      this.config = config;

      if (!adapters) {
        throw new Error("Adapters not initialized");
      }

      this.adapters = adapters;
    }
  } as unknown as new (update: GrammyTelegramUpdate, api: Api, me: UserFromGetMe) => GrammyContext;
}
