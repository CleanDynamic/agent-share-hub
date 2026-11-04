// What can go on a post (UX-04 Part 7): the work the composer offers at one size, matching the authorship rule of Part 3.
//
//   * Always: the person's own drafts and published builds, and the work they attached to earlier posts.
//   * For a ROOT post only: other people's published work whose maker allows it (builds.allow_as_post_source).
//   * A reply offers only the person's own, because the database refuses anything else.
//
// "Own" follows the database's: a step is its contributor's where SV-16 names one, else the build's maker's; a session likewise through
// sessions_meta; a part (a group of sessions) and a build are the build's maker's.

import { sessionsMetaOf, storedWorkstreamsOf } from "@/lib/build/making";
import { db, postLayerError, type WorkSize } from "./types";

export type AttachableOrigin = "draft" | "published" | "earlier_post" | "others";

export interface AttachableWork {
  size: WorkSize;
  origin: AttachableOrigin;
  buildId: string;
  buildTitle: string;
  nodeId: string | null;
  partKey: string | null;
  sessionKey: string | null;
  /** What to call it: the step's title, the part's name, the session's title, or the build's. */
  title: string;
  makerId: string;
}

export interface AttachableOptions {
  userId: string;
  size: WorkSize;
  /** Words the title must contain. */
  query?: string;
  /** Offer only what a reply may carry. */
  forReply?: boolean;
}

/** Candidates read per source, and returned in all. */
const PER_SOURCE = 20;
const TOTAL = 40;
const LIVE = ["published", "gallery"];

interface BuildRow {
  id: string;
  title: string | null;
  status: string;
  creator_id: string;
  making?: unknown;
}

const wildcard = (query: string | undefined) => `%${(query ?? "").trim().replace(/[%_,()]/g, " ")}%`;
const includes = (title: string, query: string | undefined) => !query?.trim() || title.toLowerCase().includes(query.trim().toLowerCase());
const originOf = (build: BuildRow, userId: string): AttachableOrigin => (build.creator_id !== userId ? "others" : build.status === "draft" ? "draft" : "published");

const BUILD_COLUMNS = "id, title, status, creator_id, making";

/** The builds in play: the person's own (any status), and for a root post other people's live builds that allow it. */
async function buildsFor(options: AttachableOptions, withTitle: boolean): Promise<BuildRow[]> {
  const pattern = withTitle && options.query?.trim() ? wildcard(options.query) : null;
  let own = db.from("builds").select(BUILD_COLUMNS).eq("creator_id", options.userId).order("created_at", { ascending: false }).limit(PER_SOURCE);
  if (pattern) own = own.ilike("title", pattern);
  let others: PromiseLike<{ data: unknown; error: unknown }> = Promise.resolve({ data: [], error: null });
  if (!options.forReply) {
    let query = db.from("builds").select(BUILD_COLUMNS).neq("creator_id", options.userId).in("status", LIVE).eq("allow_as_post_source", true).order("created_at", { ascending: false }).limit(PER_SOURCE);
    if (pattern) query = query.ilike("title", pattern);
    others = query;
  }
  const [mine, theirs] = await Promise.all([own, others]);
  if (mine.error) throw postLayerError("listAttachableWork", mine);
  if (theirs.error) throw postLayerError("listAttachableWork", theirs);
  return [...((mine.data ?? []) as BuildRow[]), ...((theirs.data ?? []) as BuildRow[])];
}

/** The user's own, and other people's when the post is a root, at one size, plus what they attached to earlier posts. */
export async function listAttachableWork(options: AttachableOptions): Promise<AttachableWork[]> {
  const { userId, size } = options;
  const found: AttachableWork[] = [];
  const earlier = db
    .from("post_attachments")
    .select("kind, build_id, node_id, part_key, session_key, build:builds(id, title, creator_id), post:posts!inner(author_id)")
    .eq("post.author_id", userId)
    .eq("kind", size)
    .limit(PER_SOURCE);

  if (size === "build") {
    const [builds, past] = await Promise.all([buildsFor(options, true), earlier]);
    for (const build of builds) {
      found.push({ size, origin: originOf(build, userId), buildId: build.id, buildTitle: build.title ?? "", nodeId: null, partKey: null, sessionKey: null, title: build.title ?? "", makerId: build.creator_id });
    }
    if (past.error) throw postLayerError("listAttachableWork", past);
    pushEarlier(found, past.data, size, options.query);
  } else if (size === "step") {
    const nodes = (scope: "mine" | "others" | "contributed") => {
      let query = db
        .from("build_nodes")
        .select("id, build_id, title, contributor_id, build:builds!inner(id, title, status, creator_id, allow_as_post_source)")
        .limit(PER_SOURCE);
      if (scope === "mine") query = query.eq("build.creator_id", userId);
      else if (scope === "contributed") query = query.eq("contributor_id", userId).neq("build.creator_id", userId);
      else query = query.neq("build.creator_id", userId).in("build.status", LIVE).eq("build.allow_as_post_source", true);
      return options.query?.trim() ? query.ilike("title", wildcard(options.query)) : query;
    };
    const [mine, contributed, others, past] = await Promise.all([
      nodes("mine"),
      nodes("contributed"),
      options.forReply ? Promise.resolve({ data: [], error: null }) : nodes("others"),
      earlier,
    ]);
    for (const response of [mine, contributed, others, past]) if (response.error) throw postLayerError("listAttachableWork", response);
    type NodeRow = { id: string; build_id: string; title: string | null; contributor_id: string | null; build: BuildRow };
    const add = (rows: unknown, keep: (row: NodeRow) => boolean) => {
      for (const row of (rows ?? []) as NodeRow[]) {
        if (!keep(row)) continue;
        // A step in someone else's build whose contributor is someone else is the contributor's, not the build's maker's.
        found.push({ size, origin: originOf(row.build, userId), buildId: row.build_id, buildTitle: row.build.title ?? "", nodeId: row.id, partKey: null, sessionKey: null, title: row.title ?? "", makerId: row.contributor_id ?? row.build.creator_id });
      }
    };
    add(mine.data, (row) => row.contributor_id === null || row.contributor_id === userId);
    add(contributed.data, () => true);
    add(others.data, (row) => row.contributor_id !== userId);
    pushEarlier(found, past.data, size, options.query);
  } else {
    // A part and a session live in builds.making; read the builds and take their keys.
    const [builds, past] = await Promise.all([buildsFor(options, false), earlier]);
    if (past.error) throw postLayerError("listAttachableWork", past);
    for (const build of builds) {
      const origin = originOf(build, userId);
      if (size === "part") {
        for (const part of storedWorkstreamsOf(build.making)) {
          const title = part.name?.trim() || "";
          if (includes(title || (build.title ?? ""), options.query)) found.push({ size, origin, buildId: build.id, buildTitle: build.title ?? "", nodeId: null, partKey: part.key, sessionKey: null, title, makerId: build.creator_id });
        }
      } else {
        for (const [key, meta] of Object.entries(sessionsMetaOf(build.making))) {
          const maker = (meta as { contributor_id?: string | null }).contributor_id ?? build.creator_id;
          const title = (meta as { title?: string }).title?.trim() || "";
          if (includes(title || (build.title ?? ""), options.query)) found.push({ size, origin, buildId: build.id, buildTitle: build.title ?? "", nodeId: null, partKey: null, sessionKey: key, title, makerId: maker });
        }
      }
    }
    pushEarlier(found, past.data, size, options.query);
  }

  // A reply carries only the user's own: drop what the database would refuse, whatever the sources returned.
  const allowed = options.forReply ? found.filter((work) => work.makerId === userId) : found;
  const seen = new Set<string>();
  return allowed
    .filter((work) => {
      const key = [work.size, work.buildId, work.nodeId, work.partKey, work.sessionKey].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, TOTAL);
}

function pushEarlier(found: AttachableWork[], rows: unknown, size: WorkSize, query: string | undefined): void {
  type Row = { build_id: string | null; node_id: string | null; part_key: string | null; session_key: string | null; build: { title: string | null; creator_id: string } | null };
  for (const row of (rows ?? []) as Row[]) {
    if (!row.build_id || !row.build) continue;
    const title = row.build.title ?? "";
    if (!includes(title, query)) continue;
    found.push({ size, origin: "earlier_post", buildId: row.build_id, buildTitle: title, nodeId: row.node_id, partKey: row.part_key, sessionKey: row.session_key, title, makerId: row.build.creator_id });
  }
}
