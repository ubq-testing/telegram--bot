import { chatAction } from "@grammyjs/auto-chat-action";
import { Composer } from "grammy";
import { GrammyContext } from "../../../helpers/grammy-context";
import { logHandle } from "../../../helpers/logging";

const composer = new Composer<GrammyContext>();

const feature = composer.chatType("private");

/**
 * Pairs the user's Telegram ID with the user's GitHub ID. Creating
 * a new user in `userbase` and storing the user's GitHub ID.
 *
 * They must use `/wallet` after this to set their wallet address.
 *
 * Notification triggers are disabled by default.
 */
feature.command("register", logHandle("command-register"), chatAction("typing"), async (ctx) => {
  const parts: string[] = [];
  try {
    const userId = ctx.from?.id;
    const githubUsername = ctx.message?.text?.split(" ")[1];

    if (!githubUsername) {
      await ctx.reply("Please provide your GitHub username like this: /register username");
      return;
    }

    const user = await ctx.octokit.rest.users.getByUsername({
      username: githubUsername,
    });

    if (user.status !== 200) {
      await ctx.reply("User not found.");
      return;
    }

    const githubId = user.data.id;

    if (user.data.login) {
      parts.push(`<b>Login:</b> ${user.data.login}`);
    }

    if (user.data.name) {
      parts.push(`<b>Name:</b> ${user.data.name}`);
    }

    if (user.data.email) {
      parts.push(`<b>Email:</b> ${user.data.email}`);
    }

    if (user.data.bio) {
      parts.push(`<b>Bio:</b> ${user.data.bio}`);
    }

    await ctx.adapters.storage.handleUserBaseStorage(
      {
        additional_user_listeners: [],
        github_id: githubId,
        wallet_address: null,
        telegram_id: userId,
        github_username: githubUsername,
        listening_to: {
          disqualification: false,
          payment: false,
          reminder: false,
          review: false,
        },
      },
      "create"
    );
  } catch (er) {
    if (er instanceof Error) {
      await ctx.reply(ctx.logger.error(`${er.message}`, { er }).logMessage.raw);
      return;
    }
    await ctx.reply("An error occurred while trying to register your account.");
    return;
  }

  const commands = ["`/wallet` - Set your wallet address", "`/subscribe` - Subscribe to notifications", "`/unsubscribe` - Unsubscribe from notifications"];

  await ctx.reply(`Successfully paired your GitHub account.\n\n${parts.join("\n")}\n\nYou can now use the following commands:\n\n${commands.join("\n")}`);
});

export { composer as registerFeature };
