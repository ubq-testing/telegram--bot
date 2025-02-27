import { Context } from "../../types";
import { CallbackResult } from "../../types/proxy";
import { StorageUser } from "../../types/storage";
import { logger } from "../../utils/logger";
import { CommentTriggerBase } from "./comment-trigger-base";
import { CommentTriggerHelpers } from "./comment-trigger-helpers";
import { NotificationTriggers, triggersRequiringComments } from "./constants";
import { NotificationMessage } from "./notification-messages";
import { RfcCommentHandler } from "./rfc-follow-ups";

class CommentNotificationHandler extends CommentTriggerBase {
  constructor(context: Context<"issue_comment.created" | "issue_comment.edited">) {
    super(context);
  }

  public async handleNotifications(): Promise<CallbackResult> {
    const { payload } = this.context;
    const { body } = payload.comment;
    const triggerHelpers = new CommentTriggerHelpers(this.context);
    const rfcCommentHandler = new RfcCommentHandler(this.context);
    const { results, users } = await triggerHelpers.extractUsersFromComment(body);

    if (!results.length) {
      if (rfcCommentHandler.shouldSaveRfcComment()) {
        await rfcCommentHandler.captureAndSaveRfcComment();
      } else {
        await rfcCommentHandler.tryFollowupForAllUsers();
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
        await this._handleCommentNotificationTrigger({ trigger, user, telegramId: user.telegram_id, claimUrl: results[i]?.claimUrl });
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
    telegramId: number | string;
    claimUrl?: string;
  }) {
    if (trigger === "reminder" && !claimUrl) {
      return this._handleReminderNotification(user.github_username, telegramId);
    } else if (trigger === "payment" && claimUrl) {
      return this._handlePaymentNotification(user, claimUrl, telegramId);
    }
  }

  private async _handleReminderNotification(username: string, telegramId: string | number) {
    const message = NotificationMessage.getReminderMessage({
      issueHtmlUrl: this.context.payload.comment.html_url,
      issueNumber: this.context.payload.issue.number.toString(),
      repositoryFullName: this.context.payload.repository.full_name,
      username,
    });
    const userPrivateChat = await this._getChat(telegramId);

    if (!userPrivateChat) {
      logger.error(`This user has not started a chat with the bot yet`, { telegramId });
      return;
    }

    await this._deliverNotification(telegramId, message);
  }

  private async _handlePaymentNotification(user: StorageUser, claimUrlBase64String: string, telegramId: string | number) {
    const { wallet_address, github_username: username } = user;

    if (!wallet_address || !username) {
      logger.error(`Wallet address not found for ${username}`);
      const noWalletMessage = NotificationMessage.getPaymentMessageFail({
        username,
        commentUrl: this.context.payload.comment.html_url,
      });

      return await this._deliverNotification(telegramId, noWalletMessage);
    }

    const userPrivateChat = await this._getChat(telegramId);

    if (!userPrivateChat) {
      logger.error(`This user has not started a chat with the bot yet`, { telegramId });
      return;
    }

    const notificationMessage = NotificationMessage.getPaymentMessageSuccess({
      username,
      claimUrlBase64String,
    });

    await this._deliverNotification(telegramId, notificationMessage);
  }
}

export async function notificationsRequiringComments(context: Context<"issue_comment.created" | "issue_comment.edited">): Promise<CallbackResult> {
  const handler = new CommentNotificationHandler(context);
  return handler.handleNotifications();
}
