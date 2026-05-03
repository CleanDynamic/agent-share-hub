import { supabase } from "@/integrations/supabase/client";
import type { ZoneContentResult, ZoneItem, ZoneName } from "./types";

interface ZoneArgs {
  userId: string;
  zone: ZoneName;
  filter?: string;
  sort?: string;
  offset?: number;
  limit?: number;
  // Visibility gate. When the profile is private and the viewer is NOT the
  // owner, every zone returns an empty page.
  isPrivate?: boolean;
  isOwnProfile?: boolean;
}

const DEFAULT_LIMIT = 20;

function pack<T extends ZoneItem>(items: T[], limit: number): ZoneContentResult {
  return { items: items.slice(0, limit), hasMore: items.length > limit };
}

async function authoredZone({
  userId,
  filter,
  sort,
  offset = 0,
  limit = DEFAULT_LIMIT,
}: ZoneArgs): Promise<ZoneContentResult> {
  // Special filter: surface accepted bounty solutions for this user.
  if (filter === "solution") {
    const { data, error } = await (supabase as any)
      .from("solution_acceptance_log")
      .select(
        "id, accepted_at, slot_kind, bounty_id, solution_id, content_items!solution_acceptance_log_bounty_id_fkey(id, title, slug, post_type)"
      )
      .eq("solver_id", userId)
      .order("accepted_at", { ascending: false })
      .range(offset, offset + limit);
    if (error) throw error;
    const items: ZoneItem[] = (data ?? []).map((r: any) => ({
      id: `solution:${r.id}`,
      kind: "solution",
      title: r.content_items?.title
        ? `Solution accepted on “${r.content_items.title}”`
        : "Solution accepted",
      subtitle: `${r.slot_kind} slot`,
      href: r.content_items?.slug
        ? `/content/${r.content_items.slug}#solution-${r.solution_id}`
        : `/content/${r.bounty_id}#solution-${r.solution_id}`,
      occurredAt: r.accepted_at,
    }));
    return pack(items, limit);
  }

  let q = supabase
    .from("content_items")
    .select("id, title, subtitle, post_type, slug, view_count, created_at, published_at")
    .eq("creator_id", userId)
    .eq("status", "approved");
  if (filter && filter !== "all") q = q.eq("post_type", filter);

  const orderCol = sort === "popular" ? "view_count" : "published_at";
  q = q.order(orderCol, { ascending: false, nullsFirst: false });
  q = q.range(offset, offset + limit); // +limit to peek at hasMore

  const { data, error } = await q;
  if (error) throw error;

  const items: ZoneItem[] = (data ?? []).map((r: any) => ({
    id: r.id,
    kind: r.post_type,
    title: r.title,
    subtitle: r.subtitle,
    href: r.slug ? `/content/${r.slug}` : `/content/${r.id}`,
    meta: { views: r.view_count },
    occurredAt: r.published_at ?? r.created_at,
  }));
  return pack(items, limit);
}

async function curatedZone({
  userId,
  offset = 0,
  limit = DEFAULT_LIMIT,
}: ZoneArgs): Promise<ZoneContentResult> {
  // Curated = collections this user owns + saved items in user_library.
  const [colRes, libRes] = await Promise.all([
    supabase
      .from("collections")
      .select("id, title, description, updated_at")
      .eq("owner_id", userId)
      .order("updated_at", { ascending: false }),
    (supabase as any)
      .from("user_library")
      .select("id, content_id, added_at, content_items(id, title, slug, post_type)")
      .eq("user_id", userId)
      .order("added_at", { ascending: false }),
  ]);

  const collections: ZoneItem[] = (colRes.data ?? []).map((c: any) => ({
    id: c.id,
    kind: "collection",
    title: c.title,
    subtitle: c.description,
    href: `/collections/${c.id}`,
    occurredAt: c.updated_at,
  }));

  const saves: ZoneItem[] = (libRes.data ?? []).map((row: any) => ({
    id: row.id,
    kind: "save",
    title: row.content_items?.title ?? "Saved item",
    subtitle: row.content_items?.post_type ?? null,
    href: row.content_items
      ? `/content/${row.content_items.slug ?? row.content_items.id}`
      : null,
    occurredAt: row.added_at,
  }));

  const merged = [...collections, ...saves]
    .sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt))
    .slice(offset, offset + limit + 1);
  return pack(merged, limit);
}

async function activityZone({
  userId,
  offset = 0,
  limit = DEFAULT_LIMIT,
}: ZoneArgs): Promise<ZoneContentResult> {
  // No unified activity log table exists. We synthesise a feed from the few
  // tables that DO carry per-user timestamps over the last 90 days.
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [ratings, comments, verifications] = await Promise.all([
    supabase
      .from("content_ratings")
      .select("id, content_id, rating, created_at")
      .eq("user_id", userId)
      .gte("created_at", cutoff),
    supabase
      .from("content_comments")
      .select("id, content_id, text, created_at")
      .eq("user_id", userId)
      .gte("created_at", cutoff),
    supabase
      .from("content_verifications")
      .select("id, content_id, verified_at")
      .eq("user_id", userId)
      .gte("verified_at", cutoff),
  ]);

  const items: ZoneItem[] = [
    ...((ratings.data ?? []) as any[]).map(r => ({
      id: `rating:${r.id}`,
      kind: "rating",
      title: `Rated ${r.rating}★`,
      href: `/content/${r.content_id}`,
      occurredAt: r.created_at,
    })),
    ...((comments.data ?? []) as any[]).map(c => ({
      id: `comment:${c.id}`,
      kind: "comment",
      title: (c.text ?? "").slice(0, 140),
      href: `/content/${c.content_id}`,
      occurredAt: c.created_at,
    })),
    ...((verifications.data ?? []) as any[]).map(v => ({
      id: `verify:${v.id}`,
      kind: "verification",
      title: "Verified a blueprint",
      href: `/content/${v.content_id}`,
      occurredAt: v.verified_at,
    })),
  ]
    .sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt))
    .slice(offset, offset + limit + 1);

  return pack(items, limit);
}

async function networkZone({
  userId,
  offset = 0,
  limit = DEFAULT_LIMIT,
}: ZoneArgs): Promise<ZoneContentResult> {
  const [outRes, inRes, collabRes] = await Promise.all([
    (supabase as any)
      .from("follows")
      .select("id, following_id, created_at, profiles!follows_following_id_fkey(id, username, display_name, avatar_url)")
      .eq("follower_id", userId)
      .order("created_at", { ascending: false }),
    (supabase as any)
      .from("follows")
      .select("id, follower_id, created_at, profiles!follows_follower_id_fkey(id, username, display_name, avatar_url)")
      .eq("following_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("content_collaborators")
      .select("id, collaborator_id, joined_at, content_id")
      .eq("collaborator_id", userId)
      .order("joined_at", { ascending: false }),
  ]);

  const follows: ZoneItem[] = ((outRes as any).data ?? []).map((row: any) => ({
    id: `follow-out:${row.id}`,
    kind: "following",
    title: row.profiles?.display_name ?? row.profiles?.username ?? "Unknown",
    href: row.profiles?.username ? `/u/${row.profiles.username}` : null,
    occurredAt: row.created_at,
  }));
  const followers: ZoneItem[] = ((inRes as any).data ?? []).map((row: any) => ({
    id: `follow-in:${row.id}`,
    kind: "follower",
    title: row.profiles?.display_name ?? row.profiles?.username ?? "Unknown",
    href: row.profiles?.username ? `/u/${row.profiles.username}` : null,
    occurredAt: row.created_at,
  }));
  const collabs: ZoneItem[] = (collabRes.data ?? []).map((row: any) => ({
    id: `collab:${row.id}`,
    kind: "collaborator",
    title: "Collaboration",
    href: `/content/${row.content_id}`,
    occurredAt: row.joined_at,
  }));

  const merged = [...follows, ...followers, ...collabs]
    .sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt))
    .slice(offset, offset + limit + 1);
  return pack(merged, limit);
}

export async function getZoneContent(args: ZoneArgs): Promise<ZoneContentResult> {
  if (!args.userId) return { items: [], hasMore: false };
  // Privacy gate: visitors of a private profile see nothing in any zone.
  if (args.isPrivate && !args.isOwnProfile) {
    return { items: [], hasMore: false };
  }
  switch (args.zone) {
    case "authored": return authoredZone(args);
    case "curated":  return curatedZone(args);
    case "activity": return activityZone(args);
    case "network":  return networkZone(args);
    default: return { items: [], hasMore: false };
  }
}
