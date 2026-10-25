// Who is calling, from the token the browser sent. Deno only.
//
// The user id comes from the verified token, never from the body. A call made
// with just the project's public key has no user, and gets null.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface Caller {
  id: string;
  email: string | null;
}

export async function getCaller(req: Request): Promise<Caller | null> {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const client = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}
