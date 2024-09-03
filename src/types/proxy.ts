import { WorkflowFunction } from "../workflow-functions";
import { Context, SupportedEvents, SupportedEventsU } from "./context";

export type CallbackResult = { status: 200 | 201 | 204 | 404 | 500, reason: string; content?: string | Record<string, any> };

/**
 * The `Context` type is a generic type defined as `Context<TEvent, TPayload>`,
 * where `TEvent` is a string representing the event name (e.g., "issues.labeled")
 * and `TPayload` is the webhook payload type for that event, derived from
 * the `SupportedEvents` type map.
 * 
 * The `ProxyCallbacks` object is cast to allow optional callbacks
 * for each event type. This is useful because not all events may have associated callbacks.
 * As opposed to Partial<ProxyCallbacks> which could mean an undefined object.
 * 
 * The expected function signature for callbacks looks like this:
 * 
 * ```typescript
 * fn(context: Context<"issues.labeled", SupportedEvents["issues.labeled"]>): Promise<Result>
 * ```
 */

type ProxyTypeHelper = {
    [K in SupportedEventsU]: Array<(context: Context<K, SupportedEvents[K]>) => Promise<CallbackResult>>;
};
export type ProxyCallbacks = ProxyTypeHelper;

/**
 * Was unable to figure a way to make this work elegantly to avoid having to use
 * typeguards in the workflow functions like we have in `ProxyCallbacks`.
 * 
 * Something in the lines of:
 * Each callback would define a generic type `T` that would be just that event type as to
 * restrict inference in Context to only that webhook although it infers all payloads in
 * all of my attempts. 
 * 
 * Would be handy as we could avoid having to use typeguards in the workflow functions.
 */
type WorkflowTypeHelper = {
    [K in SupportedEventsU]: {
        [P in WorkflowFunction]: Array<(context: Context<K, SupportedEvents[K]>) => Promise<CallbackResult>>;
    }
};

/**
 * * The expected function signature for callbacks looks like this:
 * 
 * ```typescript
 * fn(context: Context): Promise<Result>
 * ```
 */
export type WorkflowCallbacks = WorkflowTypeHelper;