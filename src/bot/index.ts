
import type { BotConfig, StorageAdapter } from 'grammy'
import { Bot as TelegramBot, Api } from 'grammy'
import type { Context, SessionData } from '#root/bot/grammy-context.js'
import { createContextConstructor } from '#root/bot/grammy-context.js'
import type { Logger } from '#root/logger.js'
import { Context as UbiquityOsContext } from '../types'
import { welcomeFeature } from '#root/bot/features/welcome.js'
import { unhandledFeature } from '#root/bot/features/helpers/unhandled.js'
import { errorHandler } from '#root/bot/handlers/error.js'
import { session } from '#root/bot/middlewares/session.js'
import { autoChatAction } from '@grammyjs/auto-chat-action'
import { hydrate } from '@grammyjs/hydrate'
import { hydrateReply, parseMode } from '@grammyjs/parse-mode'
import { adminFeature } from './features/admin/admin'
import { userIdFeature } from './features/commands/user-id'
import { chatIdFeature } from './features/commands/chat-id'
import { botIdFeature } from './features/commands/bot-id'

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

  bot.api.config.use(parseMode('HTML'))

  protectedBot.use(autoChatAction(bot.api))
  protectedBot.use(hydrateReply)
  protectedBot.use(hydrate())
  protectedBot.use(session({ getSessionKey, storage: options.botSessionStorage }))

  // Handlers
  protectedBot.use(welcomeFeature)
  protectedBot.use(adminFeature)
  protectedBot.use(userIdFeature)
  protectedBot.use(chatIdFeature)
  protectedBot.use(botIdFeature)

  // must be the last handler
  protectedBot.use(unhandledFeature)

  return bot
}

export type Bot = ReturnType<typeof createBot>
