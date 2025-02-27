import { Bot } from "../../botfather-bot/create-bot";
import { Context } from "../../types";
import { logger } from "../../utils/logger";
import { CommentTriggerHelpers } from "./comment-trigger-helpers";

export class CommentTriggerBase {
  protected context: Context<"issue_comment.created" | "issue_comment.edited">;
  protected botFatherBot: Bot;
  protected triggerHelpers: CommentTriggerHelpers;

  constructor(context: Context<"issue_comment.created" | "issue_comment.edited">) {
    this.context = context;
    this.botFatherBot = context.pluginEnvCtx.getBotFatherBot();
    this.triggerHelpers = new CommentTriggerHelpers(context);
  }

  async _deliverNotification(telegramId: string | number, rfcMessage: string) {
    try {
      await this.botFatherBot?.api.sendMessage(Number(telegramId), rfcMessage, { parse_mode: "HTML" });
    } catch (er) {
      logger.error(`Error sending message to ${telegramId}`, { er });
    }
  }

  async _getChat(telegramId: string | number) {
    try {
      return await this.botFatherBot?.api.getChat(telegramId);
    } catch (er) {
      logger.error(`Error getting chat for ${telegramId}`, { er });
    }
  }
}
