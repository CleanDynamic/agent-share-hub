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
}));

vi.mock("@/integrations/supabase/client", () => {
  const chain: Record<string, unknown> = {};
  for (const method of ["from", "select", "eq", "not", "order", "limit", "rpc"]) {
    chain[method] = (...args: unknown[]) => {
      rpcState.calls.push({ method, args });
      return chain;
    };
  }
  // PostgREST builders are thenable, not promises; awaiting one runs the query.
  chain.then = (resolve: (value: unknown) => unknown) => resolve(rpcState.response);
  return { supabase: chain };
});

import {
  ASPECT_CAP_MAX,
  ASPECT_CAP_MIN,
  ASSUMED_ASPECT,
  MAX_POST_MEDIA,
  POST_MEDIA_COLUMNS,
  PostMediaError,
  addPostMedia,
  aspectOf,
  getPostMedia,
  removePostMedia,
  setPostMedia,
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
  rpcState.response = { data, error };
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
