import { Composer } from "grammy";
import { STRINGS } from "../strings";
import { GrammyContext } from "../helpers/grammy-context";
import { logHandle } from "../helpers/logging";

const composer = new Composer<GrammyContext>();

const feature = composer.chatType("private");

feature.command("start", logHandle("command-start"), (ctx) => {
  return ctx.reply(STRINGS.WELCOME);
});

export { composer as welcomeFeature };
