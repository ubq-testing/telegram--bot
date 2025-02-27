export class NotificationMessage {
  private static _formatMessage(template: string, data: Record<string, string>): string {
    // "Parameter name `_` must match one of the following formats: strictCamelCase"
    // eslint-disable-next-line @typescript-eslint/naming-convention
    return template.replace(/{{\s*(\w+)\s*}}/g, (_, key) => data[key] || "");
  }

  static getRfcMessage(data: { username: string; comment: string; commentUrl: string }): string {
    const template = `<b>Hello {{ username }}</b>,
    
It seems you have not responded to the RFC comment yet. Please provide your feedback on the proposed changes:
  
{{ comment }}
  
You can reply to the comment <a href="{{ commentUrl }}">here</a>.`;
    return this._formatMessage(template, data);
  }

  static getPaymentMessageFail(data: { username: string; commentUrl: string }): string {
    const template = `<b>Hello {{ username }}</b>,
    
It seems you are subscribed to payment notifications and may have received a payment. However, we couldn't find a registered wallet address for you.
      
Please use the \`/wallet\` command to set your wallet address for future notifications.
    
You can view the comment <a href="{{ commentUrl }}">here</a>.`;
    return this._formatMessage(template, data);
  }

  static getPaymentMessageSuccess(data: { username: string; claimUrlBase64String: string }): string {
    const template = `<b>Hello {{ username }}</b>,
    
🎉 A task reward has been generated for you 🎉
      
You can claim your reward by clicking the link below:
      
<a href="https://pay.ubq.fi?claim={{ claimUrlBase64String }}">Claim Your Reward</a>
      
Thank you for your contribution.`;
    return this._formatMessage(template, data);
  }

  static getReminderMessage(data: { username: string; issueHtmlUrl: string; repositoryFullName: string; issueNumber: string }): string {
    const template = `<b>Hello {{ username }}</b>,
    
This task has been idle for a while, please provide an update on <a href="{{ issue.html_url }}">{{ repository.full_name }}#{{ issue.number }}</a>.`;
    return this._formatMessage(template, data);
  }

  static getDisqualificationMessage(data: { username: string; issueHtmlUrl: string; repositoryFullName: string; issueNumber: string }): string {
    const template = `<b>Hello {{ username }}</b>,
  
You have been disqualified from <a href="{{ issue.html_url }}">{{ repository.full_name }}#{{ issue.number }}</a>.
  
You will not be able to self-assign this task again.`;
    return this._formatMessage(template, data);
  }

  static getReviewMessage(data: {
    username: string;
    pullRequestHtmlUrl: string;
    repositoryFullName: string;
    issueNumber: string;
    pullRequestAuthor: string;
  }): string {
    const template = `<b>Hello {{ username }}</b>,
  
{{ pull_request.author }} has requested a review from you on <a href="{{ pull_request.html_url }}">{{ repository.full_name }}#{{ issue.number }}</a>.`;
    return this._formatMessage(template, data);
  }
}
