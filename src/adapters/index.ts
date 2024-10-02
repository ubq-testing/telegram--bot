import { SupabaseClient } from "@supabase/supabase-js";
import { User } from "./supabase/helpers/user";
import { Chats } from "./supabase/helpers/chats";
import { GithubStorage } from "./github/storage-layer";
import { Context } from "../types";

export function createAdapters(context: Context, supabaseClient: SupabaseClient) {
  return {
    github: new GithubStorage(context),
    supabase: {
      user: new User(supabaseClient),
      chats: new Chats(supabaseClient),
    },
  };
}
