import { Context } from "../../types";
import { StorageUser } from "../../types/storage";
import { logger } from "../../utils/logger";
import { retrieveUsersByGithubUsernames } from "./shared";
import { NotificationMessage } from "./notification-message";
import { NotificationHandlerBase } from "./notification-handler-base";

export type RfcComment = {
  comment_id: number;
  comment_url: string;
  comment: string;
  created_at: string;
  updated_at: string;
};

export class RfcCommentHandler extends NotificationHandlerBase<"issue_comment.created" | "issue_comment.edited"> {
  private _rfcCommentRegex = /rfc @(\w+)|rfc @(\w+)|request for comment @(\w+)/gi;

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

    const fetchedUser = this._updateUserRfcComments(fetchedUsers);
    await this.context.adapters.storage.handleUserBaseStorage(fetchedUser, "update");
  }

  public async tryFollowupForAllUsers(): Promise<{ status: number; reason: string }> {
    const allUsers = await this.context.adapters.storage.retrieveAllUsers();
    const { octokit } = this.context;

    for (const user of allUsers) {
      if (!this._shouldFollowUpRfc(user)) {
        continue;
      }

      const rfcsCommentsToFollowUp = this._getRfcsCommentsToFollowUp(user);
      if (!rfcsCommentsToFollowUp.length) continue;

      for (const rfcComment of rfcsCommentsToFollowUp) {
        await this._handleRfcCommentFollowUp(rfcComment, user, octokit);
      }

      user.last_rfc_check = new Date().toISOString();
      await this.context.adapters.storage.handleUserBaseStorage(user, "update");
    }

    return { status: 200, reason: "success" };
  }

  private async _handleRfcCommentFollowUp(rfcComment: RfcComment, user: StorageUser, octokit: Context["octokit"]): Promise<void> {
    const commentUrl = this.triggerHelpers.ownerRepoNumberFromCommentUrl(rfcComment.comment_url);

    if (!commentUrl) {
      logger.error(`Comment URL not found`, { rfcComment });
      return;
    }

    const { owner, repo, number } = commentUrl;
    const issueComments = await octokit.rest.issues.listComments({ owner, repo, issue_number: number });
    const comment = issueComments.data.find((c) => c.id === rfcComment.comment_id);

    if (!comment) {
      logger.error(`Comment not found`, { rfcComment });
      return;
    }

    const rfcCommentDate = new Date(rfcComment.created_at);
    const commentsAfterRfc = issueComments.data.filter((c) => new Date(c.created_at).getTime() > rfcCommentDate.getTime());

    if (commentsAfterRfc.length > 0 && commentsAfterRfc.some((c) => c.user?.login === user.github_username)) {
      user.rfc_comments = user.rfc_comments.filter((c) => c.comment_id !== rfcComment.comment_id);
      await this.context.adapters.storage.handleUserBaseStorage(user, "update");
      return;
    }

    await this._sendRfcNotification(rfcComment, user.github_username, user.telegram_id);
  }

  private async _sendRfcNotification(rfcComment: RfcComment, githubUsername: string, telegramId: number): Promise<void> {
    const rfcMessage = NotificationMessage.getRfcMessage({
      username: githubUsername,
      comment: rfcComment.comment,
      commentUrl: rfcComment.comment_url,
    });

    const userPrivateChat = await this.getChat(telegramId);

    if (!userPrivateChat) {
      logger.error(`This user has not started a chat with the bot yet`, { telegramId });
      return;
    }

    await this.deliverNotification(telegramId, rfcMessage);
  }

  private _getUsernameFromRfcComment(body: string, rfcMatches: [] | RegExpMatchArray) {
    let username;
    for (const match of rfcMatches) {
      if (match) {
        username = match.split(" ")[1];
        break;
      }
    }

    if (!username) {
      logger.error(`Username not found in RFC comment`, { body });
    }

    return username;
  }

  private _shouldFollowUpRfc(user: StorageUser): boolean {
    const { listening_to, rfc_comments, github_username } = user;

    if (!rfc_comments || !github_username || !listening_to.rfc) {
      console.log("No RFC comments or github username or not listening to RFC", { rfc_comments, github_username, listening_to });
      return false;
    }

    const now = new Date();
    const lastRfcCheck = new Date(user.last_rfc_check);
    const rfcFollowUpTime = 1000;

    if (now.getTime() - lastRfcCheck.getTime() < rfcFollowUpTime) {
      console.log("Not enough time has passed since last check", { now, lastRfcCheck });
      return false;
    }

    return true;
  }

  private _updateUserRfcComments(fetchedUsers: StorageUser[]) {
    const fetchedUser = fetchedUsers[0];
    const rfcComments = fetchedUser.rfc_comments ?? [];

    const { comment } = this.context.payload;
    const rfcComment: RfcComment = {
      comment_id: comment.id,
      comment: comment.body,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      comment_url: comment.html_url,
    };

    const existingComment = rfcComments.find((c) => c.comment_id === rfcComment.comment_id);
    if (existingComment) {
      existingComment.comment = rfcComment.comment;
      existingComment.updated_at = rfcComment.updated_at;
    } else {
      rfcComments.push(rfcComment);
    }

    fetchedUser.rfc_comments = rfcComments;
    fetchedUser.last_rfc_check = new Date().toISOString();

    return fetchedUser;
  }

  private _getRfcsCommentsToFollowUp(user: StorageUser): RfcComment[] {
    const now = new Date();
    const rfcFollowUpTime = 1000;

    return user.rfc_comments.filter((c) => {
      const commentDate = new Date(c.created_at);
      return now.getTime() - commentDate.getTime() > rfcFollowUpTime;
    });
  }

  // Required overrides for NotificationHandlerBase
  protected getUserId() {
    return undefined;
  }

  protected shouldSkipNotification(): boolean {
    return false;
  }

  protected getMessage(): string {
    return "";
  }
}
