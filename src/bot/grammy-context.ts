import type { Update, UserFromGetMe } from '@grammyjs/types'
import { type Api, Context as DefaultContext, type SessionFlavor } from 'grammy'
import type { AutoChatActionFlavor } from '@grammyjs/auto-chat-action'
import type { HydrateFlavor } from '@grammyjs/hydrate'
import type { ParseModeFlavor } from '@grammyjs/parse-mode'
import type { Logger } from '#root/logger.js'
import { Context as UbiquityOsContext } from '../types'

export interface SessionData {
  // field?: string;
}

interface ExtendedContextFlavor {
  logger: Logger
  config: UbiquityOsContext["env"]
}

export type Context = ParseModeFlavor<
  HydrateFlavor<
    DefaultContext &
    ExtendedContextFlavor &
    SessionFlavor<SessionData> &
    AutoChatActionFlavor
  >
>

interface Dependencies {
  logger: Logger
  config: UbiquityOsContext["env"]
}

export function createContextConstructor(
  {
    logger,
    config,
  }: Dependencies,
) {
  return class extends DefaultContext implements ExtendedContextFlavor {
    logger: Logger
    config: UbiquityOsContext["env"]

    constructor(update: Update, api: Api, me: UserFromGetMe) {
      super(update, api, me)

      this.logger = logger
      this.config = config
    }
  } as unknown as new (update: Update, api: Api, me: UserFromGetMe) => Context
}
