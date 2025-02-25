import { isUserHasId } from "grammy-guard";

export function isAdmin(ids: number[]) {
  return isUserHasId(...ids);
}
