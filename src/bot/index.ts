
import type { BotConfig, StorageAdapter } from 'grammy'
import { Bot as TelegramBot } from 'grammy'
import type { Context, SessionData } from '#root/bot/context.js'
import { createContextConstructor } from '#root/bot/context.js'
import type { Logger } from '#root/logger.js'
import { Context as UbiquityOsContext } from '../types'
import { welcomeFeature } from '#root/bot/features/welcome.js'
import { unhandledFeature } from '#root/bot/features/unhandled.js'
import { errorHandler } from '#root/bot/handlers/error.js'
import { session } from '#root/bot/middlewares/session.js'
import { autoChatAction } from '@grammyjs/auto-chat-action'
import { hydrate } from '@grammyjs/hydrate'
import { hydrateReply, parseMode } from '@grammyjs/parse-mode'
import { i18n } from './i18n'
import { adminFeature } from './features/admin'
import { userIdFeature } from './features/user-id'
import { createForumsFeature } from './features/workroom'
import { chatIdFeature } from './features/chatid'

interface Dependencies {
  config: UbiquityOsContext["env"]
  logger: Logger
}

interface Options {
  botSessionStorage?: StorageAdapter<SessionData>
  botConfig?: Omit<BotConfig<Context>, 'ContextConstructor'>
}

function getSessionKey(ctx: Omit<Context, 'session'>) {
  return ctx.chat?.id.toString()
}

export function createBot(token: string, dependencies: Dependencies, options: Options = {}) {
  const {
    config,
    logger,
  } = dependencies

  const bot = new TelegramBot(token, {
    ...options.botConfig,
    ContextConstructor: createContextConstructor({
      logger,
      config,
    }),
  })
  const protectedBot = bot.errorBoundary(errorHandler)

  // // Middlewares
  bot.api.config.use(parseMode('HTML'))

  protectedBot.use(autoChatAction(bot.api))
  protectedBot.use(hydrateReply)
  protectedBot.use(hydrate())
  protectedBot.use(session({ getSessionKey, storage: options.botSessionStorage }))

  // // Handlers
  protectedBot.use(welcomeFeature)
  protectedBot.use(adminFeature)
  protectedBot.use(userIdFeature)
  protectedBot.use(chatIdFeature)
  protectedBot.use(createForumsFeature)
  // if (isMultipleLocales)
  // protectedBot.use(languageFeature)

  // // must be the last handler
  protectedBot.use(unhandledFeature)

  Reflect.set(bot, 'getContext', createContextConstructor({ logger, config }))

  return bot as typeof bot & {
    getContext: () => Context
  }
}

export type Bot = ReturnType<typeof createBot> & {
  getContext: () => Context
}
