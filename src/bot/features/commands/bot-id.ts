import { chatAction } from "@grammyjs/auto-chat-action";
import { Composer } from "grammy";
import type { Context } from "#root/bot/helpers/grammy-context.js";
import { logHandle } from "#root/bot/helpers/logging.js";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

feature.command("botid", logHandle("command-botid"), chatAction("typing"), async (ctx) => {
  await ctx.reply(`My ID is ${ctx.me.id}`);
});

export { composer as botIdFeature };
