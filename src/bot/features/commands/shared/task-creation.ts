import { chatAction } from "@grammyjs/auto-chat-action";
import { Composer } from "grammy";
import { GrammyContext } from "../../../helpers/grammy-context";
import { logHandle } from "../../../helpers/logging";
import { isAdmin } from "../../../filters/is-admin";
import { logger } from "../../../../utils/logger";

const composer = new Composer<GrammyContext>();

const feature = composer.chatType(["group", "private", "supergroup", "channel"]);

/**
 * This is responsible for creating a task on GitHub. It's going to be a direct reply
 * callback to the user who wrote the comment that we'll turn into a fully featured github
 * task specification.
 */

feature.command("newtask", logHandle("task-creation"), chatAction("typing"), async (ctx: GrammyContext) => {
  if (!ctx.message || !ctx.message.reply_to_message) {
    logger.info(`No message or reply to message`);
    return await ctx.reply("To create a new task, reply to the message with `/newtask <owner>/<repo>`");
  }

  const taskToCreate = ctx.message.reply_to_message.text;

  console.log("taskToCreate", taskToCreate);

  if (!taskToCreate || taskToCreate.length < 10) {
    return await ctx.reply("A new task needs substantially more content than that");
  }

  const repoToCreateIn = ctx.message.text?.split(" ")[1];

  if (!repoToCreateIn) {
    logger.info(`No repo to create task in`);
    return await ctx.reply("To create a new task, reply to the message with `/newtask <owner>/<repo>`");
  }

  const [owner, repo] = repoToCreateIn.split("/");

  if (!owner || !repo) {
    return await ctx.reply("To create a new task, reply to the message with `/newtask <owner>/<repo>`");
  }

  const fromId = ctx.message.from.id;
  const isReplierAdmin = isAdmin([fromId])(ctx);
  // a cheap workaround for ctx being inferred as never if not an admin fsr, needs looked into.
  // ctx types are complex here with mixins and such and the grammy ctx is highly dynamic.
  // my assumption is that the ctx returned by isAdmin is replacing the initial ctx type.
  const replyFn = ctx.reply;

  if (!isReplierAdmin) {
    logger.info(`User ${fromId} is not an admin`);
    return await replyFn("Only admins can create tasks");
  }

  const task = await ctx.octokit.rest.issues.create({
    owner,
    repo,
    title: taskToCreate,
  });

  return await ctx.reply(`Task created: ${task.data.html_url}`);
});

export { composer as newTaskFeature };
