import { isUserHasId } from "grammy-guard";

export function isAdmin() {
  return (ids: number[]) => isUserHasId(...ids);
}
