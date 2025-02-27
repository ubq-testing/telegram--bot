import { Context } from "../../types";
import { CallbackResult } from "../../types/proxy";
import { StorageUser } from "../../types/storage";
import { logger } from "../../utils/logger";
import { NotificationTriggers, triggersRequiringComments } from "./constants";
import { NotificationMessage } from "./notification-message";
import { RfcCommentHandler } from "./handler-rfc-comments";
import { NotificationHandlerBase } from "./notification-handler-base";

class CommentNotificationHandler extends NotificationHandlerBase<"issue_comment.created" | "issue_comment.edited"> {
  private _rfcCommentHandler: RfcCommentHandler;

  constructor(context: Context<"issue_comment.created" | "issue_comment.edited">) {
    super(context);
    this._rfcCommentHandler = new RfcCommentHandler(context);
  }

  public async handle(): Promise<CallbackResult> {
    const { payload } = this.context;
    const { body } = payload.comment;

    const { results, users } = await this.triggerHelpers.extractUsersFromComment(body);
    // Handle RFC comments or follow-ups if no results found
    if (!results.length) {
      if (this._rfcCommentHandler.shouldSaveRfcComment()) {
        await this._rfcCommentHandler.captureAndSaveRfcComment();
      } else {
        await this._rfcCommentHandler.tryFollowupForAllUsers();
      }
      return { status: 200, reason: "success" };
    }

    await this._dispatchCommentNotifications(users, results);
    return { status: 200, reason: "success" };
  }

  private async _dispatchCommentNotifications(users: StorageUser[], results: { claimUrl?: string }[]) {
    let i = 0;
    for (const user of users.filter((u): u is StorageUser => !!u)) {
      if (!user) {
        i++;
        continue;
      }

      for (const [key, isActive] of Object.entries(user.listening_to)) {
        const trigger = key as NotificationTriggers;
        if (!isActive || !triggersRequiringComments.includes(trigger)) {
          continue;
        }

        await this._handleCommentNotificationTrigger({
          trigger,
          user,
          telegramId: user.telegram_id,
          claimUrl: results[i]?.claimUrl,
        });
      }
      i++;
    }
  }

  private async _handleCommentNotificationTrigger({
    trigger,
    user,
    telegramId,
    claimUrl,
  }: {
    trigger: string;
    user: StorageUser;
    telegramId: number;
    claimUrl?: string;
  }) {
    if (trigger === "reminder" && !claimUrl) {
      return this._handleReminderNotification(user.github_username, telegramId);
    } else if (trigger === "payment" && claimUrl) {
      return this._handlePaymentNotification(user, claimUrl, telegramId);
    }
  }

  private async _handleReminderNotification(username: string, telegramId: number) {
    const message = NotificationMessage.getReminderMessage({
      issueHtmlUrl: this.context.payload.comment.html_url,
      issueNumber: this.context.payload.issue.number.toString(),
      repositoryFullName: this.context.payload.repository.full_name,
      username,
    });
    const userPrivateChat = await this.getChat(telegramId);

    if (!userPrivateChat) {
      logger.error(`This user has not started a chat with the bot yet`, { telegramId });
      return;
    }

    await this.deliverNotification(telegramId, message);
  }

  private async _handlePaymentNotification(user: StorageUser, claimUrlBase64String: string, telegramId: number) {
    const { wallet_address, github_username: username } = user;

    if (!wallet_address || !username) {
      logger.error(`Wallet address not found for ${username}`);
      const noWalletMessage = NotificationMessage.getPaymentMessageFail({
        username,
        commentUrl: this.context.payload.comment.html_url,
      });

      return await this.deliverNotification(telegramId, noWalletMessage);
    }

    const userPrivateChat = await this.getChat(telegramId);

    if (!userPrivateChat) {
      logger.error(`This user has not started a chat with the bot yet`, { telegramId });
      return;
    }

    const notificationMessage = NotificationMessage.getPaymentMessageSuccess({
      username,
      claimUrlBase64String,
    });

    await this.deliverNotification(telegramId, notificationMessage);
  }

  protected getUserId() {
    // We don't need to get the user ID for comments
    return undefined;
  }

  protected shouldSkipNotification(): boolean {
    // We don't skip any notifications for comments
    return false;
  }

  protected getMessage(): string {
    // Messages are customized for each trigger type
    return "";
  }
}

export async function notificationsRequiringComments(context: Context<"issue_comment.created" | "issue_comment.edited">): Promise<CallbackResult> {
  const handler = new CommentNotificationHandler(context);
  return handler.handle();
}
