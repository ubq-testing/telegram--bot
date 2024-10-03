import { chatAction } from "@grammyjs/auto-chat-action";
import { Composer } from "grammy";
import { GrammyContext } from "../../../helpers/grammy-context";
import { logHandle } from "../../../helpers/logging";

const composer = new Composer<GrammyContext>();

const feature = composer.chatType("private");

/**
 * Pairs the user's Telegram ID with the user's GitHub ID.
 */
feature.command("register", logHandle("command-register"), chatAction("typing"), async (ctx) => {
    const userId = ctx.from?.id;
    const githubUsername = ctx.message?.text?.split(" ")[1];

    if (!githubUsername) {
        await ctx.reply("Please provide your GitHub username like this: /register <GitHubUsername>");
        return;
    }

    const octokit = ctx.adapters.github.octokit;
    const user = await octokit.users.getByUsername({ username: githubUsername });

    if (user.status !== 200) {
        await ctx.reply("User not found.");
        return;
    }

    const githubId = user.data.id;

    const parts = [];

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




    try {
        await ctx.adapters.github.handleUserBank({
            additionalUserListeners: [],
            githubId,
            telegramId: userId,
            listeningTo: [],
        }, "create")
    } catch (er) {
        if (er instanceof Error) {
            await ctx.reply(ctx.logger.error(`${er.message}`, { er, userId, githubId }).logMessage.raw);
            return;
        }
        await ctx.reply("An error occurred while trying to register your account.");
        return;
    }

    await ctx.reply(`Successfully paired your GitHub account.\n\n${parts.join("\n")}\n\nYou can now use the <b>/subscribe</b> command to subscribe to notifications.`, { parse_mode: "HTML" }).catch((er) => {
        ctx.logger.error(er.message, { er, userId, githubId }).logMessage.raw;
    });
});


export { composer as registerFeature };