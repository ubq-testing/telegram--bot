import { NotificationHandlerBase } from "./notification-handler-base";
import { Context } from "../../types";
import { CallbackResult } from "../../types/proxy";
import { NotificationMessage } from "./notification-message";
import { StorageUser } from "../../types/storage";

class ReviewNotificationHandler extends NotificationHandlerBase<"pull_request.review_requested"> {
  protected getUserId() {
    return this.context.payload.requested_reviewer?.id ?? null;
  }

  protected shouldSkipNotification(dbUser: StorageUser) {
    const requestedReviewer = this.context.payload.requested_reviewer?.login;
    return this.context.payload.sender.login === requestedReviewer || !dbUser.listening_to["review"];
  }

  protected getMessage(username: string) {
    const prAuthor = this.context.payload.pull_request.user?.login ?? this.context.payload.pull_request.user?.name;
    const ownerRepo = this.context.payload.repository.full_name;
    const issueNumber = this.context.payload.pull_request.number;
    return NotificationMessage.getReviewMessage({
      pullRequestHtmlUrl: this.context.payload.pull_request.html_url,
      repositoryFullName: ownerRepo,
      pullRequestAuthor: prAuthor ?? "Unknown",
      username,
      issueNumber: issueNumber.toString(),
    });
  }
}

export async function reviewNotification(context: Context<"pull_request.review_requested">): Promise<CallbackResult> {
  const handler = new ReviewNotificationHandler(context);
  return handler.handle();
}
