import type { ErrorHandler } from "grammy";
import { getUpdateInfo } from "../helpers/logging";
import { GrammyContext } from "../create-grammy-context";

export function errorHandler(): ErrorHandler<GrammyContext> {
  return (error) => {
    const { ctx } = error;

    ctx.logger.error("Request failed", {
      err: error,
      update: getUpdateInfo(ctx),
    });
  };
}
