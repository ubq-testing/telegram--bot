import type { BotCommand } from "@grammyjs/types";
import type { CommandContext } from "grammy";
import { GrammyContext } from "../../helpers/grammy-context";

function getPrivateChatCommands(): BotCommand[] {
  return [
    {
      command: "botid",
      description: "Get the bot's ID",
    },
    {
      command: "myid",
      description: "Get your user ID",
    },
    {
      command: "register",
      description: "Pair your GitHub account for use with private notifications and more",
    },
    {
      command: "subscribe",
      description: "Subscribe to notifications",
    },
    {
      command: "unsubscribe",
      description: "Unsubscribe from selected notifications",
    },

  ];
}

function getPrivateChatAdminCommands(): BotCommand[] {
  return [
    {
      command: "setcommands",
      description: "Set the bot's commands",
    },
    {
      command: "setwebhook",
      description: "Set the webhook URL",
    },
  ];
}

function getGroupChatCommands(): BotCommand[] {
  return [];
}

export async function setCommandsHandler(ctx: CommandContext<GrammyContext>) {
  // set private chat commands
  await ctx.api.setMyCommands([...getPrivateChatCommands()], {
    scope: {
      type: "all_private_chats",
    },
  });

  // set group chat commands
  await ctx.api.setMyCommands(getGroupChatCommands(), {
    scope: {
      type: "all_group_chats",
    },
  });

  // set private chat commands for owner
  await ctx.api.setMyCommands([...getPrivateChatCommands(), ...getPrivateChatAdminCommands()], {
    scope: {
      type: "chat",
      chat_id: ctx.chat.id,
    },
  });

  return ctx.reply("admin-commands-updated");
}
