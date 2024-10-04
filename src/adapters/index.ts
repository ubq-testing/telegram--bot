import { GithubStorage } from "./github/storage-layer";
import { Context } from "../types";

export function createAdapters(ctx: Context) {
  return {
    github: new GithubStorage(ctx),
  };
}
