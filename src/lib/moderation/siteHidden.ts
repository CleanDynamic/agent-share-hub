// UX-09 Q5: what the site's moderators hid, and the way back (20261108160000_ux09_site_hide_topics.sql).
//
// TWO HIDES. A topic or reply hidden by its space (openbuild_posts.hidden_by) is the space's to undo; one hidden by the site
// (site_hidden_by, set by resolve_report's Hide from the Reports queue) is the site's: only an admin reads it, only an admin clears
// it. Nobody else reads a row the site hid, its author included; the author learns of it through siteHiddenPostsOf on the topic's
// page, which says "Hidden by the site's moderators" with a link to how reporting works.
//
// BEFORE THE MIGRATION IS APPLIED the column and the function are missing. Each read here then says nothing was hidden (an empty
// list), so no page breaks; Unhide cannot be reached, because nothing is listed.
//
// A BODY IS TEXT A READER WROTE ⟦neoscale-error-monitoring › Privacy⟧: shown to admins and its own author only, and never in an error.

import { currentUserId, db, signedOutError, socialError } from "@/lib/social/types";

/** Where the Terms say how reporting and moderation work. */
export const TERMS_REPORTING_HREF = "/terms#reporting";

/** The most entries the admin's list shows at once. */
export const SITE_HIDDEN_PAGE = 50;

/** Postgres: an undefined column or function; PostgREST: a function it cannot find. The migration is not applied yet. */
function notApplied(error: unknown): boolean {
  const code = error && typeof error === "object" && "code" in error ? (error as { code: unknown }).code : null;
  return code === "42703" || code === "42883" || code === "PGRST202" || code === "PGRST204";
}

const EXCERPT = 80;
function excerpt(text: string): string {
  const clean = text.trim().split("\n")[0]?.replace(/\s+/g, " ") ?? "";
  return clean.length <= EXCERPT ? clean : `${clean.slice(0, EXCERPT - 1).trimEnd()}…`;
}

export interface SiteHiddenPost {
  id: string;
  rootId: string;
  /** A topic, or a reply in one. */
  kind: "topic" | "reply";
  /** The first line, shortened. */
  text: string;
  hiddenAt: string | null;
  /** Its page: the topic, or the reply in it. */
  href: string;
}

interface SiteHiddenRow {
  id: string;
  root_id: string;
  parent_id: string | null;
  body: string;
  site_hidden_at: string | null;
}

/** Admins: the topics and replies the site hid, newest hide first. One request. */
export async function listSiteHiddenPosts(limit = SITE_HIDDEN_PAGE): Promise<SiteHiddenPost[]> {
  const size = Math.max(1, Math.min(limit, 100));
  const response = await db
    .from("openbuild_posts")
    .select("id, root_id, parent_id, body, site_hidden_at")
    .not("site_hidden_by", "is", null)
    .order("site_hidden_at", { ascending: false })
    .limit(size);
  if (response.error) {
    if (notApplied(response.error)) return [];
    throw socialError("listSiteHiddenPosts", response);
  }
  return ((response.data ?? []) as SiteHiddenRow[]).map((row) => ({
    id: row.id,
    rootId: row.root_id,
    kind: row.parent_id === null ? "topic" : "reply",
    text: excerpt(row.body) || (row.parent_id === null ? "A topic" : "A reply"),
    hiddenAt: row.site_hidden_at,
    href: row.parent_id === null ? `/openbuilds/topics/${row.root_id}` : `/openbuilds/topics/${row.root_id}#reply-${row.id}`,
  }));
}

/** Admins: undo the site's hide. The space's own hide, if any, is not touched. */
export async function unhideForSite(postId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw signedOutError("unhideForSite");
  const response = await db.from("openbuild_posts").update({ site_hidden_by: null }).eq("id", postId);
  if (response.error) throw socialError("unhideForSite", response);
}

export interface SiteHiddenNotice {
  id: string;
  kind: "topic" | "reply";
  /** The entry's first line, as its author wrote it. */
  heading: string;
}

/**
 * The signed-in reader's own entries in this topic that the site hid, so its page can tell them. The address may be the topic's or one
 * of its replies'. Empty signed out, when nothing was hidden, or before the migration.
 */
export async function siteHiddenPostsOf(topicId: string): Promise<SiteHiddenNotice[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const response = await (
    db.rpc as unknown as (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown; status?: number }>
  )("site_hidden_posts_of", { _root: topicId });
  if (response.error) {
    if (notApplied(response.error)) return [];
    throw socialError("siteHiddenPostsOf", response);
  }
  return ((response.data ?? []) as { id: string; parent_id: string | null; heading: string | null }[]).map((row) => ({
    id: row.id,
    kind: row.parent_id === null ? "topic" : "reply",
    heading: (row.heading ?? "").trim(),
  }));
}
