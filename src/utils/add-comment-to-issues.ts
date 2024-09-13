import { Context } from "#root/types/context.js";
import { getDeepValue } from "#root/utils/get-deep-value.js";

/**
 * Ideally pass in owner, repo, and issueNumber, but if not provided,
 * attempt to get them from the context.
 */
export async function addCommentToIssue(context: Context, msg: string, owner?: string, repo?: string, issueNumber?: number) {
  const { logger, octokit } = context;
  logger.info(`Adding comment to ${owner}/${repo}#${issueNumber}`);

  if (!owner || !repo || !issueNumber) {
    owner = getDeepValue<string>(context, "payload.repository.owner.login");
    repo = getDeepValue<string>(context, "payload.repository.name");
    issueNumber = getDeepValue<number>(context, "payload.issue.number");
  }

  if (!owner || !repo || !issueNumber) {
    throw new Error(logger.error("Missing owner, repo, or issue number", { owner, repo, issueNumber }).logMessage.raw);
  }

  try {
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: msg,
    });
    logger.info(`Added comment to issue ${issueNumber}`);
  } catch (er) {
    logger.error(`Failed to add comment to issue ${issueNumber}`, { er });
  }
}
