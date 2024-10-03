import { Context, SupportedEvents } from "../../types";
import { CallbackResult } from "../../types/proxy";
import { TelegramBotSingleton } from "../../types/telegram-bot-single";

export async function handleIssueCommentCreated(context: Context<"issue_comment.created", SupportedEvents["issue_comment.created"]>): Promise<CallbackResult> {
    const { adapters: { github }, payload, logger } = context

    // okay first we need to collect our users to see who needs notified
    const users = await github.retrieveStorageDataObject("userBank")

    if (!users) {
        logger.error("No users found in the database.")
        return { status: 500, reason: "No users found in the database." }
    }

    // now we need to notify all of our users
    // depending on the trigger key we'll detect different messages
    const usernameToClaimUrl = parsePaymentComment(payload.comment.body)

    for (const [telegramId, user] of Object.entries(users)) {
        for (const trigger of user.listeningTo) {
            switch (trigger) {
                case "payment":
                    if (Object.keys(usernameToClaimUrl).length === 0) {
                        break
                    }
                    if (!usernameToClaimUrl[user.githubUsername]) {
                        break
                    }

                    if (Object.keys(usernameToClaimUrl).includes(user.githubUsername)) {
                        const message = `${user.githubUsername}, a task reward has been generated for you\\. You can claim it [here](https://pay\\.ubq\\.fi?claim=${usernameToClaimUrl[user.githubUsername]})`
                        let bot;
                        try {
                            bot = (await TelegramBotSingleton.initialize(context.env)).getBot()
                        } catch (er) {
                            logger.error(`Error getting bot instance`, { er })
                        }

                        if (!bot) {
                            throw new Error("Bot instance not found")
                        }

                        let userChat;

                        try {
                            userChat = await bot?.api.getChat(telegramId)
                        } catch (er) {
                            logger.error(`Error getting chat for ${telegramId}`, { er })
                        }

                        try {
                            await bot?.api.sendMessage(telegramId, message, { parse_mode: "MarkdownV2" })
                        } catch (er) {
                            logger.error(`Error sending message to ${telegramId}`, { er })
                        }
                    }
                    break
                case "reminder":
                    break
                case "disqualification":
                    break
                case "review":
                    break
            }
        }
    }

    return { status: 200, reason: "success" }
}

function parsePaymentComment(comment: string) {
    const regex = /href="https:\/\/[^\/]+\/?\?claim=([A-Za-z0-9+/=]+)"[^>]*>\s*\[.*?\]\s*<\/a>\s*<\/h3>\s*<h6>\s*@([a-zA-Z0-9-_]+)\s*<\/h6>/g
    // we'll have multiple permit comments to parse out here
    // the regex is capturing the claim url and the github username

    const claims: Record<string, string> = {}

    for (const match of comment.matchAll(regex)) {
        const [, claim, username] = match
        claims[username] = claim
    }

    return claims
}

function parseReminderComment(comment: string) {
}

function parseDisqualificationComment(comment: string) {
}

