import { Context, SharedCtx, SupportedEventsU } from "./context";

export type CallbackResult = { status: 200 | 201 | 204 | 404 | 500; reason: string; content?: string | Record<string, unknown> };

/**
 * The `Context` type is a generic type defined as `Context<TEvent>`,
 * where `TEvent` is a string representing the event name (e.g., "issues.labeled")
 *
 * The expected function signature for callbacks looks like this:
 *
 * ```typescript
 * fn(context: Context<"issues.labeled">): Promise<Result>
 * ```
 */

export type ProxyCallbacks = {
  [K in SupportedEventsU]: Array<(context: Context<K>, sharedCtx?: SharedCtx) => Promise<CallbackResult>>;
};
