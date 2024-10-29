import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";

export function rateLimit(options: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetTime: number }>();
  return async (c: Context, next: () => Promise<void>) => {
    const ip = c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip");
    const now = Date.now();
    const record = hits.get(ip ?? "") ?? { count: 0, resetTime: now + options.windowMs };
    if (record.resetTime <= now) {
      record.count = 0;
      record.resetTime = now + options.windowMs;
    }
    record.count++;
    if (record.count > options.max) {
      c.res.headers.set("Retry-After", Math.ceil((record.resetTime - now) / 1000).toString());
      throw new HTTPException(429, { message: "Too Many Requests" });
    }
    if (ip) {
      hits.set(ip, record);
    } else {
      // throws when resetting local. Might not be required at all but was for debugging
      // throw new HTTPException(400, { message: "Bad Request" });
    }
    await next();
  };
}

export function cors(options = { origin: "*", methods: "GET,POST,OPTIONS", headers: "Content-Type" }) {
  return async (c: Context, next: () => Promise<void>) => {
    c.res.headers.set("Access-Control-Allow-Origin", options.origin);
    c.res.headers.set("Access-Control-Allow-Methods", options.methods);
    c.res.headers.set("Access-Control-Allow-Headers", options.headers);
    if (c.req.method === "OPTIONS") {
      return c.text("", 204);
    }
    await next();
  };
}

export function securityHeaders() {
  return async (c: Context, next: () => Promise<void>) => {
    c.res.headers.set("X-Content-Type-Options", "nosniff");
    c.res.headers.set("X-Frame-Options", "DENY");
    c.res.headers.set("Referrer-Policy", "no-referrer");
    c.res.headers.set("Content-Security-Policy", "default-src 'self'");
    await next();
  };
}

export function jsonErrorHandler() {
  return async (c: Context, next: () => Promise<void>) => {
    try {
      await next();
    } catch (err) {
      if (err instanceof SyntaxError && err.message.includes("JSON")) {
        throw new HTTPException(400, { message: "Invalid JSON" });
      }
      throw err;
    }
  };
}
