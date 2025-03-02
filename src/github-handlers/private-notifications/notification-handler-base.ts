import { CallbackResult } from "../../types/proxy";
import { Context, SupportedEventsU } from "../../types";
import { Bot } from "../../botfather-bot/create-bot";
import { logger } from "../../utils/logger";
import { CommentTriggerHelpers } from "./trigger-helpers";
import { StorageUser } from "../../types/storage";

export abstract class NotificationHandlerBase<T extends SupportedEventsU = SupportedEventsU> {
  protected context: Context<T>;
  protected bot: Bot;
  protected triggerHelpers: CommentTriggerHelpers;

  constructor(context: Context<T>) {
    this.context = context;
    this.bot = context.pluginEnvCtx.getBotFatherBot();
    this.triggerHelpers = new CommentTriggerHelpers(context);
  }

  protected abstract getUserId(): number | null;
  protected abstract shouldSkipNotification(dbUser: StorageUser): boolean;
  protected abstract getMessage(username: string): string | null;

  public async handle(): Promise<CallbackResult> {
    const dbUser = await this.getDbUser();
    if (!dbUser) {
      throw new Error("User not found in the database");
    }

    if (this.shouldSkipNotification(dbUser)) {
      return { status: 200, reason: "skipped" };
    }

    await this._sendNotification(dbUser);
    return { status: 200, reason: "success" };
  }

  protected async getDbUser() {
    const userId = this.getUserId();
    if (!userId) {
      throw new Error("No user found in the payload");
    }
    return this.context.adapters.storage.retrieveUserByGithubId(userId);
  }

  private async _sendNotification(dbUser: StorageUser) {
    const message = this.getMessage(dbUser.github_username);
    const chat = await this.getChat(dbUser.telegram_id);

    if (!message) {
      logger.error(`Message not found for ${dbUser.github_username}`);
      return;
    }

    if (chat) {
      await this.deliverNotification(dbUser.telegram_id, message);
    } else {
      logger.error(`This user has not started a chat with the bot yet`, {
        telegramId: dbUser.telegram_id,
      });
    }
  }

  protected async getChat(telegramId: number) {
    try {
      return await this.bot.api.getChat(telegramId);
    } catch (er) {
      logger.error(`Error getting chat for ${telegramId}`, { er });
    }
  }

  protected async deliverNotification(telegramId: number, message: string) {
    try {
      await this.bot.api.sendMessage(telegramId, message, { parse_mode: "HTML" });
    } catch (er) {
      logger.error(`Error sending message to ${telegramId} `, { er });
    }
  }
}
