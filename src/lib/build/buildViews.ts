// Mobile 28 D: one view of a build, for the maker's Views on Your progress.
//
// The database decides what counts (supabase/migrations/20261125120000_m28_build_views.sql): once per signed-in reader per
// UTC day, never the maker, published builds only. This only asks, once a page load per build, and says nothing to the
// reader: a view that is not recorded changes nothing on the page, so a failure is logged and dropped.
//
// SIGNED-OUT VISITS ARE NOT ASKED ABOUT, and nothing is kept in the browser for counting. Telling one signed-out visitor from
// another would need an identifier stored on their device, which is analytics storage: the privacy text says the site uses
// none, and UK rules would want consent first. The once-a-load guard below lives in memory for the same reason.

import { supabase } from "@/integrations/supabase/client";
import { isBotUserAgent } from "@/lib/content-detail/recordPostView";

/** The builds this page load has asked about. In memory only: nothing is written to browser storage. */
const asked = new Set<string>();

/** For tests: forget what this page load asked. */
export function forgetAskedViews(): void {
  asked.clear();
}

/** Asks the database to count one view of `buildId` by the signed-in reader. Never throws; asks nothing when signed out. */
export async function recordBuildView(buildId: string, { signedIn }: { signedIn: boolean }): Promise<void> {
  if (!buildId || !signedIn || typeof window === "undefined") return;
  if (isBotUserAgent(typeof navigator !== "undefined" ? navigator.userAgent : null)) return;
  if (asked.has(buildId)) return;
  asked.add(buildId);
  try {
    const { error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }>)("record_build_view", { p_build: buildId });
    // eslint-disable-next-line no-console -- a view that did not count is not the reader's problem; keep a trace of it
    if (error) console.warn("[recordBuildView] not recorded", { buildId, code: (error as { code?: string }).code ?? null });
  } catch (cause) {
    // eslint-disable-next-line no-console -- as above
    console.warn("[recordBuildView] not recorded", { buildId, cause: cause instanceof Error ? cause.name : "unknown" });
  }
}
