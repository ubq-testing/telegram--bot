import { NotificationTriggers } from "../github-handlers/private-notifications/constants";

export interface Withsha {
  sha?: string;
}

export type StorageUser = {
  telegram_id: number;
  github_id: number;
  github_username: string;
  /**
   * The user's wallet address for receiving payments. This will likely
   * exist in the global user-base storage object for the given partner.
   *
   * But we can also store it here for easy access or perhaps this will be
   * the global user-base storage object.
   */
  wallet_address: string | null;
  /**
   * These are offered the to user via the Telegram UI and work like this:
   *
   * "Notify of Reward Comment" === "Payment" -> "issue_comment.created"
   *
   * listeningTo: ["payment"]
   */
  listening_to: Record<NotificationTriggers, boolean>;
  /**
   * Push a GitHub username to this array to apply the same
   * listeners that your own notifications use, allowing a user
   * to track multiple GitHub accounts.
   *
   * Maybe this can be expanded to have a separate set of triggers
   * compared to the user's own notifications.
   */
  additional_user_listeners: string[];
};

/**
 * Used as our user-base storage layer. We'll demo by setting up
 * direct DMs based on webhook events/plugin outcomes.
 */
export type UserBaseStorage = StorageUser & Withsha;

export type Chat = {
  status: "open" | "closed" | "reopened";
  task_node_id: string;
  chat_name: string;
  chat_id: number;
  user_ids: number[];
  created_at: string;
  modified_at: string;
} & Withsha;

export type ChatStorage = {
  chats: Chat[];
} & Withsha;

export type SessionStorage = {
  session: string | null;
} & Withsha;

export type StorageTypes = "allChats" | "userBase" | "singleChat" | "session";
export type ChatAction = "create" | "reopen" | "close";

export type HandleChatParams<TAction extends ChatAction = ChatAction> = {
  chat: Chat;
  action: TAction;
};

export type RetrievalHelper<TType extends StorageTypes> = TType extends "allChats"
  ? Chat[]
  : TType extends "userBase"
  ? UserBaseStorage
  : TType extends "singleChat"
  ? Chat
  : TType extends "session"
  ? SessionStorage
  : never;
