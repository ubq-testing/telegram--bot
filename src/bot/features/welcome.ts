import { Composer } from 'grammy'
import type { Context } from '#root/bot/grammy-context.js'
import { logHandle } from '#root/bot/helpers/logging.js'
import { STRINGS } from '../strings'

const composer = new Composer<Context>()

const feature = composer.chatType('private')

feature.command('start', logHandle('command-start'), (ctx) => {
  return ctx.reply(STRINGS.WELCOME)
})

export { composer as welcomeFeature }
