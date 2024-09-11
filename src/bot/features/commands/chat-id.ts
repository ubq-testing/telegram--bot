import { chatAction } from '@grammyjs/auto-chat-action'
import { Composer } from 'grammy'
import type { Context } from '#root/bot/grammy-context.js'
import { logHandle } from '#root/bot/helpers/logging.js'

const composer = new Composer<Context>()

const feature = composer.chatType('group')

feature.command(
    'chatid',
    logHandle('command-chatid'),
    chatAction('typing'),
    async (ctx) => {
        return ctx.reply(`This chat ID is ${ctx.chat.id}`)
    },
)

export { composer as chatIdFeature }
