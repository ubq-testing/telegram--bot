export interface Withsha {
    sha?: string;
}

/**
 * Used as our user-base storage layer. We'll demo by setting up
 * direct DMs based on webhook events/plugin outcomes.
 */
export type UserBank = {
    [key: string]: {
        telegramId: number;
        githubId: number;
        githubUsername: string;
        /**
         * TODO: How we'll handle subscribing to particular triggers.
         */
        listeningTo: string[];
        /**
         * If you want to hook into another user's events, you can
         * but they'll use your own `listeningTo` array. This
         * could be expanded to allow for customizing the events
         * per additional user.
         */
        additionalUserListeners: string[];
    } & Withsha
} & Withsha

export type Chat = {
    status: "open" | "closed" | "reopened";
    taskNodeId: string;
    chatName: string;
    chatId: number;
    userIds: number[];
    createdAt: string;
    modifiedAt: string;
} & Withsha

export type ChatStorage = {
    chats: Chat[];
} & Withsha

export type SessionStorage = {
    session: string;
} & Withsha

export type StorageTypes = "allChats" | "userBank" | "singleChat" | "session";
export type ChatAction = "create" | "reopen" | "close";

export type HandleChatParams<TAction extends ChatAction = ChatAction> = {
    chat: Chat;
    action: TAction;
}

export type RetrievalHelper<TType extends StorageTypes> =
    TType extends "allChats" ? ChatStorage :
    TType extends "userBank" ? UserBank :
    TType extends "singleChat" ? Chat :
    TType extends "session" ? SessionStorage :
    never
