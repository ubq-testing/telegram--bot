import { chatAction } from "@grammyjs/auto-chat-action";
import { Composer } from "grammy";
import type { Context } from "#root/bot/helpers/grammy-context.js";
import { logHandle } from "#root/bot/helpers/logging.js";

const composer = new Composer<Context>();

const feature = composer.chatType("private");

feature.command("myid", logHandle("command-myid"), chatAction("typing"), async (ctx) => {
  return ctx.reply(`Your ID is ${ctx.from.id}`);
});

export { composer as userIdFeature };
