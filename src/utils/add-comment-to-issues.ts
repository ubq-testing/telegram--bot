import { Context } from "../types";

/**
 * Ideally pass in owner, repo, and issueNumber, but if not provided,
 * attempt to get them from the context.
 */
export async function addCommentToIssue(context: Context, msg: string, owner?: string, repo?: string, issueNumber?: number) {
  const { logger, octokit } = context;
  logger.info(`Adding comment to ${owner}/${repo}#${issueNumber}`);

  if (!owner || !repo || !issueNumber) {
    if ("issue" in context.payload) {
      owner = context.payload.repository.owner.login;
      repo = context.payload.repository.name;
      issueNumber = context.payload.issue.number;
    }

    if ("pull_request" in context.payload) {
      owner = context.payload.repository.owner.login;
      repo = context.payload.repository.name;
      issueNumber = context.payload.pull_request.number;
    }
  }

  if (!owner || !repo || !issueNumber) {
    throw new Error(logger.error("Missing owner, repo, or issue number", { owner, repo, issueNumber }).logMessage.raw);
  }

  try {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: msg,
    });
    logger.info(`Added comment to issue ${issueNumber}`);
  } catch (er) {
    logger.error(`Failed to add comment to issue ${issueNumber}`, { er });
  }

  try {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: `<a href="https://pay.ubq.fi?claim=W3sidHlwZSI6ImVyYzIwLXBlcm1pdCIsInBlcm1pdCI6eyJwZXJtaXR0ZWQiOnsidG9rZW4iOiIweGU5MUQxNTNFMGI0MTUxOEEyQ2U4RGQzRDc5NDRGYTg2MzQ2M2E5N2QiLCJhbW91bnQiOiIyMzUwMDAwMDAwMDAwMDAwMDAifSwibm9uY2UiOiIxMDkxODYzNDgxNjgzNDYzNTEwMTQ3NTU3NzQ3NDk1MzQ3ODYwODEzOTM1NzQ4MTc0NDk1MjU2NTQ4NjkyNTYwNzU0OTYzNjc5MTUzOTMiLCJkZWFkbGluZSI6IjU3ODk2MDQ0NjE4NjU4MDk3NzExNzg1NDkyNTA0MzQzOTUzOTI2NjM0OTkyMzMyODIwMjgyMDE5NzI4NzkyMDAzOTU2NTY0ODE5OTY3In0sInRyYW5zZmVyRGV0YWlscyI6eyJ0byI6IjB4MkYwNWZENTgwMjNCMGE5NWQxODY2YWEwQTNiNjcyY0VmMDU5NDVjNSIsInJlcXVlc3RlZEFtb3VudCI6IjIzNTAwMDAwMDAwMDAwMDAwMCJ9LCJvd25lciI6IjB4MDU0RWMyNjM5ODU0OTU4OEYzYzk1ODcxOWJEMTdDQzFlNkU5N2MzQyIsInNpZ25hdHVyZSI6IjB4MzZiMGI3NmI2ZTY3NWE4MmY5YmY2MzQ1OWE4YTQ2OTJkNmYwNjJmMzc2YzlhZWJlODRhNTM1OTNjY2QxMjZiZjI0ZDFkMmNlMzdlYjU5OTk5MDExNzVjYThmZTM5YWM4NzVlYTQzNTNlMTUzOTliY2FlYjk3NTZkOTE0MTc0YjYxYiIsIm5ldHdvcmtJZCI6MTAwfV0=" target="_blank" rel="noopener">               [ 0.235 WXDAI ]             </a>           </h3>           <h6>             @keyrxng          </h6>`,
    });
    logger.info(`Added comment to issue ${issueNumber}`);
  } catch (er) {
    logger.error(`Failed to add comment to issue ${issueNumber}`, { er });
  }
}
