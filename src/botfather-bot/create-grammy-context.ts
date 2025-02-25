import type { Update, UserFromGetMe } from "@grammyjs/types";
import { Octokit } from "@octokit/rest";
import { type Api, Context as DefaultContext, type SessionFlavor } from "grammy";
import type { AutoChatActionFlavor } from "@grammyjs/auto-chat-action";
import type { HydrateFlavor } from "@grammyjs/hydrate";
import type { ParseModeFlavor } from "@grammyjs/parse-mode";
import { Octokit as RestOctokitFromApp } from "octokit";
import { PluginEnvContext } from "../types/plugin-env-context";
import { Logger } from "../utils/logger";
import { createAdapters } from "../adapters";

export type GrammyTelegramUpdate = Update;

export interface SessionData {
  field?: string;
}

interface Dependencies {
  logger: Logger;
  octokit: RestOctokitFromApp | Octokit;
  pluginEnvCtx: PluginEnvContext;
}

interface ExtendedContextFlavor extends Dependencies {
  adapters: ReturnType<typeof createAdapters>;
}

export type GrammyContext = ParseModeFlavor<HydrateFlavor<DefaultContext & ExtendedContextFlavor & SessionFlavor<SessionData> & AutoChatActionFlavor>>;

export async function createContextConstructor({ logger, octokit, pluginEnvCtx }: Dependencies) {
  const adapters = (await pluginEnvCtx.createFullPluginInputsContext()).adapters;

  return class extends DefaultContext implements ExtendedContextFlavor {
    logger: Logger;
    octokit: RestOctokitFromApp | Octokit = octokit;
    adapters: ReturnType<typeof createAdapters>;
    pluginEnvCtx: PluginEnvContext = pluginEnvCtx;

    constructor(update: GrammyTelegramUpdate, api: Api, me: UserFromGetMe) {
      super(update, api, me);
      this.logger = logger;

      if (!adapters) {
        throw new Error("Adapters not initialized");
      }

      this.adapters = adapters;
    }
  } as unknown as new (update: GrammyTelegramUpdate, api: Api, me: UserFromGetMe) => GrammyContext;
}
