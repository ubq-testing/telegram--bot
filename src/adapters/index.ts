import { GithubStorage } from "./github/storage-layer";
import { Context } from "../types";

export function createAdapters(octokit: Context["octokit"]) {
  return {
    github: new GithubStorage(octokit)
  };
}
