import { Context } from "../../types";
import { StorageUser } from "../../types/storage";
import { logger } from "../../utils/logger";
import { retrieveUsersByGithubUsernames } from "./shared";
import { NotificationMessage } from "./notification-message";
import { NotificationHandlerBase } from "./notification-handler-base";
import { getPriorityLabelValue } from "../../utils/labels";
import ms, { StringValue } from "ms";

export type RfcComment = {
  comment_id: number;
  comment_url: string;
  comment: string;
  created_at: string;
  updated_at: string;
  follow_up_allowed_after: string;
  last_push?: string;
};

export class RfcCommentHandler extends NotificationHandlerBase<"issue_comment.created" | "issue_comment.edited"> {
  private _rfcCommentRegex = /\brfc @(\w+)\b|\brequest for comment @(\w+)\b|@(\w+)\s+rfc\b/i;

  constructor(context: Context<"issue_comment.created" | "issue_comment.edited">) {
    super(context);
  }

  public shouldSaveRfcComment(): boolean {
    const { body } = this.context.payload.comment;
    const rfcMatches = this._rfcCommentRegex.exec(body) || [];
    return rfcMatches && rfcMatches.length > 0;
  }

  public async captureAndSaveRfcComment(): Promise<void> {
    const { body } = this.context.payload.comment;
    const rfcMatches = this._rfcCommentRegex.exec(body) || [];
    const username = this._getUsernameFromRfcComment(body, rfcMatches);

    if (!username) {
      logger.error(`Username not found in RFC comment`, { body });
      return;
    }

    const fetchedUsers = await retrieveUsersByGithubUsernames([username], this.context);
    if (!fetchedUsers || fetchedUsers.length === 0) {
      logger.error(`User not found for ${username}`);
      return;
    }

    const issueLabels = await this.context.octokit.rest.issues.listLabelsOnIssue({
      owner: this.context.payload.repository.owner.login,
      repo: this.context.payload.repository.name,
      issue_number: this.context.payload.issue.number,
    });

    const priorityLabelValue = getPriorityLabelValue(issueLabels.data);

    const fetchedUser = this._updateUserRfcComments(fetchedUsers, priorityLabelValue);
    await this.context.adapters.storage.handleUserBaseStorage(fetchedUser, "update");
  }

  public async tryFollowupForAllUsers(): Promise<{ status: number; reason: string }> {
    const allUsers = await this.context.adapters.storage.retrieveAllUsers();

    for (const user of allUsers) {
      await this._followUpRfcs(user);
      await this.context.adapters.storage.handleUserBaseStorage(user, "update");
    }

    return { status: 200, reason: "success" };
  }

  private async _handleRfcCommentFollowUp(rfcComment: RfcComment, user: StorageUser): Promise<void> {
    const commentUrl = this.triggerHelpers.ownerRepoNumberFromCommentUrl(rfcComment.comment_url);

    if (!commentUrl) {
      logger.error(`Comment URL not found`, { rfcComment });
      return;
    }

    const { owner, repo, number } = commentUrl;
    const issueComments = await this.context.octokit.paginate(this.context.octokit.rest.issues.listComments, { owner, repo, issue_number: number });

    const comment = issueComments.find((c) => c.id === rfcComment.comment_id);
    if (!comment) {
      logger.error(`Comment not found`, { rfcComment });
      return;
    }

    const commentDateToUse = new Date(comment.updated_at) > new Date(comment.created_at) ? new Date(comment.updated_at) : new Date(comment.created_at);

    // has the user commented on the RFC?
    const commentsAfterRfc = issueComments.filter((c) => new Date(c.created_at).getTime() > commentDateToUse.getTime());

    // if the user has commented on the RFC, we don't need to send a notification
    // we can remove the RFC comment from the user's list
    if (commentsAfterRfc.length > 0 && commentsAfterRfc.some((c) => c.user?.login === user.github_username)) {
      user.rfc_comments = user.rfc_comments.filter((c) => c.comment_id !== rfcComment.comment_id);
      await this.context.adapters.storage.handleUserBaseStorage(user, "update");
      return;
    }

    await this._sendRfcNotification(rfcComment, user);
  }

  private async _sendRfcNotification(rfcComment: RfcComment, user: StorageUser): Promise<void> {
    const rfcMessage = NotificationMessage.getRfcMessage({
      username: user.github_username,
      comment: rfcComment.comment,
      commentUrl: rfcComment.comment_url,
    });

    const userPrivateChat = await this.getChat(user.telegram_id);

    if (!userPrivateChat) {
      logger.error(`This user has not started a chat with the bot yet`, { userTelegramId: user.telegram_id });
      return;
    }

    await this.deliverNotification(user.telegram_id, rfcMessage);
    rfcComment.last_push = new Date().toISOString();
    user.rfc_comments = user.rfc_comments.map((c) => (c.comment_id === rfcComment.comment_id ? rfcComment : c));

    await this.context.adapters.storage.handleUserBaseStorage(user, "update");
    await this._handleCommentReaction(rfcComment);
  }

  private async _handleCommentReaction(rfcComment: RfcComment): Promise<void> {
    const urlData = this.triggerHelpers.ownerRepoNumberFromCommentUrl(rfcComment.comment_url);
    if (!urlData) {
      logger.error(`Comment URL not found`, { rfcComment });
      return;
    }

    const { owner, repo } = urlData;
    const comment = await this.context.octokit.rest.issues.getComment({
      comment_id: rfcComment.comment_id,
      owner,
      repo,
    });

    if (!comment) {
      logger.error(`Comment not found`, { rfcComment });
      return;
    }

    const hasEyeReactions = comment.data.reactions?.eyes && comment.data.reactions.eyes > 0;
    if (hasEyeReactions) {
      // was it the bot that reacted with eyes?
      const reactions = await this.context.octokit.rest.reactions.listForIssueComment({
        comment_id: rfcComment.comment_id,
        owner,
        repo,
      });

      const appSlug = this.context.pluginEnvCtx.getAppSlug();
      const botReaction = reactions.data.find((r) => r.user?.login.toLowerCase().includes(appSlug));
      if (botReaction) {
        // add another reaction to signal we've sent multiple? edit the rfc comment to say we've sent multiple?
        return;
      }
    }
    await this.context.octokit.rest.reactions.createForIssueComment({
      comment_id: rfcComment.comment_id,
      owner,
      repo,
      content: "eyes", // (-_-)
    });
  }

  private async _followUpRfcs(user: StorageUser): Promise<boolean> {
    const { listening_to, rfc_comments, github_username } = user;

    if (!rfc_comments || !github_username || !listening_to.rfc) {
      logger.info("No RFC comments or github username or not listening to RFC", { rfc_comments, github_username, listening_to });
      return false;
    }

    const rfcsCommentsToFollowUp = this._getRfcsCommentsToFollowUp(user);
    if (!rfcsCommentsToFollowUp.length) {
      logger.info("No RFC comments to follow up", { rfcsCommentsToFollowUp });
      return false;
    }

    for (const rfcComment of rfcsCommentsToFollowUp) {
      await this._handleRfcCommentFollowUp(rfcComment, user);
    }

    return true;
  }

  private _updateUserRfcComments(fetchedUsers: StorageUser[], priorityLabelValue: number): StorageUser {
    const fetchedUser = fetchedUsers[0];
    const rfcComments = fetchedUser.rfc_comments ?? [];

    const { comment } = this.context.payload;
    const rfcComment: RfcComment = {
      comment_id: comment.id,
      comment: comment.body,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      comment_url: comment.html_url,
      follow_up_allowed_after: ms(this.context.config.privateNotifications.rfcFollowUpPriorityScale[priorityLabelValue], { long: true }),
    };

    const existingComment = rfcComments.find((c) => c.comment_id === rfcComment.comment_id);
    if (existingComment) {
      existingComment.comment = rfcComment.comment;
      existingComment.updated_at = rfcComment.updated_at;
    } else {
      rfcComments.push(rfcComment);
    }

    fetchedUser.rfc_comments = rfcComments;
    return fetchedUser;
  }

  private _getRfcsCommentsToFollowUp(user: StorageUser): RfcComment[] {
    const now = new Date();
    return user.rfc_comments.filter((c) => {
      const followUpAllowedAfter = ms(c.follow_up_allowed_after as StringValue);

      if (isNaN(followUpAllowedAfter)) {
        logger.error(`Invalid follow_up_allowed_after date: ${c.follow_up_allowed_after}`);
        return false;
      }

      const followUpAllowedDate = new Date(c.last_push ?? c.created_at);
      followUpAllowedDate.setMilliseconds(followUpAllowedDate.getMilliseconds() + followUpAllowedAfter);

      return now > followUpAllowedDate;
    });
  }

  private _getUsernameFromRfcComment(body: string, rfcMatches: [] | RegExpExecArray): string | null {
    if (rfcMatches[1]) return rfcMatches[1];
    if (rfcMatches[2]) return rfcMatches[2];
    if (rfcMatches[3]) return rfcMatches[3];

    logger.error(`Username not found in RFC comment`, { body });
    return null;
  }

  protected getUserId() {
    return null;
  }

  protected shouldSkipNotification(): boolean {
    return false;
  }

  protected getMessage() {
    return null;
  }
}
