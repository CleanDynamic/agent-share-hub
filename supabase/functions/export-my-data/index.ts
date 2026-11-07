// =============================================================================
// export-my-data (UX-15 P6)
// =============================================================================
// One JSON file of everything the signed-in person has on the site: their profile, builds and drafts (with steps and media links),
// topics and replies, likes, follows, saves, collections, comments, the messages they sent, the threads they are in, their
// notifications and the reports they made. Nobody else's data: see export.ts.
//
// AS THE PERSON. verify_jwt = true. The Supabase client carries the CALLER's token, so every read runs under their RLS. The service
// role key is not used here and must not be.
//
// ONCE AN HOUR. `data_export_wait_seconds()` (20261111120000_ux15_settings_blocking.sql) says how long is left for this caller; a
// number above zero is a 429 with the sentence the page shows. `data_export_done()` is called only after the file was built.
// =============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { fail, json, preflight } from "../_shared/cors.ts";
import { buildExport, fileName, waitSentence, type ReadClient } from "./export.ts";

serve(async (req: Request) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== "POST") return fail(req, 405, "Use POST.");

  const header = req.headers.get("Authorization") ?? "";
  if (!/^Bearer\s+\S+/i.test(header)) return fail(req, 401, "Sign in to download your data.");

  const client = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: header } },
    auth: { persistSession: false },
  });

  const { data: who, error: whoError } = await client.auth.getUser();
  if (whoError || !who.user) return fail(req, 401, "Sign in to download your data.");

  const { data: wait, error: waitError } = await client.rpc("data_export_wait_seconds");
  if (waitError) return fail(req, 500, "Couldn't check your last download. Try again.");
  if (typeof wait === "number" && wait > 0) {
    return json(req, { error: "rate_limited", waitSeconds: wait, message: waitSentence(wait) }, 429);
  }

  try {
    const now = new Date();
    const file = await buildExport(client as unknown as ReadClient, who.user.id, now);
    const username = (file.data.profile?.[0] as { username?: string } | undefined)?.username;
    await client.rpc("data_export_done");
    return json(req, { fileName: fileName(username, now), file });
  } catch {
    return fail(req, 500, "Couldn't build your file. Try again.");
  }
});
