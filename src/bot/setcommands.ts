import type { BotCommand } from "@grammyjs/types";
import type { CommandContext } from "grammy";
import { GrammyContext } from "./helpers/grammy-context";
import { logger } from "../utils/logger";

export const BOT_COMMANDS = [
  {
    command: "start",
    description: "View the welcome message",
    type: "all_private_chats",
  },
  {
    command: "register",
    description: "Pair your GitHub account",
    type: "all_private_chats",
  },
  {
    command: "subscribe",
    description: "Subscribe to notifications",
    type: "all_private_chats",
  },
  {
    command: "unsubscribe",
    description: "Unsubscribe from selected notifications",
    type: "all_private_chats",
  },
  {
    command: "wallet",
    description: "Register your wallet address",
    type: "all_private_chats",
  },
  {
    command: "myid",
    description: "Get your user ID",
    type: "all_private_chats",
  },
  {
    command: "botid",
    description: "Get the bot's ID",
    type: "all_private_chats",
  },
  {
    command: "chatid",
    description: "Get the chat ID",
    type: "all_private_chats",
  },
  {
    command: "ban",
    description: "Ban a user",
    type: "all_group_chats",
    isAdmin: true,
  },
  {
    command: "setcommands",
    description: "Set the bot's commands",
    type: "chat",
    isAdmin: true,
  },
  {
    command: "setwebhook",
    description: "Set the webhook URL",
    type: "chat",
    isAdmin: true,
  },
];

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
      description: "Pair your GitHub account",
    },
    {
      command: "subscribe",
      description: "Subscribe to notifications",
    },
    {
      command: "unsubscribe",
      description: "Unsubscribe from selected notifications",
    },
    {
      command: "wallet",
      description: "Register your wallet address",
    },
    {
      command: "ubiquityos",
      description: "Ask UbiquityOS a question",
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
    {
      command: "newtask",
      description: "Create a new task",
    },
  ];
}

function getGroupChatCommands(): BotCommand[] {
  return [
    {
      command: "ban",
      description: "Ban a user",
    },
    {
      command: "ubiquityos",
      description: "Ask UbiquityOS a question",
    },
    {
      command: "newtask",
      description: "Create a new task",
    },
  ];
}

export async function setCommandsHandler(ctx: CommandContext<GrammyContext>) {
  const updatedCommands = {
    private_chat: false,
    group_chat: false,
    owner: false,
  };

  // set private chat commands
  try {
    await ctx.api.setMyCommands([...getPrivateChatCommands()], {
      scope: {
        type: "all_private_chats",
      },
    });

    updatedCommands.private_chat = true;
  } catch (err) {
    logger.error("Error setting private chat commands", { err });
  }

  try {
    // set group chat commands
    await ctx.api.setMyCommands(getGroupChatCommands(), {
      scope: {
        type: "all_group_chats",
      },
    });

    updatedCommands.group_chat = true;
  } catch (err) {
    logger.error("Error setting group chat commands", { err });
  }

  // set private chat commands for owner
  try {
    await ctx.api.setMyCommands([...getPrivateChatCommands(), ...getPrivateChatAdminCommands()], {
      scope: {
        type: "chat",
        chat_id: ctx.from?.id ?? ctx.chat?.id,
      },
    });

    updatedCommands.owner = true;
  } catch (er) {
    logger.error("Error setting private chat commands for owner", { er });
  }

  const msgParts = [
    `Commands updated:`,
    `Private chat commands: ${updatedCommands.private_chat ? "✅" : "❌"}`,
    `Group chat commands: ${updatedCommands.group_chat ? "✅" : "❌"}`,
    `Owner commands: ${updatedCommands.owner ? "✅" : "❌"}`,
  ];

  return ctx.reply(msgParts.join("\n"));
}
