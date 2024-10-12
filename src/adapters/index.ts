import { SupabaseClient } from "@supabase/supabase-js";
import { User } from "./supabase/helpers/user";
import { Chats } from "./supabase/helpers/chats";

export function createAdapters(supabaseClient: SupabaseClient) {
  return {
    supabase: {
      user: new User(supabaseClient),
      chats: new Chats(supabaseClient),
    },
  };
}
