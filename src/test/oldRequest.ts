/* UX-11: one old-style request, inserted straight into a table store, the way the rows were written before requests closed.

   Nothing in the app can file a request any more, so a test that needs one cannot ask the app for it. This is the only place a
   request row is made: a `bounties` row (with the build and the gap node it hangs on) and the `content_items` row an older
   bounty page reads. The shapes are the columns the generated types list, nothing newer (no `problem`, `from_run_id` or
   `target_key`: those arrived with the requests that came from runs and sessions, which are not "old-style").

   `insertOldRequest` takes a `Record<table, rows[]>`, the shape the page audit's backend seeds (`startAuditBackend({ seed })`) and
   the hand-made mocks use, and pushes the rows in directly. Test only. */

export type OldRow = Record<string, unknown>;

export const OLD_REQUEST = {
  buildId: "b111d000-0000-4000-8000-000000000001",
  authorId: "c9ea1000-0000-4000-8000-000000000001",
  gapNodeId: "9a900000-0000-4000-8000-000000000001",
  bountyId: "b0b0b0b0-0000-4000-8000-000000000001",
  contentItemId: "c0ffee00-0000-4000-8000-000000000001",
  title: "The retry prompt keeps timing out",
  buildTitle: "Inbox triage agent",
} as const;

export interface OldRequestOptions {
  /** The status the request was left in. */
  status?: "open" | "closed" | "solved";
  rewardGbp?: number | null;
  /** The request's page as an older bounty: a `content_items` row with post_type "bounty". */
  withContentItem?: boolean;
}

export function oldRequestRows({ status = "open", rewardGbp = 50, withContentItem = true }: OldRequestOptions = {}): Record<string, OldRow[]> {
  const solved = status === "solved";
  const rows: Record<string, OldRow[]> = {
    builds: [{ id: OLD_REQUEST.buildId, title: OLD_REQUEST.buildTitle, slug: "inbox-triage-agent", creator_id: OLD_REQUEST.authorId, status: "published" }],
    build_nodes: [{ id: OLD_REQUEST.gapNodeId, build_id: OLD_REQUEST.buildId, type: "prompt", is_gap: true, title: "The retry prompt", payload: { gap_problem: OLD_REQUEST.title } }],
    bounties: [
      {
        id: OLD_REQUEST.bountyId,
        build_id: OLD_REQUEST.buildId,
        gap_node_id: OLD_REQUEST.gapNodeId,
        legacy_item_id: withContentItem ? OLD_REQUEST.contentItemId : null,
        author_id: OLD_REQUEST.authorId,
        status,
        reward_gbp: rewardGbp,
        closes_at: null,
        is_meta: false,
        meta_parent_id: null,
        accepted_solution_id: solved ? "50100000-0000-4000-8000-000000000001" : null,
        me_too_count: 0,
        created_at: "2026-08-28T09:00:00Z",
        solved_at: solved ? "2026-09-02T09:00:00Z" : null,
      },
    ],
  };
  if (withContentItem) {
    rows.content_items = [
      {
        id: OLD_REQUEST.contentItemId,
        slug: "the-retry-prompt-keeps-timing-out",
        post_type: "bounty",
        title: OLD_REQUEST.title,
        description: "The retry prompt gives up after two attempts and the inbox stays unsorted.",
        creator_id: OLD_REQUEST.authorId,
        status: "approved",
        visibility: "public",
        bounty_status: status,
        bounty_solved_at: solved ? "2026-09-02T09:00:00Z" : null,
        bounty_reward: rewardGbp,
        created_at: "2026-08-28T09:00:00Z",
        published_at: "2026-08-28T09:00:00Z",
      },
    ];
  }
  return rows;
}

/** Insert an old-style request into `tables` directly, and say where its rows are. */
export function insertOldRequest(tables: Record<string, OldRow[]>, options?: OldRequestOptions) {
  const made = oldRequestRows(options);
  for (const [table, rows] of Object.entries(made)) (tables[table] ??= []).push(...rows);
  return { bounty: made.bounties[0], build: made.builds[0], gapNode: made.build_nodes[0], contentItem: made.content_items?.[0] ?? null };
}
