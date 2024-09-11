import type { BotCommand } from "@grammyjs/types";
import type { CommandContext } from "grammy";
import type { Context } from "#root/bot/helpers/grammy-context.js";

function getPrivateChatCommands(): BotCommand[] {
  return [
    {
      command: "start",
      description: "start-command-description",
    },
  ];
}

function getPrivateChatAdminCommands(): BotCommand[] {
  return [
    {
      command: "setcommands",
      description: "setcommands-command-description",
    },
  ];
}

function getGroupChatCommands(): BotCommand[] {
  return [];
}

export async function setCommandsHandler(ctx: CommandContext<Context>) {
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
