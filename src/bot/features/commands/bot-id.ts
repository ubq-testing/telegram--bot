import { chatAction } from '@grammyjs/auto-chat-action'
import { Composer } from 'grammy'
import type { Context } from '#root/bot/grammy-context.js'
import { logHandle } from '#root/bot/helpers/logging.js'

const composer = new Composer<Context>()

const feature = composer.chatType('private')

feature.command(
    'botid',
    logHandle('command-botid'),
    chatAction('typing'),
    async (ctx) => {
        const botID = ctx.me.id
        await ctx.reply(`My ID is ${botID}`)
    },
)

export { composer as botIdFeature }
