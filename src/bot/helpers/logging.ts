import type { Middleware } from "grammy";
import type { Update } from "@grammyjs/types";
import type { Context } from "#root/bot/helpers/grammy-context.js";

export function getUpdateInfo(ctx: Context): Omit<Update, "update_id"> {
  const { update_id, ...update } = ctx.update;

  return update;
}

export function logHandle(id: string): Middleware<Context> {
  return (ctx, next) => {
    ctx.logger.info("Handling update", {
      msg: `Handle "${id}"`,
      ...(id.startsWith("unhandled") ? { update: getUpdateInfo(ctx) } : {}),
    });

    return next();
  };
}
