// Acceptance cover for what a card leads with, and what it asks the network for.
//
// TWO CLAIMS, AND THEY ARE THE ONES A SCREENSHOT CANNOT PROVE:
//
// 1. The creator's chosen cover wins. Remove it and the card falls back to the
//    imagery the record already implies, exactly as it did before covers
//    existed — so turning a cover off is never the same as turning a picture
//    off.
// 2. Nothing goes into a card at original size. The width is asserted on the
//    generated URL STRING, because that is what the browser actually fetches
//    and a transform that quietly stops being applied looks identical in the
//    component tree.

import { describe, expect, it } from "vitest";
import {
  DEFAULT_MEDIA_QUALITY,
  mediaUrl,
  type GalleryBuild,
  type GalleryMedia,
} from "@/lib/build";
import {
  CARD_MEDIA_WIDTH,
  CARD_VARIANT_WIDTH,
  cardMedia,
  coverMedia,
  mediaAlt,
  nodeTypeLabel,
  stillRef,
} from "./cardMedia";

function media(over: Partial<GalleryMedia> = {}): GalleryMedia {
  return {
    id: "m-evidence",
    node_id: "n-shot",
    bucket: "build-media",
    path: "b1/n-shot/evidence.png",
    kind: "image",
    width: 1600,
    height: 900,
    poster_path: null,
    ...over,
  };
}

function build(over: Partial<GalleryBuild> = {}): GalleryBuild {
  return {
    id: "b1",
    creator_id: "c1",
    slug: "a-build",
    title: "A build",
    outcome: "Turns a week of triage into ten minutes.",
    shape: "other",
    status: "published",
    made_for: [],
    made_with: [],
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    cover_media_id: null,
    completeness: 80,
    reproduction_count: 0,
    last_confirmed_at: null,
    last_confirmed_model: null,
    published_at: "2026-08-01T00:00:00Z",
    nodes: [
      {
        id: "n-shot",
        type: "screenshot",
        title: "The result",
        payload: { caption: "The inbox, after" },
        position: 0,
        is_gap: false,
      },
    ],
    media: [media()],
    ...over,
  } as GalleryBuild;
}

describe("what a card leads with", () => {
  // ACCEPTANCE 1
  it("leads with the chosen cover, over anything the record implies", () => {
    const cover = media({ id: "m-cover", node_id: null, path: "b1/unplaced/cover.png" });
    const withCover = build({
      cover_media_id: "m-cover",
      media: [media(), cover],
    });

    expect(coverMedia(withCover)?.id).toBe("m-cover");
  });

  // ACCEPTANCE 1 — the other half: removing it is not removing the picture.
  it("falls back to node-derived imagery when the cover is cleared", () => {
    expect(coverMedia(build({ cover_media_id: null }))?.id).toBe("m-evidence");
  });

  it("falls back rather than blanking when the cover row has gone", () => {
    // The FK clears this pointer, but a card can be holding a row read before
    // the delete. It must show the next-best thing, not nothing.
    expect(coverMedia(build({ cover_media_id: "m-deleted" }))?.id).toBe("m-evidence");
  });

  it("has nothing to lead with when the build carries no media", () => {
    expect(coverMedia(build({ media: [], nodes: [] }))).toBeNull();
  });
});

describe("what a card asks the network for", () => {
  // ACCEPTANCE 2
  it("asks for the card's own width, not the original", () => {
    const rows = cardMedia(build());
    expect(rows).toHaveLength(1);
    expect(rows[0].slotWidth).toBe(CARD_MEDIA_WIDTH);
  });

  it("puts width and quality on the URL the browser fetches", () => {
    const url = mediaUrl(media(), { width: CARD_MEDIA_WIDTH });

    expect(url).toContain(`width=${CARD_MEDIA_WIDTH}`);
    expect(url).toContain(`quality=${DEFAULT_MEDIA_QUALITY}`);
    // The render endpoint, not the object one: a transform served from
    // /object/ is a transform that was silently dropped.
    expect(url).toContain("/render/image/");
  });

  it("sizes a variant grid cell to the cell, not to the body", () => {
    const variants = build({
      shape: "media",
      nodes: [
        {
          id: "n-gen",
          type: "generated_media",
          title: "Four goes at it",
          payload: {
            variants: [
              { media_id: "m-a", chosen: true },
              { media_id: "m-b", note: "too flat" },
            ],
          },
          position: 0,
          is_gap: false,
        },
      ],
      media: [
        media({ id: "m-a", node_id: "n-gen", path: "b1/n-gen/a.png" }),
        media({ id: "m-b", node_id: "n-gen", path: "b1/n-gen/b.png" }),
      ],
    });

    const byId = new Map(cardMedia(variants).map((row) => [row.id, row.slotWidth]));
    expect(byId.get("m-a")).toBe(CARD_VARIANT_WIDTH);
    expect(byId.get("m-b")).toBe(CARD_VARIANT_WIDTH);
  });

  it("does not sign a variant grid for a shape that never renders one", () => {
    // Only the media shape draws a grid, so signing the variants of anything
    // else is a request per image for pictures nobody sees.
    const notMedia = build({
      shape: "app",
      nodes: [
        {
          id: "n-gen",
          type: "generated_media",
          title: "Four goes at it",
          payload: { variants: [{ media_id: "m-a", chosen: true }] },
          position: 0,
          is_gap: false,
        },
      ],
      media: [media({ id: "m-a", node_id: "n-gen", path: "b1/n-gen/a.png" })],
    });

    // Nothing is signed at all, and that is correct rather than a loss: an
    // app-shaped build takes AppCardBody, which falls through to the hero and
    // evidence chain — generated_media is in neither, so this picture was
    // being signed and then never rendered.
    expect(cardMedia(notMedia)).toEqual([]);
  });

  // ACCEPTANCE 3
  it("points a video row at its poster, which is what a card can transform", () => {
    const video = media({
      id: "m-demo",
      path: "b1/n-shot/demo.mp4",
      kind: "video",
      poster_path: "b1/n-shot/demo-poster.jpg",
    });

    expect(stillRef(video)).toEqual({
      bucket: "build-media",
      path: "b1/n-shot/demo-poster.jpg",
      kind: "image",
    });
  });

  it("falls back to the video itself when no poster was made", () => {
    const video = media({ id: "m-demo", path: "b1/n-shot/demo.mp4", kind: "video" });
    expect(stillRef(video).path).toBe("b1/n-shot/demo.mp4");
  });
});

describe("what a card's picture is called", () => {
  // ACCEPTANCE 4
  it("uses the creator's caption when the payload carries one", () => {
    expect(mediaAlt(build(), media())).toBe("The inbox, after");
  });

  it("falls back to the build and the kind of thing being shown", () => {
    const uncaptioned = build({
      nodes: [
        {
          id: "n-shot",
          type: "comparison_table",
          title: null,
          payload: {},
          position: 0,
          is_gap: false,
        },
      ],
    });

    expect(mediaAlt(uncaptioned, media())).toBe("A build — Comparison table");
  });

  it("is never empty, even for a build with no title and no node", () => {
    const bare = build({ title: "  ", nodes: [] });
    expect(mediaAlt(bare, media()).trim().length).toBeGreaterThan(0);
  });

  it("says a node type the way a reader would", () => {
    expect(nodeTypeLabel("screenshot")).toBe("Screenshot");
    expect(nodeTypeLabel("comparison_table")).toBe("Comparison table");
  });
});
