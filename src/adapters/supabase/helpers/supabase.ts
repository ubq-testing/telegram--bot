import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../../utils/logger";

export class Super {
  protected supabase: SupabaseClient;
  protected logger = logger;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }
}
