import { RestEndpointMethodTypes } from "@octokit/rest";
type IssueLabel = RestEndpointMethodTypes["issues"]["listLabelsForRepo"]["response"]["data"][0];

export function getPriorityLabelValue(labels: IssueLabel[]): number {
  return Math.max(0, labels ? parsePriorityLabel(labels as IssueLabel[]) : 0);
}

function parsePriorityLabel(labels: (IssueLabel | string)[]): number {
  const regex = /Priority: (\d+)/i;
  for (const label of labels) {
    let priorityLabel = "";
    if (typeof label === "string") {
      priorityLabel = label;
    } else {
      priorityLabel = label.name || "";
    }

    if (priorityLabel.startsWith("Priority:")) {
      const matched = regex.exec(priorityLabel);
      if (!matched) {
        return 0;
      }

      return Number(matched[1]);
    }
  }

  return 0;
}
