import { chatAction } from "@grammyjs/auto-chat-action";
import { Composer } from "grammy";
import type { Context } from "#root/bot/helpers/grammy-context.js";
import { logHandle } from "#root/bot/helpers/logging.js";

const composer = new Composer<Context>();

const feature = composer.chatType("group");

feature.command("ban", logHandle("command-ban"), chatAction("typing"), async (ctx) => {
    const { message } = ctx;
    if (!message.reply_to_message) {
        return ctx.reply("You must reply to a user's message to kick them.");
    }
    const target = message.reply_to_message.from;
    if (!target) {
        return ctx.reply("I can't find the user you want to kick.");
    }
    if (target.id === ctx.me.id) {
        return ctx.reply("I can't kick myself.");
    }
    await ctx.banChatMember(target.id);
});

export { composer as banCommand };
