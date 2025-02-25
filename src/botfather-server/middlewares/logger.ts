import type { MiddlewareHandler } from "hono";
import { Logger } from "../../utils/logger";

export function setLogger(logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    c.set("logger", logger);

    await next();
  };
}
