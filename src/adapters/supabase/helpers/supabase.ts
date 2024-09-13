import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "#root/utils/logger.js";

export class Super {
  protected supabase: SupabaseClient;
  protected logger = logger;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }
}
