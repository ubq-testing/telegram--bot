import { SupportedEventsU } from "./types";

export const notifyTriggers: Record<string, SupportedEventsU> = {
    "payment": "issue_comment.created",
    "reminder": "issue_comment.created",
    "disqualification": "issues.unassigned",
    "review": "pull_request.review_requested",
}