import { Composer } from 'grammy'
import type { Context } from '#root/bot/context.js'
import { PluginContext } from '#root/utils/plugin-context-single.js'
import { Bot as TelegramBot, RawApi } from 'grammy'

const composer = new Composer<Context>()

const feature = composer.chatType("supergroup")

feature.on(":forum_topic_created", async (ctx) => {
    const pluginCtx = PluginContext.getInstance().getContext()
    const chatId = pluginCtx.config.supergroupChatId // replace with general or dedicated channel for announcements
    const name = ctx.update.message.forum_topic_created.name
    return await ctx.api.sendMessage(chatId, `New workroom created: ${name} `)
})

export { composer as createForumsFeature }
