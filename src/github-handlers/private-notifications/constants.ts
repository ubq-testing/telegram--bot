import { SupportedEventsU } from "../../types";

export type NotificationTriggers = "rfc" | "payment" | "review" | "disqualification" | "reminder";

export const notifyTriggers: Record<NotificationTriggers, SupportedEventsU> = {
  rfc: "issue_comment.created",
  payment: "issue_comment.created",
  reminder: "issue_comment.created",
  disqualification: "issues.unassigned",
  review: "pull_request.review_requested",
};
