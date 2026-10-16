// PT-07 — the draft as a feed item reads a build.

import { describe, expect, it } from "vitest";

import { draftGalleryBuild, PREVIEW_ID, previewScale } from "./postPreview";
import { splitThread, threadOf, type ThreadDoc } from "./thread";
import type { Build } from "./types";

const DOC: ThreadDoc = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "one" }] },
    { type: "postBreak" },
    { type: "paragraph", content: [{ type: "text", text: "two" }] },
  ],
};

describe("draftGalleryBuild", () => {
  it("carries the thread as the editor has it, so the feed item splits it the way the Gallery does", () => {
    const item = draftGalleryBuild({ build: null, title: "Typed", doc: DOC, media: [], makerId: "u1", now: 0 });
    expect(item.post_doc).toBe(DOC);
    expect(splitThread(threadOf(item, item.media) as ThreadDoc)).toHaveLength(2);
  });

  it("is a draft with no build row yet: stand-in values, the maker's id, the title as typed, published now", () => {
    const item = draftGalleryBuild({ build: null, title: "Typed", doc: DOC, media: [], makerId: "u1", now: Date.UTC(2026, 9, 16) });
    expect(item).toMatchObject({ id: PREVIEW_ID, creator_id: "u1", title: "Typed", slug: "", status: "draft", made_with: null, nodes: [] });
    expect(item.published_at).toBe("2026-10-16T00:00:00.000Z");
  });

  it("takes the row's marks and ids, and the typed title over the saved one", () => {
    const build = { id: "b1", creator_id: "u9", slug: "engine", title: "Saved", made_with: ["Claude Code"], cover_media_id: "m1" } as unknown as Build;
    const item = draftGalleryBuild({ build, title: "Typed", doc: DOC, media: [], makerId: "u1", now: 0 });
    expect(item).toMatchObject({ id: "b1", creator_id: "u9", slug: "engine", title: "Typed", made_with: ["Claude Code"], cover_media_id: "m1" });
  });
});

describe("previewScale", () => {
  it("is the column over 628 and never more than 1", () => {
    expect(previewScale(314)).toBe(0.5);
    expect(previewScale(628)).toBe(1);
    expect(previewScale(1000)).toBe(1);
    expect(previewScale(Number.NaN)).toBe(1);
  });
});
