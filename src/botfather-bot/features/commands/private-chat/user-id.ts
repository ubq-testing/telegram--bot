import { chatAction } from "@grammyjs/auto-chat-action";
import { Composer } from "grammy";
import { logHandle } from "../../../helpers/logging";
import { GrammyContext } from "../../../create-grammy-context";

const composer = new Composer<GrammyContext>();

const feature = composer.chatType("private");

feature.command("myid", logHandle("command-myId"), chatAction("typing"), async (ctx) => {
  return ctx.reply(`Your ID is ${ctx.from.id}`);
});

export { composer as userIdFeature };
