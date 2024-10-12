import type { Middleware } from "grammy";
import { GrammyContext, GrammyTelegramUpdate } from "./grammy-context";

export function getUpdateInfo(ctx: GrammyContext): Omit<GrammyTelegramUpdate, "update_id"> {
  const { update_id, ...update } = ctx.update;

  return update;
}

export function logHandle(id: string): Middleware<GrammyContext> {
  return (ctx, next) => {
    ctx.logger.info("Handling update", {
      msg: `Handle "${id}"`,
      ...(id.startsWith("unhandled") ? { update: getUpdateInfo(ctx) } : {}),
    });

    return next();
  };
}
