import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createHandler } from "./handler.ts";

serve(
  createHandler({
    async fetchJson(url) {
      const res = await fetch(url, { headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "NeoScale" } });
      const body = await res.json().catch(() => null);
      return { status: res.status, body };
    },
  }),
);
