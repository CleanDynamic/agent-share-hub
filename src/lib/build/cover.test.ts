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
