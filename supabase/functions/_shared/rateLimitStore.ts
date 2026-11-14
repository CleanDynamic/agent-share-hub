// G10: the per-IP limit's store, in the database. Deno only: rateLimit.ts is the part Vitest loads.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { RateStore } from "./rateLimit.ts";

export function databaseRateStore(): RateStore {
  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  return {
    hit: async (bucket, limit, windowSeconds) => {
      const { data, error } = await db.rpc("edge_rate_limit_hit", { _bucket: bucket, _limit: limit, _window_seconds: windowSeconds });
      if (error) throw new Error(error.message);
      return data === true;
    },
  };
}
