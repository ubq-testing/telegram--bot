import type { Update, UserFromGetMe } from "@grammyjs/types";
import { type Api, Context as DefaultContext, type SessionFlavor } from "grammy";
import type { AutoChatActionFlavor } from "@grammyjs/auto-chat-action";
import type { HydrateFlavor } from "@grammyjs/hydrate";
import type { ParseModeFlavor } from "@grammyjs/parse-mode";
import { Context as UbiquityOsContext } from "../../types";
import { Logger } from "../../utils/logger";
import { createAdapters } from "../../adapters";
import { PluginContext } from "../../types/plugin-context-single";
import { Octokit } from "@octokit/rest";
import { Octokit as AppOctokit } from "octokit";

export type GrammyTelegramUpdate = Update;

export interface SessionData {
  field?: string;
}

interface Dependencies {
  logger: Logger;
  config: UbiquityOsContext["env"];
  octokit: AppOctokit;
}

interface ExtendedContextFlavor extends Dependencies {
  adapters: ReturnType<typeof createAdapters>;
}

export type GrammyContext = ParseModeFlavor<HydrateFlavor<DefaultContext & ExtendedContextFlavor & SessionFlavor<SessionData> & AutoChatActionFlavor>>;

export async function createContextConstructor({ logger, config, octokit }: Dependencies) {
  return class extends DefaultContext implements ExtendedContextFlavor {
    logger: Logger;
    adapters: ReturnType<typeof createAdapters>;
    octokit: AppOctokit = octokit;
    config: UbiquityOsContext["env"];

    constructor(update: GrammyTelegramUpdate, api: Api, me: UserFromGetMe) {
      super(update, api, me);
      const instance = PluginContext.getInstance();
      this.logger = logger;
      this.config = config;

      /**
       * We'll need to add handling to detect forks and in such cases
       * we'll need to handle the storage differently.
       *
       * Storing the repository full name would work, and we already have it
       * during setup. Otherwise via plugin config.
       *
       * if (me.username !== "ubiquity_os_bot") { }
       */

      /**
       * We only operate as one organization on telegram, so I'm assuming
       * that we'll be centralizing the storage obtained.
       */
      this.adapters = createAdapters(instance.getContext());
    }
  } as unknown as new (update: GrammyTelegramUpdate, api: Api, me: UserFromGetMe) => GrammyContext;
}
