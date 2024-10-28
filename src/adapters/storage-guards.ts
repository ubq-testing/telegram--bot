import { SessionStorage, ChatStorage, UserBaseStorage, Chat } from "../types/storage";

export function isSessionStorage(data: unknown): data is SessionStorage {
  if (typeof data !== "object" || !data) return false;
  return "session" in data;
}

export function isChatsStorage(data: unknown): data is ChatStorage {
  if (typeof data !== "object" || !data) return false;
  return "chats" in data;
}

export function isUserBaseStorage(data: unknown): data is UserBaseStorage {
  if (typeof data !== "object" || !data) return false;
  const keys = Object.keys(data);
  return keys.includes("telegram_id") && keys.includes("github_id") && keys.includes("listening_to") && keys.includes("additional_user_listeners");
}

export function isSingleChatStorage(data: unknown): data is Chat {
  if (typeof data !== "object" || !data) return false;
  return "chat_id" in data || "task_node_id" in data;
}
