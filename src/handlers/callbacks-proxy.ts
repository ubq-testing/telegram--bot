import { closeChat, createChat, reopenChat } from "#root/bot/mtproto-api/workrooms.js";
import { ProxyCallbacks } from "#root/types/proxy.js";
import { Context, SupportedEventsU } from "../types";
import { closeWorkroom, createWorkroom, reOpenWorkroom } from "./github/workrooms";

/**
 * The `callbacks` object defines an array of callback functions for each supported event type.
 * 
 * Since multiple callbacks might need to be executed for a single event, we store each 
 * callback in an array. This design allows for extensibility and flexibility, enabling 
 * us to add more callbacks for a particular event without modifying the core logic.
 */
const callbacks = {
    "issues.labeled": [
        createWorkroom,
    ],
    "issues.closed": [
        closeWorkroom
    ],
    "issues.reopened": [
        reOpenWorkroom
    ]
} as ProxyCallbacks;


/**
 * These are function which get dispatched by this worker to fire off workflows
 * in the repository. We enter through the main `compute.yml` just like a typical
 * action plugin would, we forward the same payload that the worker received to
 * the workflow the same way that the kernel does. 
 * 
 * - First event fires, `issues.labeled` and the worker catches it.
 * - The worker then dispatches a workflow to `compute.yml` with the event name as the input.
 * - The workflow receives a `issues.labeled` payload but eventName is now WorkflowFunction (`create-telegram-chat`).
 * - The workflow then runs the `createChat` function which needs a node env to run.
 * 
 * I.e we're essentially running the first dual action/worker plugin which is
 * ideal for telegram-bot as it's a bot that needs to be able to be super flexible.
 */
const workflowCallbacks = {
    "issues.labeled": [
        createChat
    ],
    "issues.closed": [
        closeChat
    ],
    "issues.reopened": [
        reopenChat
    ]
} as ProxyCallbacks;


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
export function proxyCallbacks(context: Context): ProxyCallbacks {
    return new Proxy(callbacks, {
        get(target, prop: SupportedEventsU) {
            if (!target[prop]) {
                context.logger.info(`No callbacks found for event ${prop}`);
                return { status: 204, reason: "skipped" };
            }
            return (async () => {
                try {
                    return await Promise.all(target[prop].map((callback) => handleCallback(callback, context)));
                } catch (er) {
                    context.logger.error(`Failed to handle event ${prop}`, { er });
                    return { status: 500, reason: "failed" };
                }
            })();
        },
    });
}


export function proxyWorkflowCallbacks(context: Context): ProxyCallbacks {
    return new Proxy(workflowCallbacks, {
        get(target, prop: SupportedEventsU) {
            if (!target[prop]) {
                context.logger.info(`No callbacks found for event ${prop}`);
                return { status: 204, reason: "skipped" };
            }

            try {
                return (async () => {
                    try {
                        await Promise.all(target[prop].map((callback) => handleCallback(callback, context)));
                        await exit(0);
                    } catch (er) {
                        let error: { code: number, seconds: number, errorMessage: string } | undefined;

                        if ("er" in er) {
                            error = er.er as { code: number, seconds: number, errorMessage: string };
                        }

                        console.log("Error-Error: ", error);

                        if (error && error.code === 420 || error?.errorMessage === "FLOOD") {
                            await new Promise((resolve) => setTimeout(resolve, error.seconds * 1000));
                            return await Promise.all(target[prop].map((callback) => handleCallback(callback, context)));
                        }
                    }
                })();
            } catch (er) {
                context.logger.error(`Failed to handle event ${prop}`, { er });
                return { status: 500, reason: "failed" };
            }
        }
    });
}

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
 * Will be used to exit the process with a status code.
 * 
 * 0 - Success
 * 1 - Failure
 */
async function exit(status: number = 0) {
    process.exit(status);
}