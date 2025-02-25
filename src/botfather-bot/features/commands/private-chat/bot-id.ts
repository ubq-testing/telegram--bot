import { chatAction } from "@grammyjs/auto-chat-action";
import { Composer } from "grammy";
import { logHandle } from "../../../helpers/logging";
import { GrammyContext } from "../../../create-grammy-context";

const composer = new Composer<GrammyContext>();

const feature = composer.chatType("private");

feature.command("botid", logHandle("command-botid"), chatAction("typing"), async (ctx) => {
  await ctx.reply(`My ID is ${ctx.me.id}`);
});

export { composer as botIdFeature };
