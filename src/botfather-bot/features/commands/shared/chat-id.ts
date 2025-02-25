import { chatAction } from "@grammyjs/auto-chat-action";
import { Composer } from "grammy";
import { GrammyContext } from "../../../helpers/grammy-context";
import { logHandle } from "../../../helpers/logging";

const composer = new Composer<GrammyContext>();

const feature = composer.chatType(["group", "private"]);

feature.command("chatid", logHandle("command-chatId"), chatAction("typing"), async (ctx) => {
  return ctx.reply(`This chat ID is ${ctx.chat.id}`);
});

export { composer as chatIdFeature };
