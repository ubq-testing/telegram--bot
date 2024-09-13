import { SupabaseClient } from "@supabase/supabase-js";
import { Super } from "./supabase";

type Wallet = {
  address: string;
};

export class User extends Super {
  constructor(supabase: SupabaseClient) {
    super(supabase);
  }

  async getWalletByUserId(userId: number) {
    const { data, error } = (await this.supabase.from("users").select("wallets(*)").eq("id", userId).single()) as { data: { wallets: Wallet }; error: unknown };
    if ((error && !data) || !data.wallets?.address) {
      this.logger.error("No wallet address found", { userId });
    } else {
      this.logger.info("Successfully fetched wallet", { userId, address: data.wallets?.address });
    }

    return data?.wallets?.address || null;
  }
}
