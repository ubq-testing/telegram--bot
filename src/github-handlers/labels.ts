import { RestEndpointMethodTypes } from "@octokit/rest";
import { Context } from "../types";
type IssueLabel = RestEndpointMethodTypes["issues"]["listLabelsForRepo"]["response"]["data"][0];

export function getPriorityLabelValue(context: Context) {
    if (!("issue" in context.payload)) {
        return 0;
    }
    return Math.max(1, context.payload.issue.labels ? parsePriorityLabel(context.payload.issue.labels as IssueLabel[]) : 1);
}

export function parsePriorityLabel(labels: (IssueLabel | string)[]): number {
    for (const label of labels) {
        let priorityLabel = "";
        if (typeof label === "string") {
            priorityLabel = label;
        } else {
            priorityLabel = label.name || "";
        }

        if (priorityLabel.startsWith("Priority:")) {
            const matched = priorityLabel.match(/Priority: (\d+)/i);
            if (!matched) {
                return 1;
            }

            return Number(matched[1]);
        }
    }

    return 1;
}