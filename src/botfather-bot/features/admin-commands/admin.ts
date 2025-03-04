import { chatAction } from "@grammyjs/auto-chat-action";
import { Composer } from "grammy";
import { isAdmin } from "../../helpers/is-admin";
import { logHandle } from "../../helpers/logging";
import { setCommandsHandler } from "../../set-bot-commands";
import { GrammyContext } from "../../create-grammy-context";

const composer = new Composer<GrammyContext>();

const feature = composer.chatType("private").filter((ctx) => isAdmin(ctx.pluginEnvCtx.getEnv().TELEGRAM_BOT_ENV.botSettings.TELEGRAM_BOT_ADMINS)(ctx));

feature.command("setcommands", logHandle("command-setcommands"), chatAction("typing"), setCommandsHandler);

export { composer as adminFeature };
