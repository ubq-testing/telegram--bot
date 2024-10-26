import { Context } from "../types";
import { SessionManagerFactory } from "../bot/mtproto-api/bot/session/session-manager";

export function createAdapters(ctx: Context) {
  const {
    config: { shouldUseGithubStorage },
  } = ctx;
  return {
    storage: SessionManagerFactory.createSessionManager(shouldUseGithubStorage, ctx).storage,
  };
}
