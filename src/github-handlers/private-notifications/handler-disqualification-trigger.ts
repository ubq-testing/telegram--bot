import { NotificationHandlerBase } from "./notification-handler-base";
import { Context } from "../../types";
import { CallbackResult } from "../../types/proxy";
import { NotificationMessage } from "./notification-message";
import { StorageUser } from "../../types/storage";

class DisqualificationDmHandler extends NotificationHandlerBase<"issues.unassigned"> {
  protected getUserId() {
    return this.context.payload.issue.assignee?.id ?? this.context.payload.assignee?.id ?? 0;
  }

  protected shouldSkipNotification(dbUser: StorageUser) {
    return !dbUser.listening_to["disqualification"] || this.context.payload.sender.id === dbUser.github_id;
  }

  protected getMessage(username: string) {
    const ownerRepo = this.context.payload.repository.full_name;
    const issueNumber = this.context.payload.issue.number;
    return NotificationMessage.getDisqualificationMessage({
      issueHtmlUrl: this.context.payload.issue.html_url,
      repositoryFullName: ownerRepo,
      issueNumber: issueNumber.toString(),
      username,
    });
  }
}

export async function disqualificationNotification(context: Context<"issues.unassigned">): Promise<CallbackResult> {
  const notifier = new DisqualificationDmHandler(context);
  return notifier.handle();
}
