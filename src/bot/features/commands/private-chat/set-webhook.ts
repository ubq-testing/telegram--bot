import { chatAction } from "@grammyjs/auto-chat-action";
import { Composer } from "grammy";
import type { Context } from "#root/bot/helpers/grammy-context.js";
import { logHandle } from "#root/bot/helpers/logging.js";
import { isAdmin } from "#root/bot/filters/is-admin.js";

const composer = new Composer<Context>();

const feature = composer.chatType("private").filter((ctx) => isAdmin(ctx.config.TELEGRAM_BOT_ENV.botSettings.TELEGRAM_BOT_ADMINS)(ctx));

feature.command("setwebhook", logHandle("command-setwebhook"), chatAction("typing"), async (ctx) => {
    const webhookUrl = ctx.message?.text?.split(" ")[1];
    if (!webhookUrl) {
        return ctx.reply("Please provide a webhook URL.");
    }

    try {
        await ctx.api.setWebhook(webhookUrl);
        return ctx.reply("Webhook URL has been set.");
    } catch (error) {
        return ctx.reply("Failed to set webhook URL.");
    }
});

export { composer as setWebhookFeature };
