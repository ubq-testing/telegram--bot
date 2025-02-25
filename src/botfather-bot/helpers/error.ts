import type { ErrorHandler } from "grammy";
import { GrammyContext } from "../helpers/create-grammy-context";
import { getUpdateInfo } from "../helpers/logging";

export function errorHandler(): ErrorHandler<GrammyContext> {
  return (error) => {
    const { ctx } = error;

    ctx.logger.error("Request failed", {
      err: error,
      update: getUpdateInfo(ctx),
    });
  };
}
