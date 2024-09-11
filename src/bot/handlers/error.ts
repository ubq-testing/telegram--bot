import type { ErrorHandler } from "grammy";
import type { Context } from "#root/bot/helpers/grammy-context.js";
import { getUpdateInfo } from "#root/bot/helpers/logging.js";

export function errorHandler(): ErrorHandler<Context> {
  return (error) => {
    const { ctx } = error;

    ctx.logger.error("Request failed", {
      err: error,
      update: getUpdateInfo(ctx),
    });
  };
}
