import { Context, SupportedEvents, SupportedEventsU } from "../types";
import { createChatroom } from "./github/workrooms";

type Result = { status: "success" } | { status: string; reason: string; content?: string | Record<string, any> };

/**
 * The `Context` type is a generic type defined as `Context<TEvent, TPayload>`,
 * where `TEvent` is a string representing the event name (e.g., "issues.labeled")
 * and `TPayload` is the webhook payload type for that event, derived from
 * the `SupportedEvents` type map.
 * 
 * The `ProxyCallbacks` type is defined using `Partial<ProxyTypeHelper>` to allow
 * optional callbacks for each event type. This is useful because not all events
 * may have associated callbacks.
 * 
 * The expected function signature for callbacks looks like this:
 * 
 * ```typescript
 * fn(context: Context<"issues.labeled", SupportedEvents["issues.labeled"]>): Promise<Result>
 * ```
 */

type ProxyCallbacks = Partial<ProxyTypeHelper>;
type ProxyTypeHelper = {
    [K in SupportedEventsU]: Array<(context: Context<K, SupportedEvents[K]>) => Promise<Result>>;
};

/**
 * Why do we need this wrapper function?
 * 
 * By using a generic `Function` type for the callback parameter, we bypass strict type 
 * checking temporarily. This allows us to pass a standard `Context` object, which we know
 * contains the correct event and payload types, to the callback safely. 
 * 
 * We can trust that the `ProxyCallbacks` type has already ensured that each callback function 
 * matches the expected event and payload types, so this function provides a safe and 
 * flexible way to handle callbacks without introducing type or logic errors.
 */
function handleCallback(callback: Function, context: Context) {
    return callback(context);
}

/**
 * The `callbacks` object defines an array of callback functions for each supported event type.
 * 
 * Since multiple callbacks might need to be executed for a single event, we store each 
 * callback in an array. This design allows for extensibility and flexibility, enabling 
 * us to add more callbacks for a particular event without modifying the core logic.
 */
const callbacks: ProxyCallbacks = {
    "issues.labeled": [
        createChatroom,
    ]
};

/**
 * The `proxyCallbacks` function returns a Proxy object that intercepts access to the 
 * `callbacks` object. This Proxy enables dynamic handling of event callbacks, including:
 * 
 * - **Event Handling:** When an event occurs, the Proxy looks up the corresponding 
 *   callbacks in the `callbacks` object. If no callbacks are found for the event, 
 *   it returns a `skipped` status.
 * 
 * - **Error Handling:** If an error occurs while processing a callback, the Proxy 
 *   logs the error and returns a `failed` status.
 * 
 * The Proxy uses the `get` trap to intercept attempts to access properties on the 
 * `callbacks` object. This trap allows us to asynchronously execute the appropriate 
 * callbacks based on the event type, ensuring that the correct context is passed to 
 * each callback.
 */
export function proxyCallbacks({ logger }: Context) {
    return new Proxy(callbacks, {
        get(target, prop: SupportedEventsU) {
            return async (context: Context) => {
                if (!target[prop]) {
                    return { status: "skipped", reason: "unsupported_event" };
                }
                try {
                    for (const callback of target[prop]) {
                        await handleCallback(callback, context);
                    }

                    // @TODO: better handling for returning the outcome of multiple callbacks
                    return { status: "success" };
                } catch (er) {
                    logger.error(`Failed to handle event ${prop}`, { er });
                    return { status: "failed", reason: "callback_error" };
                }
            };
        },
    });
}
