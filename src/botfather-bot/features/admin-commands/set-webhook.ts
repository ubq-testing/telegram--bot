import { chatAction } from "@grammyjs/auto-chat-action";
import { Composer } from "grammy";
import { GrammyContext } from "../../helpers/create-grammy-context";
import { isAdmin } from "../../helpers/is-admin";
import { logHandle } from "../../helpers/logging";

const composer = new Composer<GrammyContext>();

const feature = composer.chatType("private").filter((ctx) => isAdmin(ctx.pluginEnvCtx.getEnv().TELEGRAM_BOT_ENV.botSettings.TELEGRAM_BOT_ADMINS)(ctx));

feature.command("setwebhook", logHandle("command-setwebhook"), chatAction("typing"), async (ctx) => {
  const webhookUrl = ctx.message?.text?.split(" ")[1];
  if (!webhookUrl) {
    return ctx.reply("Please provide a webhook URL.");
  }

  try {
    await ctx.api.setWebhook(webhookUrl);
    return ctx.reply("Webhook URL has been set.");
  } catch (error) {
    return ctx.reply(`Failed to set webhook URL. \n\n${JSON.stringify(error)}`);
  }
});

export { composer as setWebhookFeature };
