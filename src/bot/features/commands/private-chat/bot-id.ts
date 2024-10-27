import { chatAction } from "@grammyjs/auto-chat-action";
import { Composer } from "grammy";
import { GrammyContext } from "../../../helpers/grammy-context";
import { logHandle } from "../../../helpers/logging";

const composer = new Composer<GrammyContext>();

const feature = composer.chatType("private");

feature.command("botId", logHandle("command-botId"), chatAction("typing"), async (ctx) => {
  await ctx.reply(`My ID is ${ctx.me.id}`);
});

export { composer as botIdFeature };
