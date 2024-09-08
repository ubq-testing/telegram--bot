import { Composer } from 'grammy'
import type { Context } from '#root/bot/grammy-context.js'
import { logHandle } from '#root/bot/helpers/logging.js'
import { STRINGS } from '../../strings'

const composer = new Composer<Context>()

const feature = composer.chatType('private')

feature.on('message', logHandle('unhandled-message'), (ctx) => {
  return ctx.reply(STRINGS.UNHANDLED)
})

feature.on('callback_query', logHandle('unhandled-callback-query'), (ctx) => {
  return ctx.answerCallbackQuery()
})

export { composer as unhandledFeature }
