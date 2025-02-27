import { Context } from "../../types";
import { StorageUser } from "../../types/storage";
import { retrieveUsersByGithubUsernames } from "./shared";

export class CommentTriggerHelpers {
  private _reminderCommentRegex = /@(\w+), this task has been idle for a while/gi;
  // eslint-disable-next-line sonarjs/duplicates-in-character-class
  private _base64ClaimUrlRegex = /href="https:\/\/[^/]+\/?\?claim=([A-Za-z0-9+/=]+)"/gi;
  private _amountPatternRegex = /\[\s*\d+(\.\d+)?\s*[A-Z]+\s*\]/gi; // E.G. [ 1.5 DAI ]
  // eslint-disable-next-line sonarjs/duplicates-in-character-class
  private _githubUsernameRegex = /@([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?)/gi; // E.G. @username

  constructor(private _context: Context) {}

  /**
   * Attempts to extract users from a comment based on the payment and
   * reminder comment regexes.
   *
   * - If the comment is a payment comment, it will extract the claim URL, the
   *  amount and the GitHub usernames.
   * - If the comment is a reminder comment, it will extract the GitHub username.
   */
  public async extractUsersFromComment(body: string): Promise<{ results: { claimUrl?: string }[]; users: StorageUser[] }> {
    const isPaymentComment = this._checkIfPaymentComment(body);
    const isReminderComment = this._checkIfReminderComment(body);

    if (!isPaymentComment && !isReminderComment) {
      return { results: [], users: [] };
    }

    const results = this._extractClaimUrls(body);
    const usernames = this._extractUsernames(body, isPaymentComment, isReminderComment);

    const users = await retrieveUsersByGithubUsernames(usernames, this._context);
    return { results, users: users.filter((u): u is StorageUser => !!u) };
  }

  public ownerRepoNumberFromCommentUrl(url: string) {
    url = url.split("#")[0];
    const urlRegex = /https:\/\/github\.com\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/issues\/(?<number>\d+)/;
    const match = urlRegex.exec(url);
    if (match?.groups) {
      const { owner, repo, number } = match.groups;
      return { owner, repo, number: parseInt(number, 10) };
    }
  }

  private _checkIfPaymentComment(body: string): boolean {
    return this._base64ClaimUrlRegex.test(body) && this._amountPatternRegex.test(body) && this._githubUsernameRegex.test(body);
  }

  private _checkIfReminderComment(body: string): boolean {
    return this._reminderCommentRegex.test(body);
  }

  private _extractClaimUrls(body: string): { claimUrl?: string }[] {
    const matches = this._base64ClaimUrlRegex.exec(body) || [];
    return matches.map((match) => ({ claimUrl: match[1] }));
  }

  private _extractUsernames(body: string, isPaymentComment: boolean, isReminderComment: boolean): string[] {
    if (isPaymentComment) {
      return (this._githubUsernameRegex.exec(body) || []).map((match) => match);
    } else if (isReminderComment) {
      return [this._reminderCommentRegex.exec(body)?.[0].split(",")[0].replace("@", "")].filter((u): u is string => !!u);
    }
    return [];
  }
}
