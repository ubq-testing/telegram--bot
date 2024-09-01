import { Context } from "#root/types/context.js";

export async function addCommentToIssue(context: Context, msg: string, owner: string, repo: string, issueNumber: number) {
    const { logger, octokit } = context;
    logger.info(`Adding comment to issue ${issueNumber}`);

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