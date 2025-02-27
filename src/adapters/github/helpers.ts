import { Chat, ChatStorage, UserBaseStorage, SessionStorage, Withsha } from "../../types/storage";

export function deleteAllShas<T extends Withsha>(data: T) {
  Object.keys(data).forEach((key) => {
    const value = data[key as keyof typeof data];

    if (key === "sha") {
      Reflect.deleteProperty(data, key);
    }

    if (typeof value === "object" && value) {
      deleteAllShas(value);
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === "object" && item) {
          deleteAllShas(item);
        }
      });
    }
  });

  return data;
}

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
  const firstItem = Object.values(data)[0];
  if (typeof firstItem !== "object" || !firstItem) return false;
  const keys = Object.keys(firstItem);
  return keys.includes("telegram_id") && keys.includes("github_id") && keys.includes("listening_to") && keys.includes("additional_user_listeners");
}

export function isSingleChatStorage(data: unknown): data is Chat {
  if (typeof data !== "object" || !data) return false;
  return "chat_id" in data || "task_node_id" in data;
}
