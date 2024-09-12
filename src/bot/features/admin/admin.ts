import { chatAction } from "@grammyjs/auto-chat-action";
import { Composer } from "grammy";
import type { Context } from "#root/bot/helpers/grammy-context.js";
import { isAdmin } from "#root/bot/filters/is-admin.js";
import { setCommandsHandler } from "#root/bot/handlers/commands/setcommands.js";
import { logHandle } from "#root/bot/helpers/logging.js";

const composer = new Composer<Context>();

const feature = composer.chatType("private").filter((ctx) => isAdmin(ctx.config.telegramBotSettings.TELEGRAM_BOT_ADMINS)(ctx));

feature.command("setcommands", logHandle("command-setcommands"), chatAction("typing"), setCommandsHandler);

export { composer as adminFeature };
