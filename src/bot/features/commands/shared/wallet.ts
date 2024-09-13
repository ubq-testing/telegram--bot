import { chatAction } from "@grammyjs/auto-chat-action";
import { Composer } from "grammy";
import type { Context } from "#root/bot/helpers/grammy-context.js";
import { logHandle } from "#root/bot/helpers/logging.js";

const composer = new Composer<Context>();

const feature = composer.chatType(["group", "private"]);

feature.command("/wallet", logHandle("command-wallet"), chatAction("typing"), async (ctx) => {
    const { message } = ctx;

    // username is after the command
    const username = message.text.split(" ")[1];
    if (!username) {
        return ctx.reply("You must provide a GitHub username.");
    }

    // get wallet by username
    const wallet = await ctx.adapters.supabase.user.getWalletByGitHubUsername(username);
    if (!wallet) {
        return ctx.reply("I can't find a wallet for that GitHub username.");
    }

    return ctx.reply(`The wallet for ${username} is ${wallet}`);
});

export { composer as userIdFeature };
