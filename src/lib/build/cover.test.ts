// Acceptance cover for the cover resolution chain (NS-P27).
//
// The claim this file has to prove is a TOTALITY claim: every build produces a
// card image if one exists anywhere on it, and the one build that produces
// nothing is the one that genuinely has nothing. So each of the four links is
// asserted twice over — once in isolation, and once with the link before it
// removed, which is the only way to show that a fallback is reached rather than
// merely reachable.
//
// resolveCover queries nothing, so nothing here is stubbed for it. setCover is
// the only call that touches the database, and it is asserted on the patch it
// hands updateBuild rather than on a fake PostgREST response — the write is one
// column and the interesting part is which column.

import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock is hoisted above every const, so the double has to be too.
const { updateBuild } = vi.hoisted(() => ({ updateBuild: vi.fn() }));
vi.mock("@/lib/build/builds", () => ({ updateBuild }));

import {
  EVIDENCE_NODE_TYPES,
  nodeMediaId,
  resolveCover,
  setCover,
  type CoverSource,
} from "@/lib/build/cover";
import type { BuildMedia, Json, NodeTree } from "@/lib/build";

const BUILD_ID = "b0000000-0000-4000-8000-000000000000";

// --- fixtures ----------------------------------------------------------------

function media(id: string, overrides: Partial<BuildMedia> = {}): BuildMedia {
  return {
    id,
    build_id: BUILD_ID,
    node_id: null,
    bucket: "build-media",
    path: `${BUILD_ID}/unplaced/${id}.png`,
    kind: "image",
    mime: "image/png",
    bytes: 1024,
    width: 1200,
    height: 800,
    duration: null,
    poster_path: null,
    // post_position is deliberately absent: a row that is not in the post has
    // no position, and several cases below turn on undefined reading as "no
    // set" rather than as position 0. post_text IS present as null, because
    // postEntriesOf distinguishes "this entry has no words" (null) from a
    // caller that never selected the column.
    post_text: null,
    caption: null,
    filename: null,
    metadata: null,
    created_at: "2026-08-27T00:00:00.000Z",
    ...overrides,
  } as BuildMedia;
}

function node(
  id: string,
  type: string,
  overrides: Partial<NodeTree> = {}
): NodeTree {
  return {
    id,
    build_id: BUILD_ID,
    parent_id: null,
    position: 0,
    type,
    title: null,
    note: null,
    payload: {} as Json,
    source_ref: null,
    event_id: null,
    is_gap: false,
    created_at: "2026-08-27T00:00:00.000Z",
    children: [],
    ...overrides,
  } as NodeTree;
}

function header(overrides: Partial<CoverSource> = {}): CoverSource {
  return { cover_media_id: null, hero_node_id: null, ...overrides };
}

// --- the chain ---------------------------------------------------------------

describe("resolveCover: link 1, the creator's explicit choice", () => {
  it("returns the row cover_media_id names", () => {
    const rows = [media("m-hero"), media("m-cover")];
    const tree = [node("n-hero", "screenshot", { payload: { media_id: "m-hero" } as Json })];

    const found = resolveCover(
      header({ cover_media_id: "m-cover", hero_node_id: "n-hero" }),
      tree,
      rows
    );

    expect(found?.id).toBe("m-cover");
  });

  it("outranks the hero and the evidence, which are both present here", () => {
    // The point of the column: a creator who wants a different picture on the
    // card than in the hero slot has said so, and nothing overrides that.
    const rows = [media("m-cover"), media("m-evidence", { node_id: "n-shot" })];
    const tree = [
      node("n-hero", "live_app", { payload: { media_id: "m-cover" } as Json }),
      node("n-shot", "screenshot", { position: 1 }),
    ];

    expect(
      resolveCover(header({ cover_media_id: "m-cover", hero_node_id: "n-hero" }), tree, rows)?.id
    ).toBe("m-cover");
  });

  it("falls through rather than blanking when its row has been deleted", () => {
    // The FK is ON DELETE SET NULL, so the database clears this itself — but a
    // caller can hold a build row read before the delete landed, and a card
    // that renders nothing because of a race is worse than the next-best thing.
    const rows = [media("m-hero")];
    const tree = [node("n-hero", "screenshot", { payload: { media_id: "m-hero" } as Json })];

    expect(
      resolveCover(header({ cover_media_id: "m-gone", hero_node_id: "n-hero" }), tree, rows)?.id
    ).toBe("m-hero");
  });
});

describe("resolveCover: link 2, the hero node's media", () => {
  it("resolves the hero through its payload media_id when there is no cover", () => {
    const rows = [media("m-hero")];
    const tree = [node("n-hero", "screenshot", { payload: { media_id: "m-hero" } as Json })];

    expect(resolveCover(header({ hero_node_id: "n-hero" }), tree, rows)?.id).toBe("m-hero");
  });

  it("takes a generated_media hero's CHOSEN variant, not its first", () => {
    const rows = [media("m-first"), media("m-chosen")];
    const tree = [
      node("n-hero", "generated_media", {
        payload: {
          variants: [
            { media_id: "m-first" },
            { media_id: "m-chosen", chosen: true },
          ],
        } as Json,
      }),
    ];

    expect(resolveCover(header({ hero_node_id: "n-hero" }), tree, rows)?.id).toBe("m-chosen");
  });

  it("finds a hero nested below the top level", () => {
    const rows = [media("m-hero")];
    const tree = [
      node("n-step", "prompt", {
        children: [node("n-hero", "screenshot", { payload: { media_id: "m-hero" } as Json })],
      }),
    ];

    expect(resolveCover(header({ hero_node_id: "n-hero" }), tree, rows)?.id).toBe("m-hero");
  });

  it("outranks the evidence below it", () => {
    const rows = [media("m-hero"), media("m-evidence", { node_id: "n-shot" })];
    const tree = [
      node("n-hero", "result", { payload: { media_id: "m-hero" } as Json }),
      node("n-shot", "screenshot", { position: 1 }),
    ];

    expect(resolveCover(header({ hero_node_id: "n-hero" }), tree, rows)?.id).toBe("m-hero");
  });

  it("falls through when the hero is a live_app, which carries no media", () => {
    // The whole reason this column exists: hero_node_id names a node, and not
    // every node type is a picture.
    const rows = [media("m-evidence", { node_id: "n-shot" })];
    const tree = [
      node("n-hero", "live_app", { payload: { live_url: "https://example.com" } as Json }),
      node("n-shot", "screenshot", { position: 1 }),
    ];

    expect(resolveCover(header({ hero_node_id: "n-hero" }), tree, rows)?.id).toBe("m-evidence");
  });

  it("falls through when hero_node_id points outside the tree", () => {
    // A hero left in the tray, or deleted. indexTree in BuildPage never sees
    // those either, so this agrees with what a reader is shown.
    const rows = [media("m-evidence", { node_id: "n-shot" })];
    const tree = [node("n-shot", "screenshot")];

    expect(resolveCover(header({ hero_node_id: "n-gone" }), tree, rows)?.id).toBe("m-evidence");
  });
});

describe("resolveCover: link 3, the first evidence node's media", () => {
  it("returns a row attached to an evidence node by node_id", () => {
    const rows = [media("m-evidence", { node_id: "n-shot" })];
    const tree = [node("n-shot", "screenshot")];

    expect(resolveCover(header(), tree, rows)?.id).toBe("m-evidence");
  });

  it("takes TREE order, not the media list's order", () => {
    // The creator arranged the tree. That arrangement is the preference, and a
    // resolver that read the media list's order would be reading upload time.
    const rows = [media("m-second", { node_id: "n-second" }), media("m-first", { node_id: "n-first" })];
    const tree = [
      node("n-first", "screenshot", { position: 0 }),
      node("n-second", "result", { position: 1 }),
    ];

    expect(resolveCover(header(), tree, rows)?.id).toBe("m-first");
  });

  it("takes TREE order across nesting, not the top level first", () => {
    // Depth first IS reading order: a screenshot under step one comes before
    // step two on the page, so it comes before it here.
    const rows = [media("m-nested", { node_id: "n-nested" }), media("m-later", { node_id: "n-later" })];
    const tree = [
      node("n-step", "prompt", {
        position: 0,
        children: [node("n-nested", "screenshot")],
      }),
      node("n-later", "result", { position: 1 }),
    ];

    expect(resolveCover(header(), tree, rows)?.id).toBe("m-nested");
  });

  it("reads an evidence node's payload reference when nothing is attached", () => {
    // Both attachment paths exist in the record, and cardMedia.evidenceMedia
    // reads them in this order. A cover that disagreed with the card the
    // gallery renders would be a bug the moment a compose preview showed it.
    const rows = [media("m-referenced")];
    const tree = [node("n-shot", "screenshot", { payload: { media_id: "m-referenced" } as Json })];

    expect(resolveCover(header(), tree, rows)?.id).toBe("m-referenced");
  });

  it("ignores non-evidence nodes carrying media", () => {
    // A prompt's attached file or a dataset's CSV is not what a card leads on.
    const rows = [media("m-doc", { node_id: "n-doc" }), media("m-shot", { node_id: "n-shot" })];
    const tree = [
      node("n-doc", "document", { position: 0 }),
      node("n-shot", "screenshot", { position: 1 }),
    ];

    expect(resolveCover(header(), tree, rows)?.id).toBe("m-shot");
  });

  it("never leads with a gap, even one carrying media", () => {
    // A gap is the creator saying "this part is missing". Putting it on the
    // card shows an admitted hole as if it were the work.
    const rows = [media("m-gap", { node_id: "n-gap" }), media("m-real", { node_id: "n-real" })];
    const tree = [
      node("n-gap", "screenshot", { position: 0, is_gap: true }),
      node("n-real", "result", { position: 1 }),
    ];

    expect(resolveCover(header(), tree, rows)?.id).toBe("m-real");
  });

  it("covers every type in the registry's evidence category", () => {
    // A type added to node_types.category = 'evidence' and not to
    // EVIDENCE_NODE_TYPES costs that build its automatic cover, silently.
    for (const type of EVIDENCE_NODE_TYPES) {
      const rows = [media("m-x", { node_id: "n-x" })];
      const tree = [node("n-x", type)];
      expect(resolveCover(header(), tree, rows)?.id, type).toBe("m-x");
    }
  });

  it("is the five types node_types seeds as evidence, and no others", () => {
    expect([...EVIDENCE_NODE_TYPES].sort()).toEqual([
      "comparison_table",
      "eval_run",
      "recording",
      "result",
      "screenshot",
    ]);
  });
});

describe("resolveCover: link 4, nothing", () => {
  it("returns null for a build with no cover, no hero and no evidence", () => {
    const tree = [node("n-prompt", "prompt", { payload: { text: "do the thing" } as Json })];
    expect(resolveCover(header(), tree, [media("m-orphan")])).toBeNull();
  });

  it("returns null for an empty record", () => {
    expect(resolveCover(header(), [], [])).toBeNull();
  });

  it("returns null rather than throwing on a missing build", () => {
    // A card body renders while its query is still in flight.
    expect(resolveCover(null, [], [])).toBeNull();
    expect(resolveCover(undefined, [], [])).toBeNull();
  });

  it("returns null when the only evidence node carries no media at all", () => {
    const tree = [node("n-shot", "screenshot")];
    expect(resolveCover(header(), tree, [])).toBeNull();
  });
});

// --- the payload reader ------------------------------------------------------

describe("nodeMediaId, extracted from the build page unchanged", () => {
  it("reads media_id, trimming it", () => {
    expect(nodeMediaId(node("n", "screenshot", { payload: { media_id: "  m-1  " } as Json }))).toBe("m-1");
  });

  it("prefers the chosen variant, and falls back to the first", () => {
    const chosen = node("n", "generated_media", {
      payload: { variants: [{ media_id: "a" }, { media_id: "b", chosen: true }] } as Json,
    });
    const unchosen = node("n", "generated_media", {
      payload: { variants: [{ media_id: "a" }, { media_id: "b" }] } as Json,
    });

    expect(nodeMediaId(chosen)).toBe("b");
    expect(nodeMediaId(unchosen)).toBe("a");
  });

  it("answers null for an absent node, an empty payload and a blank id", () => {
    expect(nodeMediaId(null)).toBeNull();
    expect(nodeMediaId(undefined)).toBeNull();
    expect(nodeMediaId(node("n", "prompt"))).toBeNull();
    expect(nodeMediaId(node("n", "screenshot", { payload: { media_id: "   " } as Json }))).toBeNull();
  });
});

// --- the write ---------------------------------------------------------------

describe("setCover", () => {
  beforeEach(() => {
    updateBuild.mockReset();
    updateBuild.mockResolvedValue({ id: BUILD_ID, cover_media_id: null });
  });

  it("patches cover_media_id and nothing else", async () => {
    await setCover(BUILD_ID, "m-1");

    expect(updateBuild).toHaveBeenCalledTimes(1);
    const [id, patch] = updateBuild.mock.calls[0];
    expect(id).toBe(BUILD_ID);
    expect(patch).toEqual({ cover_media_id: "m-1" });
  });

  it("clears the cover with null, which is a value and not an omission", async () => {
    // Clearing is how a creator says "go back to whatever the chain picks".
    // A patch that omitted the key would leave the old cover in place.
    await setCover(BUILD_ID, null);

    const [, patch] = updateBuild.mock.calls[0];
    expect(patch).toEqual({ cover_media_id: null });
    expect(Object.keys(patch as object)).toEqual(["cover_media_id"]);
  });

  it("returns the row updateBuild answers with", async () => {
    updateBuild.mockResolvedValue({ id: BUILD_ID, cover_media_id: "m-1" });
    await expect(setCover(BUILD_ID, "m-1")).resolves.toEqual({
      id: BUILD_ID,
      cover_media_id: "m-1",
    });
  });
});

// =============================================================================
// The post's ordered cover set (BG-P07b)
// =============================================================================
// WHAT IS PROVED HERE AND WHAT IS PROVED IN POSTGRES — read this before adding
// a case, because putting one in the wrong file makes it worthless.
//
// A vitest double cannot prove a CHECK, a partial unique index, a trigger or a
// policy. Asserting that "setting position 0 updates cover_media_id" against a
// fake that implements the mirror itself would only prove the fake, which is
// the most expensive kind of passing test. So the mirror, the constraints, the
// gap-closing at the row level and the RLS refusal are asserted against a real
// database by supabase/tests/bg-p07b-post-media.sql — nine checks, run and
// passing against a PostgreSQL 16.13 head-state built from this repository's
// own migrations, and confirmed to FAIL on check 1 before the migration.
//
// What belongs here is everything that is a fact about TypeScript: the pure
// maths of aspectOf, resolveCover's ordering, and — for each accessor — the
// exact call the data layer makes, which is the half of the mirror contract
// this side owns. setPostMedia sending the array in the creator's order IS
// "position 0 is the first entry"; the trigger turns that into cover_media_id.

const rpcState = vi.hoisted(() => ({
  calls: [] as Array<{ method: string; args: unknown[] }>,
  response: { data: [] as unknown, error: null as unknown },
  // Responses for calls that run more than one query. setPostMediaText reads
  // the set and then writes one row, and those two want different answers; an
  // empty queue falls back to `response`, so every single-query case is
  // unaffected.
  queue: [] as unknown[],
}));

vi.mock("@/integrations/supabase/client", () => {
  const chain: Record<string, unknown> = {};
  for (const method of ["from", "select", "eq", "not", "order", "limit", "rpc", "update", "single"]) {
    chain[method] = (...args: unknown[]) => {
      rpcState.calls.push({ method, args });
      return chain;
    };
  }
  // PostgREST builders are thenable, not promises; awaiting one runs the query.
  chain.then = (resolve: (value: unknown) => unknown) =>
    resolve(rpcState.queue.length > 0 ? rpcState.queue.shift() : rpcState.response);
  return { supabase: chain };
});

import {
  ASPECT_CAP_MAX,
  ASPECT_CAP_MIN,
  ASSUMED_ASPECT,
  MAX_POST_MEDIA,
  POST_MEDIA_COLUMNS,
  POST_TEXT_MAX,
  PostMediaError,
  addPostMedia,
  aspectOf,
  getPostMedia,
  postEntriesOf,
  removePostMedia,
  setPostMedia,
  setPostMediaText,
} from "@/lib/build/cover";

/** The args of the first call to `method`, or undefined if it was never made. */
function argsOf(method: string): unknown[] | undefined {
  return rpcState.calls.find((call) => call.method === method)?.args;
}

/** Every call to `method`, in order. */
function allArgsOf(method: string): unknown[][] {
  return rpcState.calls.filter((call) => call.method === method).map((call) => call.args);
}

function resetSupabase(data: unknown = [], error: unknown = null) {
  rpcState.calls.length = 0;
  rpcState.queue.length = 0;
  rpcState.response = { data, error };
}

/** Answer each query of a multi-query call in turn. Clears any earlier queue. */
function queueSupabase(...responses: Array<{ data: unknown; error?: unknown }>) {
  rpcState.calls.length = 0;
  rpcState.queue.length = 0;
  rpcState.queue.push(...responses.map((r) => ({ data: r.data, error: r.error ?? null })));
}

/** A row as the set returns it: media() plus a position. */
function placed(id: string, position: number, overrides: Partial<BuildMedia> = {}) {
  return media(id, { post_position: position, ...overrides });
}

// --- resolveCover, with the set in front of it -------------------------------

describe("resolveCover: link 0, the post's set", () => {
  it("prefers the position-0 row over everything below it", () => {
    const rows = [
      media("m-cover"),
      placed("m-first", 0),
      placed("m-second", 1),
    ];
    const tree = [node("n-hero", "screenshot", { payload: { media_id: "m-hero" } as Json })];

    expect(
      resolveCover(header({ cover_media_id: "m-cover", hero_node_id: "n-hero" }), tree, rows)?.id
    ).toBe("m-first");
  });

  it("takes position 0 specifically, not merely the first row carrying a position", () => {
    // The list arrives ordered by the query, but a caller that concatenated two
    // pages, or held rows from a stale read, could hand them over in any order.
    const rows = [placed("m-third", 2), placed("m-second", 1), placed("m-first", 0)];
    expect(resolveCover(header(), [], rows)?.id).toBe("m-first");
  });

  it("falls back to the existing chain when the set is EMPTY", () => {
    // The whole reason nothing on the running site moves: no build has a set
    // yet, so every card resolves exactly as it did before this prompt.
    const rows = [media("m-cover"), media("m-evidence", { node_id: "n-shot" })];
    const tree = [node("n-shot", "screenshot")];

    expect(resolveCover(header({ cover_media_id: "m-cover" }), tree, rows)?.id).toBe("m-cover");
    expect(resolveCover(header(), tree, rows)?.id).toBe("m-evidence");
  });

  it("falls back when the caller did not SELECT post_position at all", () => {
    // The gallery's embed does not name the column, so its rows carry
    // undefined. Undefined must read as "no set", never as position 0 — the
    // former falls through, the latter would put an arbitrary row on the card.
    const rows = [
      { id: "m-a", node_id: null },
      { id: "m-cover", node_id: null },
    ];

    expect(resolveCover(header({ cover_media_id: "m-cover" }), [], rows)?.id).toBe("m-cover");
  });

  it("still returns null for a build with no set, no cover, no hero and no evidence", () => {
    expect(resolveCover(header(), [node("n-prompt", "prompt")], [media("m-orphan")])).toBeNull();
  });
});

// --- the accessors -----------------------------------------------------------

describe("getPostMedia", () => {
  beforeEach(() => resetSupabase([]));

  it("asks for the set by position, named columns, capped at four", async () => {
    await getPostMedia(BUILD_ID);

    expect(argsOf("from")).toEqual(["build_media"]);
    expect(argsOf("select")).toEqual([POST_MEDIA_COLUMNS]);
    expect(argsOf("eq")).toEqual(["build_id", BUILD_ID]);
    expect(argsOf("not")).toEqual(["post_position", "is", null]);
    expect(argsOf("order")).toEqual(["post_position", { ascending: true }]);
    expect(argsOf("limit")).toEqual([MAX_POST_MEDIA]);
  });

  it("names post_position on top of the media module's own column list", () => {
    // Built from MEDIA_COLUMNS rather than restated, so a column added there
    // cannot go missing here. And never `*` — see the review rules.
    expect(POST_MEDIA_COLUMNS).toContain("post_position");
    expect(POST_MEDIA_COLUMNS).toContain("width");
    expect(POST_MEDIA_COLUMNS).toContain("height");
    expect(POST_MEDIA_COLUMNS).not.toContain("*");
  });

  it("answers an empty set with an empty array, which is the normal case", async () => {
    resetSupabase(null);
    await expect(getPostMedia(BUILD_ID)).resolves.toEqual([]);
  });

  it("throws through buildLayerError when the query fails", async () => {
    resetSupabase(null, { message: "boom" });
    await expect(getPostMedia(BUILD_ID)).rejects.toThrow("getPostMedia failed: boom");
  });
});

describe("setPostMedia", () => {
  beforeEach(() => resetSupabase([]));

  it("sends the whole set in ONE call, in the creator's order", async () => {
    await setPostMedia(BUILD_ID, ["m-a", "m-b", "m-c"]);

    expect(allArgsOf("rpc")).toHaveLength(1);
    expect(argsOf("rpc")).toEqual([
      "set_build_post_media",
      { p_build_id: BUILD_ID, p_media_ids: ["m-a", "m-b", "m-c"] },
    ]);
  });

  it("puts the intended cover FIRST, which is the mirror's half of the contract", async () => {
    // The trigger turns "first entry" into builds.cover_media_id. Proving the
    // trigger is supabase/tests/bg-p07b-post-media.sql check 3; proving the
    // array reaches it in the right order is this side's job.
    await setPostMedia(BUILD_ID, ["m-cover", "m-b"]);

    const [, args] = argsOf("rpc") as [string, { p_media_ids: string[] }];
    expect(args.p_media_ids[0]).toBe("m-cover");
  });

  it("clears the set — and with it the mirror — by sending an empty array", async () => {
    await setPostMedia(BUILD_ID, []);

    const [, args] = argsOf("rpc") as [string, { p_media_ids: string[] }];
    expect(args.p_media_ids).toEqual([]);
  });

  it("rejects a FIFTH before it reaches the wire, with a named error", async () => {
    await expect(
      setPostMedia(BUILD_ID, ["m-a", "m-b", "m-c", "m-d", "m-e"])
    ).rejects.toBeInstanceOf(PostMediaError);

    await expect(
      setPostMedia(BUILD_ID, ["m-a", "m-b", "m-c", "m-d", "m-e"])
    ).rejects.toMatchObject({ name: "PostMediaError", code: "too_many" });

    expect(allArgsOf("rpc")).toHaveLength(0);
  });

  it("accepts exactly four, so the limit is four and not three", async () => {
    await expect(
      setPostMedia(BUILD_ID, ["m-a", "m-b", "m-c", "m-d"])
    ).resolves.toEqual([]);
    expect(allArgsOf("rpc")).toHaveLength(1);
  });

  it("rejects the same media twice, which would claim one slot twice", async () => {
    await expect(setPostMedia(BUILD_ID, ["m-a", "m-a"])).rejects.toMatchObject({
      code: "duplicate",
    });
    expect(allArgsOf("rpc")).toHaveLength(0);
  });

  it("names the columns it reads back rather than taking the function's row type", async () => {
    await setPostMedia(BUILD_ID, ["m-a"]);
    expect(argsOf("select")).toEqual([POST_MEDIA_COLUMNS]);
    expect(argsOf("limit")).toEqual([MAX_POST_MEDIA]);
  });

  it("does not mutate the array it was handed", async () => {
    const ids = ["m-a", "m-b"];
    await setPostMedia(BUILD_ID, ids);
    expect(ids).toEqual(["m-a", "m-b"]);
  });

  it("throws through buildLayerError when the database refuses", async () => {
    resetSupabase(null, { message: "post_media_not_on_build: 1 of 1" });
    await expect(setPostMedia(BUILD_ID, ["m-x"])).rejects.toThrow(
      "setPostMedia failed: post_media_not_on_build: 1 of 1"
    );
  });
});

describe("addPostMedia", () => {
  it("appends at the end of the current order", async () => {
    resetSupabase([placed("m-a", 0), placed("m-b", 1)]);
    await addPostMedia(BUILD_ID, "m-c");

    const [, args] = argsOf("rpc") as [string, { p_media_ids: string[] }];
    expect(args.p_media_ids).toEqual(["m-a", "m-b", "m-c"]);
  });

  it("appends into slot 0 on a build with no set, which sets the cover", async () => {
    resetSupabase([]);
    await addPostMedia(BUILD_ID, "m-first");

    const [, args] = argsOf("rpc") as [string, { p_media_ids: string[] }];
    expect(args.p_media_ids).toEqual(["m-first"]);
  });

  it("refuses a fifth with the FULL code, which reads differently to too_many", async () => {
    // The composer shows this next to a disabled button; too_many is a bug in
    // the caller. Discriminating on a message string is how that rots.
    resetSupabase([placed("m-a", 0), placed("m-b", 1), placed("m-c", 2), placed("m-d", 3)]);

    await expect(addPostMedia(BUILD_ID, "m-e")).rejects.toMatchObject({
      name: "PostMediaError",
      code: "full",
    });
    expect(allArgsOf("rpc")).toHaveLength(0);
  });

  it("is a no-op for a picture already in the set", async () => {
    resetSupabase([placed("m-a", 0), placed("m-b", 1)]);
    const result = await addPostMedia(BUILD_ID, "m-b");

    expect(allArgsOf("rpc")).toHaveLength(0);
    expect(result.map((row) => row.id)).toEqual(["m-a", "m-b"]);
  });
});

describe("removePostMedia", () => {
  it("CLOSES THE GAP when the middle one goes", async () => {
    resetSupabase([placed("m-a", 0), placed("m-b", 1), placed("m-c", 2)]);
    await removePostMedia(BUILD_ID, "m-b");

    // Positions come from array index, so the survivors land on 0 and 1 — there
    // is no way to express a hole through this call.
    const [, args] = argsOf("rpc") as [string, { p_media_ids: string[] }];
    expect(args.p_media_ids).toEqual(["m-a", "m-c"]);
  });

  it("promotes the second picture when the FIRST goes, moving the cover with it", async () => {
    resetSupabase([placed("m-a", 0), placed("m-b", 1)]);
    await removePostMedia(BUILD_ID, "m-a");

    const [, args] = argsOf("rpc") as [string, { p_media_ids: string[] }];
    expect(args.p_media_ids).toEqual(["m-b"]);
  });

  it("empties the set when the last one goes", async () => {
    resetSupabase([placed("m-only", 0)]);
    await removePostMedia(BUILD_ID, "m-only");

    const [, args] = argsOf("rpc") as [string, { p_media_ids: string[] }];
    expect(args.p_media_ids).toEqual([]);
  });

  it("is a no-op for a picture that was never in the set", async () => {
    // A double click, or a retried request. The second attempt should leave the
    // set where the caller wanted it rather than failing.
    resetSupabase([placed("m-a", 0)]);
    const result = await removePostMedia(BUILD_ID, "m-gone");

    expect(allArgsOf("rpc")).toHaveLength(0);
    expect(result.map((row) => row.id)).toEqual(["m-a"]);
  });
});

// --- the aspect maths --------------------------------------------------------

describe("aspectOf", () => {
  it("caps a 5:1 panorama to 2.0 and says it cropped", () => {
    expect(aspectOf({ width: 5000, height: 1000 })).toEqual({
      ratio: 5,
      capped: ASPECT_CAP_MAX,
      cropped: true,
    });
  });

  it("caps a 1:3 tall shot to 0.75 and says it cropped", () => {
    const { ratio, capped, cropped } = aspectOf({ width: 1000, height: 3000 });
    expect(ratio).toBeCloseTo(1 / 3, 10);
    expect(capped).toBe(ASPECT_CAP_MIN);
    expect(cropped).toBe(true);
  });

  it("passes a 16:9 through untouched", () => {
    const { ratio, capped, cropped } = aspectOf({ width: 1920, height: 1080 });
    expect(ratio).toBeCloseTo(16 / 9, 10);
    expect(capped).toBe(ratio);
    expect(cropped).toBe(false);
  });

  it("survives a row with null dimensions by assuming landscape", () => {
    // probeFile in media.ts is tolerant by design — a decoder that is absent
    // leaves both columns null rather than costing the creator their upload.
    // A card that threw on one of those rows would take the gallery down.
    expect(aspectOf({ width: null, height: null })).toEqual({
      ratio: ASSUMED_ASPECT,
      capped: ASSUMED_ASPECT,
      cropped: false,
    });
  });

  it("treats a missing row, a half-measured row and a zero the same way", () => {
    for (const input of [
      null,
      undefined,
      {},
      { width: 1200, height: null },
      { width: null, height: 800 },
      { width: 0, height: 800 },
      { width: 1200, height: 0 },
      { width: -1200, height: 800 },
    ]) {
      expect(aspectOf(input), JSON.stringify(input)).toEqual({
        ratio: ASSUMED_ASPECT,
        capped: ASSUMED_ASPECT,
        cropped: false,
      });
    }
  });

  it("does not report an assumed ratio as cropped, because the default sits inside the caps", () => {
    expect(ASSUMED_ASPECT).toBeGreaterThanOrEqual(ASPECT_CAP_MIN);
    expect(ASSUMED_ASPECT).toBeLessThanOrEqual(ASPECT_CAP_MAX);
  });

  it("holds the boundaries themselves without calling them cropped", () => {
    // Exactly 3:4 and exactly 2:1 are inside the range, not outside it.
    expect(aspectOf({ width: 300, height: 400 })).toEqual({
      ratio: ASPECT_CAP_MIN,
      capped: ASPECT_CAP_MIN,
      cropped: false,
    });
    expect(aspectOf({ width: 2000, height: 1000 })).toEqual({
      ratio: ASPECT_CAP_MAX,
      capped: ASPECT_CAP_MAX,
      cropped: false,
    });
  });

  it("exports the caps so no surface hardcodes them", () => {
    // Three surfaces need the same maths: the card's media block (BG-P09), the
    // composer's preview (BG-P23) and the build page. A second copy of 0.75 is
    // how the composer starts framing a picture differently to the card.
    expect(ASPECT_CAP_MIN).toBe(0.75);
    expect(ASPECT_CAP_MAX).toBe(2.0);
  });
});

// =============================================================================
// Text on every entry of the post (BG-P07c)
// =============================================================================
// THE SAME SPLIT AS ABOVE, and for the same reason. A vitest double cannot
// prove a CHECK. What it CAN prove is everything that is a fact about
// TypeScript: the refusals setPostMediaText makes before it reaches the wire,
// the exact call it makes when it does, and the whole of postEntriesOf, which
// queries nothing at all.
//
// The two claims that are facts about Postgres — that a row LEAVING the set
// loses its text, and that a row merely MOVING keeps it — are checks 6 and 7 of
// supabase/tests/bg-p07c-post-text.sql, run against a real database. They are
// there rather than here because both are the behaviour of
// set_build_post_media(), and a fake that implemented that behaviour would only
// prove the fake. What this file owns is the instruction the data layer sends:
// removePostMedia leaving the id out of the array IS what tells the function to
// clear that row's text, and setPostMedia sending the survivors in order IS
// what tells it to carry the rest of the text along.

/** A row that is in the post, at `position`, saying `text`. */
function entry(id: string, position: number, text: string | null = null) {
  return media(id, { post_position: position, post_text: text });
}

describe("setPostMediaText: the refusals it makes before the wire", () => {
  it("rejects text over 280 characters with the named error", async () => {
    resetSupabase([entry("m-a", 0)]);

    await expect(
      setPostMediaText(BUILD_ID, "m-a", "x".repeat(POST_TEXT_MAX + 1))
    ).rejects.toBeInstanceOf(PostMediaError);
  });

  it("names the code text_too_long, and says how many were given", async () => {
    resetSupabase([entry("m-a", 0)]);

    await expect(
      setPostMediaText(BUILD_ID, "m-a", "x".repeat(400))
    ).rejects.toMatchObject({ name: "PostMediaError", code: "text_too_long" });
  });

  it("refuses without reading anything, because length needs no round trip", async () => {
    resetSupabase([entry("m-a", 0)]);
    await expect(setPostMediaText(BUILD_ID, "m-a", "x".repeat(281))).rejects.toThrow();

    expect(allArgsOf("update")).toHaveLength(0);
    expect(allArgsOf("from")).toHaveLength(0);
  });

  it("accepts exactly 280, so the cap is 280 and not 279", async () => {
    queueSupabase({ data: [entry("m-a", 0)] }, { data: entry("m-a", 0, "x".repeat(280)) });

    await expect(
      setPostMediaText(BUILD_ID, "m-a", "x".repeat(POST_TEXT_MAX))
    ).resolves.toMatchObject({ id: "m-a" });
  });

  it("counts CHARACTERS, not UTF-16 units, as char_length() does", async () => {
    // "🛠".length is 2, so a .length check would refuse 141 of these — while
    // Postgres, which counts code points, would happily store 280. The two must
    // agree or the composer refuses text the database would have taken.
    const emoji = "🛠".repeat(280);
    expect(emoji.length).toBeGreaterThan(POST_TEXT_MAX);

    queueSupabase({ data: [entry("m-a", 0)] }, { data: entry("m-a", 0, emoji) });
    await expect(setPostMediaText(BUILD_ID, "m-a", emoji)).resolves.toBeTruthy();

    // And 281 of them is still one too many.
    resetSupabase([entry("m-a", 0)]);
    await expect(setPostMediaText(BUILD_ID, "m-a", emoji + "🛠")).rejects.toMatchObject({
      code: "text_too_long",
    });
  });

  it("rejects text on a row OUTSIDE the set with the named error", async () => {
    // The CHECK would refuse this anyway — post_text requires post_position IS
    // NOT NULL — but "that picture is not in the post" is a sentence a composer
    // can show, and a constraint violation string is not.
    resetSupabase([entry("m-a", 0), entry("m-b", 1)]);

    await expect(setPostMediaText(BUILD_ID, "m-loose", "words")).rejects.toMatchObject({
      name: "PostMediaError",
      code: "not_in_post",
    });
  });

  it("does not attempt the write when the row is not in the set", async () => {
    resetSupabase([entry("m-a", 0)]);
    await expect(setPostMediaText(BUILD_ID, "m-loose", "words")).rejects.toThrow();

    expect(allArgsOf("update")).toHaveLength(0);
  });

  it("refuses an empty set for any row at all, which is the same rule", async () => {
    resetSupabase([]);
    await expect(setPostMediaText(BUILD_ID, "m-a", "words")).rejects.toMatchObject({
      code: "not_in_post",
    });
  });
});

describe("setPostMediaText: the write it makes", () => {
  it("writes post_text on the one named row, pinned to the build", async () => {
    queueSupabase({ data: [entry("m-a", 0)] }, { data: entry("m-a", 0, "It drew the graph.") });

    await setPostMediaText(BUILD_ID, "m-a", "It drew the graph.");

    expect(argsOf("update")).toEqual([{ post_text: "It drew the graph." }]);
    // Both keys: the membership read proves the row is on this build, and
    // pinning the write to both means a foreign id could not be written even if
    // that read were ever wrong.
    expect(allArgsOf("eq")).toEqual(
      expect.arrayContaining([
        ["id", "m-a"],
        ["build_id", BUILD_ID],
      ])
    );
    expect(argsOf("single")).toEqual([]);
  });

  it("names the columns it reads back rather than taking `*`", async () => {
    queueSupabase({ data: [entry("m-a", 0)] }, { data: entry("m-a", 0, "hi") });
    await setPostMediaText(BUILD_ID, "m-a", "hi");

    const selects = allArgsOf("select");
    expect(selects[selects.length - 1]).toEqual([POST_MEDIA_COLUMNS]);
    expect(POST_MEDIA_COLUMNS).toContain("post_text");
    expect(POST_MEDIA_COLUMNS).not.toContain("*");
  });

  it("TRIMS, so leading and trailing space never reaches the column", async () => {
    queueSupabase({ data: [entry("m-a", 0)] }, { data: entry("m-a", 0, "spaced") });
    await setPostMediaText(BUILD_ID, "m-a", "   spaced   ");

    expect(argsOf("update")).toEqual([{ post_text: "spaced" }]);
  });

  it("measures length AFTER trimming, so trailing space is not a refusal", async () => {
    // 280 characters plus spaces is 280 characters of text. Refusing it would
    // be refusing something the database would accept, because the value that
    // reaches the CHECK is the trimmed one.
    queueSupabase({ data: [entry("m-a", 0)] }, { data: entry("m-a", 0, "x".repeat(280)) });

    await expect(
      setPostMediaText(BUILD_ID, "m-a", `   ${"x".repeat(280)}   `)
    ).resolves.toBeTruthy();
    expect(argsOf("update")).toEqual([{ post_text: "x".repeat(280) }]);
  });

  it("normalises null, empty and whitespace-only to ONE cleared state", async () => {
    // Empty string and null render identically, so letting both into the column
    // would be storing two states that mean the same thing.
    for (const input of [null, "", "   ", "\n\t "]) {
      queueSupabase({ data: [entry("m-a", 0)] }, { data: entry("m-a", 0, null) });
      await setPostMediaText(BUILD_ID, "m-a", input);
      expect(argsOf("update"), JSON.stringify(input)).toEqual([{ post_text: null }]);
    }
  });

  it("throws through buildLayerError when the database refuses", async () => {
    queueSupabase(
      { data: [entry("m-a", 0)] },
      { data: null, error: { message: "violates check constraint" } }
    );

    await expect(setPostMediaText(BUILD_ID, "m-a", "hi")).rejects.toThrow(
      "setPostMediaText failed: violates check constraint"
    );
  });
});

describe("removePostMedia: the departing row's text", () => {
  it("leaves the removed id out of the set, which is what clears its text", async () => {
    // set_build_post_media() clears position AND post_text for every row not in
    // the array it is given, in one statement. So the instruction this side
    // owns is the array — and the id being absent from it IS the clear.
    // supabase/tests/bg-p07c-post-text.sql check 6 proves the other half.
    resetSupabase([entry("m-a", 0, "first"), entry("m-b", 1, "second"), entry("m-c", 2, "third")]);
    await removePostMedia(BUILD_ID, "m-b");

    const [, args] = argsOf("rpc") as [string, { p_media_ids: string[] }];
    expect(args.p_media_ids).toEqual(["m-a", "m-c"]);
    expect(args.p_media_ids).not.toContain("m-b");
  });

  it("sends no separate write to null the text, because that would not be atomic", async () => {
    // Nulling post_text from here first would cost a round trip AND introduce a
    // failure the function cannot have: if that write landed and the reorder
    // then failed, the creator would keep the picture and silently lose the
    // caption. One transaction, or neither.
    resetSupabase([entry("m-a", 0, "first"), entry("m-b", 1, "second")]);
    await removePostMedia(BUILD_ID, "m-b");

    expect(allArgsOf("update")).toHaveLength(0);
  });

  it("carries the SURVIVORS' text along by sending them in order", async () => {
    // Reordering keeps each row's text because the text is on the ROW, not on
    // the position: the function hands every surviving id its own words back
    // after assigning the new slots.
    resetSupabase([entry("m-a", 0, "first"), entry("m-b", 1, "second"), entry("m-c", 2, "third")]);
    await removePostMedia(BUILD_ID, "m-a");

    const [, args] = argsOf("rpc") as [string, { p_media_ids: string[] }];
    expect(args.p_media_ids).toEqual(["m-b", "m-c"]);
  });
});

describe("setPostMedia: reordering and text", () => {
  it("sends only ids, so a reorder cannot restate — or lose — any text", async () => {
    // The payload carries no text at all. That is the point: text lives on the
    // row, so moving a row moves its words with it and there is nothing for a
    // reorder to get wrong.
    resetSupabase([]);
    await setPostMedia(BUILD_ID, ["m-c", "m-a", "m-b"]);

    const [, args] = argsOf("rpc") as [string, Record<string, unknown>];
    expect(Object.keys(args).sort()).toEqual(["p_build_id", "p_media_ids"]);
    expect(args.p_media_ids).toEqual(["m-c", "m-a", "m-b"]);
  });
});

// --- the resolver ------------------------------------------------------------

describe("postEntriesOf", () => {
  const DESCRIPTION = "Turns a week of scattered notes into one publishable build.";
  const build = (outcome: string | null = DESCRIPTION) => ({ outcome });

  it("supplies the DESCRIPTION at position 0 when post_text is null", () => {
    // The first entry's text IS the build's one-sentence description — the
    // composer's "What does it do?" — and it is not duplicated into the column
    // to make that true. This is the rule the whole resolver exists for.
    const entries = postEntriesOf(build(), [entry("m-a", 0), entry("m-b", 1, "and then this")]);

    expect(entries[0].text).toBe(DESCRIPTION);
  });

  it("PREFERS post_text at position 0 when the creator has set one", () => {
    // The fallback is a default, not a lock: a creator who wants the first
    // picture introduced differently from the way the build is described says
    // so, and that wins.
    const entries = postEntriesOf(build(), [entry("m-a", 0, "Here is the thing itself.")]);

    expect(entries[0].text).toBe("Here is the thing itself.");
    expect(entries[0].text).not.toBe(DESCRIPTION);
  });

  it("gives null text for a later position with none", () => {
    // The description belongs to entry 0 alone. Entry 2 having no words is not
    // a hole to fill — it is a picture the creator let stand on its own.
    const entries = postEntriesOf(build(), [
      entry("m-a", 0),
      entry("m-b", 1, "a caption"),
      entry("m-c", 2),
    ]);

    expect(entries[1].text).toBe("a caption");
    expect(entries[2].text).toBeNull();
  });

  it("never lets the description leak onto a later entry", () => {
    const entries = postEntriesOf(build(), [entry("m-a", 0), entry("m-b", 1), entry("m-c", 2)]);

    expect(entries[0].text).toBe(DESCRIPTION);
    expect(entries.slice(1).every((e) => e.text === null)).toBe(true);
  });

  it("returns entries in POSITION ORDER regardless of the input order", () => {
    // getPostMedia returns them ordered, but a card that concatenated two reads,
    // or held a stale list, would otherwise render a post in an order its
    // creator never chose.
    const entries = postEntriesOf(build(), [
      entry("m-third", 2, "third"),
      entry("m-first", 0, "first"),
      entry("m-fourth", 3, "fourth"),
      entry("m-second", 1, "second"),
    ]);

    expect(entries.map((e) => e.media.id)).toEqual([
      "m-first",
      "m-second",
      "m-third",
      "m-fourth",
    ]);
    expect(entries.map((e) => e.position)).toEqual([0, 1, 2, 3]);
    expect(entries.map((e) => e.text)).toEqual(["first", "second", "third", "fourth"]);
  });

  it("applies the position-0 rule to the row AT position 0, not the first given", () => {
    // The two come apart exactly when the caller's order is wrong, which is the
    // case the sort exists for.
    const entries = postEntriesOf(build(), [entry("m-b", 1), entry("m-a", 0)]);

    expect(entries[0].media.id).toBe("m-a");
    expect(entries[0].text).toBe(DESCRIPTION);
    expect(entries[1].text).toBeNull();
  });

  it("DROPS rows that are not in the post", () => {
    // A caller may hand over a whole media list — the pictures hanging off
    // nodes included — and get back only the thread.
    const entries = postEntriesOf(build(), [
      media("m-loose"),
      entry("m-a", 0),
      media("m-also-loose", { node_id: "n-1" }),
      entry("m-b", 1),
    ]);

    expect(entries.map((e) => e.media.id)).toEqual(["m-a", "m-b"]);
  });

  it("returns an empty array for a build with no set, which is the normal case", () => {
    expect(postEntriesOf(build(), [media("m-loose")])).toEqual([]);
    expect(postEntriesOf(build(), [])).toEqual([]);
  });

  it("does not disturb the array it was handed", () => {
    const rows = [entry("m-c", 2), entry("m-a", 0), entry("m-b", 1)];
    postEntriesOf(build(), rows);

    expect(rows.map((r) => r.id)).toEqual(["m-c", "m-a", "m-b"]);
  });

  it("carries the whole media row through, so a card needs no second lookup", () => {
    const [first] = postEntriesOf(build(), [entry("m-a", 0)]);

    expect(first.media.id).toBe("m-a");
    expect(first.media.width).toBe(1200);
    expect(aspectOf(first.media).ratio).toBeCloseTo(1.5, 10);
  });

  it("gives position 0 a null text when the build has no description either", () => {
    // A draft nobody has described yet. The entry renders as a picture with no
    // words, which is a designed state and not an error.
    expect(postEntriesOf(build(null), [entry("m-a", 0)])[0].text).toBeNull();
  });

  it("tolerates a missing build the way resolveCover does", () => {
    expect(postEntriesOf(null, [entry("m-a", 0)])[0].text).toBeNull();
    expect(postEntriesOf(undefined, [entry("m-a", 0, "its own words")])[0].text).toBe(
      "its own words"
    );
  });

  it("queries nothing at all", () => {
    resetSupabase([]);
    postEntriesOf(build(), [entry("m-a", 0), entry("m-b", 1)]);

    expect(rpcState.calls).toHaveLength(0);
  });
});
