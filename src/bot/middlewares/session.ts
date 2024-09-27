import { type Middleware, type SessionOptions, session as createSession } from "grammy";
import { GrammyContext, SessionData } from "../helpers/grammy-context";

type Options = Pick<SessionOptions<SessionData, GrammyContext>, "getSessionKey" | "storage">;

export function session(options: Options): Middleware<GrammyContext> {
  return createSession({
    getSessionKey: options.getSessionKey,
    storage: options.storage,
    initial: () => ({}),
  });
}
