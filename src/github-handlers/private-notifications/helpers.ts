import { Context } from "../../types";
import { StorageUser } from "../../types/storage";
import { logger } from "../../utils/logger";

export async function retrieveUsersByGithubUsernames(usernames: string[], context: Context<"issue_comment.created" | "issue_comment.edited">) {
  const {
    adapters: { storage },
    octokit,
  } = context;

  const users: StorageUser[] = [];

  for (const username of usernames) {
    if (!username) {
      continue;
    }
    try {
      const user = await octokit.rest.users.getByUsername({ username: username.includes("@") ? username.replace("@", "") : username });
      const storageUser = await storage.retrieveUserByGithubId(user.data.id);
      if (storageUser) {
        users.push(storageUser);
      } else {
        logger.error(`User not found in storage`, { username });
      }
    } catch (er) {
      logger.error(`Error getting user by github id`, { er });
    }
  }

  return users;
}
