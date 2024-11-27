import { chatAction } from "@grammyjs/auto-chat-action";
import { Composer } from "grammy";
import { GrammyContext } from "../../../helpers/grammy-context";
import { logHandle } from "../../../helpers/logging";
import { isAdmin } from "../../../filters/is-admin";
import { logger } from "../../../../utils/logger";
import { RestEndpointMethodTypes } from "@octokit/rest";
import Fuse from "fuse.js";
import { PluginContext } from "../../../../types/plugin-context-single";

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
    return await ctx.reply("To create a new task, reply to the message with `/newtask <repo>`");
  }

  const taskToCreate = ctx.message.reply_to_message.text;

  if (!taskToCreate || taskToCreate.length < 10) {
    return await ctx.reply("A new task needs substantially more content than that");
  }

  const repoToCreateIn = ctx.message.text?.split(" ")[1];

  if (!repoToCreateIn) {
    logger.info(`No repo to create task in`);
    return await ctx.reply("To create a new task, reply to the message with `/newtask <repo>`");
  }

  const fromId = ctx.message.from.id;
  const isReplierAdmin = isAdmin([fromId])(ctx);

  /**
   * a cheap workaround for ctx being inferred as never if not an admin fsr, needs looked into.
   * ctx types are complex here with mixins and such and the grammy ctx is highly dynamic.
   * my assumption is that the ctx returned by isAdmin is replacing the initial ctx type.
   */
  const replyFn = ctx.reply;
  if (!isReplierAdmin) {
    logger.info(`User ${fromId} is not an admin`);
    return await replyFn("Only admins can create tasks");
  }

  const response = await fetch("https://raw.githubusercontent.com/ubiquity/devpool-directory/__STORAGE__/devpool-issues.json");
  const devPoolIssues = (await response.json()) as RestEndpointMethodTypes["issues"]["get"]["response"]["data"][];

  const repoNames = Array.from(
    new Set(
      devPoolIssues.map((issue) => {
        return ownerRepoFromUrl(issue.html_url)?.repo ?? "";
      })
    )
  );

  const context = await PluginContext.getInstance().getContext();

  const options = {
    includeScore: true,
    threshold: context.config.fuzzySearchThreshold,
  };

  const fuse = new Fuse(repoNames, options);
  const results = fuse.search(repoToCreateIn);

  if (results.length > 0) {
    const bestMatchRepoName = results[0].item;
    const foundIssue = devPoolIssues.find((issue) => {
      const repoName = ownerRepoFromUrl(issue.html_url)?.repo ?? "";
      return repoName === bestMatchRepoName;
    });

    if (!foundIssue) {
      return await ctx.reply("No issue found");
    }

    const found = ownerRepoFromUrl(foundIssue?.html_url);

    if (!found) {
      return await ctx.reply("No repo found");
    }

    return await createTask(taskToCreate, ctx, found, fromId);
  }
  return await ctx.reply("No repo found");
});

function ownerRepoFromUrl(url: string) {
  const namedGroups = /https:\/\/github.com\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/issues\/(?<issue>\d+)/.exec(url)?.groups;

  if (!namedGroups) {
    return null;
  }

  return {
    owner: namedGroups.owner,
    repo: namedGroups.repo,
  };
}

async function createTask(taskToCreate: string, ctx: GrammyContext, { owner, repo }: { owner: string; repo: string }, fromId: number) {
  const directives = [
    "Consume the user's message and begin to transform it into a GitHub task specification",
    "Include a relevant short title for opening the task with",
    "Include the task's description based on the user's message",
    "Include any relevant context or constraints",
    "Use a structured approach to writing the task",
    "Do so without comment or directive, just the requested 'outputStyle'",
  ];

  const constraints = [
    "Never hallucinate details into the specification",
    "Ensure the task is clear and actionable",
    "Use GitHub flavoured markdown by default",
    "Return the markdown within a code block to maintain formatting on GitHub",
    "DO NOT use backticks in the markdown",
  ];

  const additionalContext = [
    "The task will be created via the GitHub app under your name; UbiquityOS",
    "The correct repository will be selected by the admin who invoked this intent",
    "Your output will be JSON parsed for the 'title' and 'body' keys",
    "The user credit will be injected into the footer of your spec, so always leave it blank following a '---' separator",
  ];

  const outputStyle = `{ "title": "Task Title", "body": "Task Body" }`;

  const taskFromLlm = await ctx.adapters.ai.createCompletion({
    embeddingsSearch: [],
    directives,
    constraints,
    additionalContext,
    outputStyle,
    model: "gpt-4o",
    query: taskToCreate,
  });

  if (!taskFromLlm) {
    return await ctx.reply("Failed to create task");
  }

  let taskDetails;

  try {
    taskDetails = JSON.parse(taskFromLlm);
  } catch {
    return await ctx.reply("Failed to parse task");
  }

  const userCredits = await ctx.adapters.storage.retrieveUserByTelegramId(fromId);

  const username = userCredits?.github_username ?? "Anonymous";
  const chatLink = ctx.chat?.type !== "private" && (await ctx.createChatInviteLink());

  const chatLinkText = chatLink ? ` [here](${chatLink.invite_link})` : "";
  const fullSpec = `${taskDetails.body}\n\n_Originally created by @${username} via Telegram${chatLinkText}_`;

  logger.info("creating task", {
    taskDetails,
    fullSpec,
    owner,
    repo,
    author: username,
  });

  const task = await ctx.octokit.rest.issues.create({
    owner,
    repo,
    title: taskDetails.title,
    body: fullSpec,
  });

  if (!task) {
    return await ctx.reply("Failed to create task");
  }

  return await ctx.reply(`${fullSpec}\n\n [View on GitHub](${task.data.html_url})`);
}

export { composer as newTaskFeature };
