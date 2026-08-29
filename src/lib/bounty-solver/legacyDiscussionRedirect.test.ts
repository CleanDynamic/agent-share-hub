// Tier 3 — the legacy bounty page still finds its discussion, its read marks,
// its deadline extensions and its private triage notes with the shims gone
// (NS-P50).
//
// WHAT CHANGED UNDERNEATH THIS DATA LAYER, TWICE. Until NS-P47, bounty_id on
// bounty_discussion_comments, bounty_comment_last_read,
// bounty_deadline_extensions and bounty_author_review held the content_items id
// that a legacy bounty page carries in its route, so every query here could
// filter on it directly. NS-P47 moved all four onto public.bounties and kept
// the reads working through a derived legacy_bounty_item_id on each table.
// NS-P50 dropped those four columns: every read resolves the header id first
// and filters bounty_id, which is what the writes have always had to do.
//
// WHAT THIS FILE ASSERTS, AND WHY IT ASSERTS ON THE QUERY. A redirect is
// exactly the kind of change no rendered output can distinguish: a thread that
// filters on the wrong column returns nothing, which looks identical to a
// bounty nobody has commented on. So these tests read the query that was built.
//
// WHY NOT A BROWSER SPEC. The same reason NS-P46 gave: public.bounties answers
// PGRST205 against the project in supabase/config.toml, so no page in that
// database has been repointed and a browser assertion would be about the old
// shape. The browser half lives in e2e/tier3/legacy-bounty-discussion.spec.ts,
// which states its price of entry and skips until the migration is applied. The
// database half — anon reading a thread, a reaction posting, a me-too moving
// both counters, all under RLS — is proven for real in
// supabase/tests/ns-p47-repoint-bounty-satellites.sql, checks 6 and 8.

import { beforeEach, describe, expect, it, vi } from "vitest";

/** One recorded builder call: the method, and what it was given. */
type Op = { method: string; args: unknown[] };
/** One recorded query: the table, and the chain that was built against it. */
type Query = { table: string; ops: Op[] };

const db = vi.hoisted(() => ({
  queries: [] as { table: string; ops: { method: string; args: unknown[] }[] }[],
  next: {} as Record<string, { data: unknown; error: unknown; count?: number }[]>,
  channels: [] as { name: string; config: Record<string, unknown> }[],
}));

vi.mock("@/integrations/supabase/client", () => {
  const chainFor = (table: string) => {
    const query = { table, ops: [] as { method: string; args: unknown[] }[] };
    db.queries.push(query);

    const answer = () => {
      const queued = db.next[table]?.shift();
      return queued ?? { data: [], error: null, count: 0 };
    };

    const chain: Record<string, unknown> = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then") {
            return (resolve: (v: unknown) => unknown) => resolve(answer());
          }
          if (prop === "maybeSingle" || prop === "single") {
            return (...args: unknown[]) => {
              query.ops.push({ method: String(prop), args });
              const res = answer() as { data: unknown; error: unknown };
              const data = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data;
              return Promise.resolve({ data, error: res.error ?? null });
            };
          }
          return (...args: unknown[]) => {
            query.ops.push({ method: String(prop), args });
            return chain;
          };
        },
      },
    );
    return chain;
  };

  return {
    supabase: {
      from: (table: string) => chainFor(table),
      rpc: () => chainFor("__rpc"),
      channel: (name: string) => {
        const rec = { name, config: {} as Record<string, unknown> };
        db.channels.push(rec);
        const ch = {
          on: (_event: string, config: Record<string, unknown>) => {
            rec.config = config;
            return ch;
          },
          subscribe: () => ch,
        };
        return ch;
      },
      removeChannel: () => {},
    },
  };
});

vi.mock("@/lib/notifications/createNotification", () => ({
  createNotification: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/lib/mentions", () => ({ extractMentions: () => [] }));

import { clearBountyResolutionCache } from "@/lib/bounty/resolveLegacy";
import { getBountyAnalytics } from "@/lib/bounty-competition/getBountyAnalytics";
import { extendBountyDeadline } from "@/lib/bounty-competition/extendBountyDeadline";
import { markSolutionReviewStatus } from "@/lib/bounty-competition/markSolutionReviewStatus";
import { getDiscussionThread } from "./getDiscussionThread";
import { markBountyDiscussionRead } from "./markBountyDiscussionRead";
import { postDiscussionComment } from "./postDiscussionComment";

/**
 * The id in the route of a legacy bounty page: a content_items row. This is the
 * only id these callers have, and the whole reason the shim columns exist.
 */
const LEGACY_ITEM_ID = "c0ffee00-0000-4000-8000-000000000001";
/** The public.bounties row NS-P45's backfill wrote for it. */
const BOUNTY_ROW_ID = "b0b0b0b0-0000-4000-8000-000000000001";
const VIEWER_ID = "50fe0000-0000-4000-8000-000000000001";

const COMMENT = {
  id: "cddd0000-0000-4000-8000-000000000001",
  bounty_id: BOUNTY_ROW_ID,
  parent_comment_id: null,
  author_id: VIEWER_ID,
  body: "does this work with streaming?",
  tagged_bounty_author: false,
  created_at: "2026-08-20T09:00:00Z",
  updated_at: "2026-08-20T09:00:00Z",
};

function queriesFor(table: string): Query[] {
  return db.queries.filter((q) => q.table === table);
}
function eqOn(query: Query | undefined, column: string): unknown[] | undefined {
  return query?.ops.find((o) => o.method === "eq" && o.args[0] === column)?.args;
}
function eqColumns(query: Query | undefined): string[] {
  return (query?.ops ?? [])
    .filter((o) => o.method === "eq")
    .map((o) => String(o.args[0]));
}

/** The header row the resolve reads. */
const HEADER = { id: BOUNTY_ROW_ID, legacy_item_id: LEGACY_ITEM_ID };

beforeEach(() => {
  db.queries = [];
  db.next = {};
  db.channels = [];
  // The resolve memoises for the life of the session, which is the point of it
  // and would otherwise leak one test's mapping into the next.
  clearBountyResolutionCache();
});

describe("NS-P50 — the legacy bounty page reads its discussion through bounties", () => {
  it("filters the thread and the read mark on bounty_id, from one resolve", async () => {
    db.next.bounties = [{ data: HEADER, error: null }];
    db.next.bounty_discussion_comments = [{ data: [COMMENT], error: null }];
    db.next.content_items = [{ data: { creator_id: VIEWER_ID }, error: null }];
    db.next.profiles = [{ data: [], error: null }];
    db.next.bounty_comment_reactions = [{ data: [], error: null }];
    db.next.bounty_comment_last_read = [{ data: null, error: null }];
    db.next.solutions = [{ data: [], error: null }];

    const { comments } = await getDiscussionThread({
      bountyId: LEGACY_ITEM_ID,
      viewerId: VIEWER_ID,
    });
    expect(comments).toHaveLength(1);

    // One resolve serves the thread, the read mark and the accepted-solver
    // lookup: three reads, one extra round trip, and only on the first of them.
    expect(queriesFor("bounties")).toHaveLength(1);

    const thread = queriesFor("bounty_discussion_comments")[0];
    expect(eqOn(thread, "bounty_id")).toEqual(["bounty_id", BOUNTY_ROW_ID]);
    // Filtering on the route's id returns nothing at all: a content_items id
    // cannot match a bounties id, so a caller that skipped the resolve renders
    // an empty thread rather than an error.
    expect(eqOn(thread, "bounty_id")).not.toEqual(["bounty_id", LEGACY_ITEM_ID]);
    expect(eqColumns(thread)).not.toContain("legacy_bounty_item_id");

    const readMark = queriesFor("bounty_comment_last_read")[0];
    expect(eqOn(readMark, "bounty_id")).toEqual(["bounty_id", BOUNTY_ROW_ID]);
    expect(eqColumns(readMark)).not.toContain("legacy_bounty_item_id");

    // The accepted-solver lookup named bounty_id all along and was handed the
    // route's id, so it has matched nothing since NS-P46 and every comment has
    // rendered without its "accepted solver" mark. The resolve fixes it.
    const solvers = queriesFor("solutions")[0];
    expect(eqOn(solvers, "bounty_id")).toEqual(["bounty_id", BOUNTY_ROW_ID]);
  });

  it("resolves before it subscribes, because a channel filter cannot join", async () => {
    // A postgres_changes filter is one column comparison evaluated by the
    // replication stream. It cannot join, so the hook has to have the bounties
    // id in hand before it opens the channel — which is why the subscription is
    // asynchronous now and was not before NS-P50.
    db.next.bounties = [{ data: HEADER, error: null }];

    const { useBountyDiscussionUpdates } = await import("./realtime");
    const { renderHook, waitFor } = await import("@testing-library/react");

    renderHook(() => useBountyDiscussionUpdates(LEGACY_ITEM_ID, () => {}));

    await waitFor(() => expect(db.channels).toHaveLength(1));
    expect(db.channels[0].config).toMatchObject({
      table: "bounty_discussion_comments",
      filter: `bounty_id=eq.${BOUNTY_ROW_ID}`,
    });
    // The route's id in that filter would match nothing: the column holds a
    // bounties id and the thread would simply stop updating live.
    expect(db.channels[0].config.filter).not.toContain(LEGACY_ITEM_ID);
  });

  it("posts a comment against the bounties row, not the content item", async () => {
    db.next.bounties = [{ data: HEADER, error: null }];
    db.next.bounty_discussion_comments = [{ data: COMMENT, error: null }];

    await postDiscussionComment({
      bountyId: LEGACY_ITEM_ID,
      body: "does this work with streaming?",
      authorId: VIEWER_ID,
    });

    // The header is found by the mapping NS-P45 wrote.
    expect(eqOn(queriesFor("bounties")[0], "legacy_item_id")).toEqual([
      "legacy_item_id",
      LEGACY_ITEM_ID,
    ]);

    // And the row written names the bounty, not the content item. Writing the
    // content_items id here would now be rejected by the foreign key — this
    // asserts the client sends the right thing rather than relying on the
    // database to reject the wrong one.
    const insert = queriesFor("bounty_discussion_comments")[0].ops.find(
      (o) => o.method === "insert",
    );
    expect(insert?.args[0]).toMatchObject({ bounty_id: BOUNTY_ROW_ID });
    expect(insert?.args[0]).not.toMatchObject({ bounty_id: LEGACY_ITEM_ID });
    // The column NS-P50 dropped must not reappear in a write.
    expect(insert?.args[0]).not.toHaveProperty("legacy_bounty_item_id");
  });

  it("marks the thread read on the repointed primary key", async () => {
    db.next.bounties = [{ data: HEADER, error: null }];

    await markBountyDiscussionRead({ bountyId: LEGACY_ITEM_ID, userId: VIEWER_ID });

    const upsert = queriesFor("bounty_comment_last_read")[0].ops.find(
      (o) => o.method === "upsert",
    );
    // The primary key is (bounty_id, user_id), so both the row and the conflict
    // target have to carry the resolved id.
    expect(upsert?.args[0]).toMatchObject({ bounty_id: BOUNTY_ROW_ID, user_id: VIEWER_ID });
    expect(upsert?.args[1]).toMatchObject({ onConflict: "bounty_id,user_id" });
  });

  it("refuses to write against a bounty that has no header", async () => {
    // The NS-P45 backfill wrote one header per legacy bounty, so this cannot
    // happen for anything published before it. A silent no-op here would lose
    // the reader's comment.
    db.next.bounties = [{ data: null, error: null }];

    await expect(
      postDiscussionComment({ bountyId: LEGACY_ITEM_ID, body: "hi", authorId: VIEWER_ID }),
    ).rejects.toThrow(/no bounties record/);
  });
});

describe("NS-P50 — the author's own surfaces read and write through bounties", () => {
  it("reads analytics for comments, extensions and triage on bounty_id", async () => {
    db.next.bounties = [{ data: HEADER, error: null }];
    db.next.content_items = [
      { data: { id: LEGACY_ITEM_ID, creator_id: VIEWER_ID }, error: null },
    ];
    db.next.solutions = [{ data: [], error: null }];
    db.next.bounty_discussion_comments = [{ data: [], error: null }];
    db.next.bounty_deadline_extensions = [{ data: [], error: null }];
    db.next.bounty_author_review = [{ data: [], error: null }];

    await getBountyAnalytics(LEGACY_ITEM_ID, VIEWER_ID);

    // Four tables, four reads, one resolve between them.
    expect(queriesFor("bounties")).toHaveLength(1);
    for (const table of [
      "solutions",
      "bounty_discussion_comments",
      "bounty_deadline_extensions",
      "bounty_author_review",
    ]) {
      const q = queriesFor(table)[0];
      expect(eqOn(q, "bounty_id")).toEqual(["bounty_id", BOUNTY_ROW_ID]);
      expect(eqColumns(q)).not.toContain("legacy_bounty_item_id");
    }
  });

  it("writes a deadline extension against the bounties row", async () => {
    db.next.content_items = [
      { data: { id: LEGACY_ITEM_ID, creator_id: VIEWER_ID, bounty_deadline: null }, error: null },
    ];
    db.next.bounties = [{ data: HEADER, error: null }];

    await extendBountyDeadline({
      bountyId: LEGACY_ITEM_ID,
      extenderUserId: VIEWER_ID,
      newDeadline: "2026-12-01T00:00:00Z",
    });

    const insert = queriesFor("bounty_deadline_extensions")[0].ops.find(
      (o) => o.method === "insert",
    );
    expect(insert?.args[0]).toMatchObject({ bounty_id: BOUNTY_ROW_ID });
    expect(insert?.args[0]).not.toMatchObject({ bounty_id: LEGACY_ITEM_ID });
  });

  it("writes a triage note against the bounties row, keeping its own conflict target", async () => {
    db.next.bounties = [{ data: HEADER, error: null }];

    await markSolutionReviewStatus({
      bountyId: LEGACY_ITEM_ID,
      solutionId: "50100000-0000-4000-8000-000000000001",
      authorId: VIEWER_ID,
      status: "shortlisted",
    });

    const upsert = queriesFor("bounty_author_review")[0].ops.find((o) => o.method === "upsert");
    expect(upsert?.args[0]).toMatchObject({ bounty_id: BOUNTY_ROW_ID });
    // The unique key is (solution_id, author_id); neither NS-P47 nor NS-P50
    // moves it.
    expect(upsert?.args[1]).toMatchObject({ onConflict: "solution_id,author_id" });
  });
});
