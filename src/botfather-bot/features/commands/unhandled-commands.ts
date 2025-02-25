import { Composer } from "grammy";
import { STRINGS } from "../../helpers/constants";
import { logHandle } from "../../helpers/logging";
import { GrammyContext } from "../../create-grammy-context";

const composer = new Composer<GrammyContext>();

const feature = composer.chatType("private");

feature.on("message", logHandle("unhandled-message"), (ctx) => {
  return ctx.reply(STRINGS.UNHANDLED);
});

feature.on("callback_query", logHandle("unhandled-callback-query"), (ctx) => {
  return ctx.answerCallbackQuery();
});

export { composer as unhandledFeature };
