import { Context } from "../types";
/**
 * This function is a utility that allows us to access deeply nested properties in an object
 * primarily for use with the context.payload object. It should not be overused and the developer
 * should be aware of the potential performance implications of using this function.
 *
 * Example usage:
 *
 * - `getDeepValue(context, "payload.repository.owner.login")` will return the owner
 * - `getDeepValue(context, ["payload", "repository", "owner", "login"])` will return the owner
 */
export function getDeepValue<TK extends PropertyKey, T extends Context = Context>(obj: T, path: string | string[]): TK {
  const pathArray = Array.isArray(path) ? path : path.split(".");
  const [head, ...tail] = pathArray;

  if (tail.length === 0) {
    return obj[head as keyof T] as TK;
  }

  return getDeepValue(obj[head as keyof T] as Context, tail) as TK;
}
