import type { Update, UserFromGetMe } from "@grammyjs/types";
import { type Api, Context as DefaultContext, type SessionFlavor } from "grammy";
import type { AutoChatActionFlavor } from "@grammyjs/auto-chat-action";
import type { HydrateFlavor } from "@grammyjs/hydrate";
import type { ParseModeFlavor } from "@grammyjs/parse-mode";
import type { Logger } from "#root/utils/logger.js";
import { Context as UbiquityOsContext } from "../../types";
import { createAdapters } from "#root/adapters/index.js";
import { createClient } from "@supabase/supabase-js";

export type GrammyTelegramUpdate = Update;

export interface SessionData {
  field?: string;
}

interface ExtendedContextFlavor {
  logger: Logger;
  config: UbiquityOsContext["env"];
  adapters: ReturnType<typeof createAdapters>;
}

export type Context = ParseModeFlavor<HydrateFlavor<DefaultContext & ExtendedContextFlavor & SessionFlavor<SessionData> & AutoChatActionFlavor>>;

interface Dependencies {
  logger: Logger;
  config: UbiquityOsContext["env"];
}

export function createContextConstructor({ logger, config }: Dependencies) {
  return class extends DefaultContext implements ExtendedContextFlavor {
    logger: Logger;
    config: UbiquityOsContext["env"];
    adapters: ReturnType<typeof createAdapters>;

    constructor(update: GrammyTelegramUpdate, api: Api, me: UserFromGetMe) {
      super(update, api, me);

      this.logger = logger;
      this.config = config;
      const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = config.TELEGRAM_BOT_ENV.storageSettings;
      this.adapters = createAdapters(createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY));
    }
  } as unknown as new (update: GrammyTelegramUpdate, api: Api, me: UserFromGetMe) => Context;
}
