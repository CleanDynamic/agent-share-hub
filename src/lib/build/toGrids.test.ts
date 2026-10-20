// CA-07 P2 — one block of pictures per post: the stored shape, toGrids, and what checkThread says about it.

import { describe, expect, it } from "vitest";

import {
  ALT_MAX,
  checkThread,
  mediaAttrsOf,
  toGrids,
  type PostBlock,
  type ThreadBlock,
  type ThreadDoc,
  type ThreadPostMedia,
} from "./thread";
import { editorShape, holdSentence, postLead, postRuns } from "./threadEditor";

const doc = (...content: ThreadBlock[]): ThreadDoc => ({ type: "doc", content });
const p = (text: string): PostBlock => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] });
const br: ThreadBlock = { type: "postBreak" };
const pic = (mediaId: string, attrs: Record<string, unknown> = {}): ThreadPostMedia =>
  ({ type: "postMedia", attrs: { mediaId, width: 100, w: 800, h: 600, alt: "", caption: "", ...attrs } }) as ThreadPostMedia;
const row = (...pictures: ThreadPostMedia[]): ThreadBlock => ({ type: "postMediaRow", content: pictures });
const grid = (step: string | null, ...pictures: ThreadPostMedia[]): ThreadBlock => ({ type: "postMediaGrid", attrs: { step }, content: pictures });
const ids = (block: ThreadBlock | undefined) => ((block as { content?: ThreadPostMedia[] })?.content ?? []).map((child) => child.attrs.mediaId);

describe("toGrids", () => {
  it("gathers the pictures between the lines into one grid at the post's end, in order", () => {
    const out = toGrids(doc(p("one"), pic("a"), p("two"), pic("b"), p("three")));
    expect(out.content.map((block) => block.type)).toEqual(["paragraph", "paragraph", "paragraph", "postMediaGrid"]);
    expect(ids(out.content[3])).toEqual(["a", "b"]);
    expect(out.content[3]).toMatchObject({ attrs: { step: null } });
  });

  it("takes the pictures out of a row, keeping their order", () => {
    const out = toGrids(doc(p("one"), row(pic("a"), pic("b"), pic("c")), p("two")));
    expect(out.content.map((block) => block.type)).toEqual(["paragraph", "paragraph", "postMediaGrid"]);
    expect(ids(out.content[2])).toEqual(["a", "b", "c"]);
  });

  it("makes two grids in one post one, keeping the first step either named", () => {
    const out = toGrids(doc(grid(null, pic("a")), p("between"), grid("node:s2", pic("b")), grid("node:s3", pic("c"))));
    expect(out.content.map((block) => block.type)).toEqual(["paragraph", "postMediaGrid"]);
    expect(ids(out.content[1])).toEqual(["a", "b", "c"]);
    expect(out.content[1]).toMatchObject({ attrs: { step: "node:s2" } });
  });

  it("keeps all five of a post with five, and checkThread names it", () => {
    const out = toGrids(doc(p("x"), pic("a"), pic("b"), row(pic("c"), pic("d")), pic("e")));
    expect(ids(out.content[1])).toEqual(["a", "b", "c", "d", "e"]);
    expect(checkThread(out).map((problem) => problem.code)).toContain("too_many_post_pictures");
  });

  it("works post by post, and gives a post with no pictures no grid", () => {
    const out = toGrids(doc(p("one"), pic("a"), br, p("two"), br, pic("b"), p("three")));
    expect(out.content.map((block) => block.type)).toEqual(["paragraph", "postMediaGrid", "postBreak", "paragraph", "postBreak", "paragraph", "postMediaGrid"]);
  });

  it("returns a thread with no pictures, or one already in the new shape, as the same object", () => {
    const words = doc(p("one"), br, p("two"));
    expect(toGrids(words)).toBe(words);
    const shaped = doc(p("one"), grid(null, pic("a")), br, p("two"), grid("node:s1", pic("b"), pic("c")));
    expect(toGrids(shaped)).toBe(shaped);
    // A grid that is not last is not the new shape.
    const early = doc(grid(null, pic("a")), p("after"));
    expect(toGrids(early)).not.toBe(early);
  });
});

describe("the editor's shape", () => {
  it("gives a post that is only pictures an empty line before them, where its placeholder sits", () => {
    const out = editorShape(doc(pic("a"), br, p("words"), pic("b")));
    expect(out.content.map((block) => block.type)).toEqual(["paragraph", "postMediaGrid", "postBreak", "paragraph", "postMediaGrid"]);
  });

  it("names a grid Picture or Pictures in the outline", () => {
    expect(postLead(postRuns(doc(grid(null, pic("a"))))[0])).toBe("Picture");
    expect(postLead(postRuns(doc(grid(null, pic("a"), pic("b"))))[0])).toBe("Pictures");
  });

  it("holds the save while a picture did not upload, naming it", () => {
    const failed = pic("", { failed: true });
    expect(holdSentence(doc(p("one"), br, p("two"), grid(null, pic("a"), failed)))).toBe("Picture 2 in post 2 did not upload. Retry it or remove it.");
  });
});

describe("checkThread and the grid", () => {
  const codes = (value: ThreadDoc) => checkThread(value).map((problem) => problem.message);

  it("accepts a grid, and a step to a part since deleted (readers drop the line)", () => {
    expect(checkThread(doc(p("x"), grid("node:gone-step", pic("a"))))).toEqual([]);
  });

  it("refuses a step that is not node: and an id", () => {
    expect(codes(doc(p("x"), br, p("y"), grid("session:abc", pic("a"))))).toEqual(["The step a picture links to in post 2 isn't in this build."]);
    expect(codes(doc(p("x"), grid("node:", pic("a"))))).toEqual(["The step a picture links to in post 1 isn't in this build."]);
  });

  it("refuses a warning other than the three", () => {
    expect(checkThread(doc(p("x"), grid(null, pic("a", { warn: ["nudity", "violence", "sensitive"] }))))).toEqual([]);
    expect(codes(doc(p("x"), grid(null, pic("a", { warn: ["gore"] }))))).toEqual(["Post 1 has a content warning a thread cannot keep. Choose Nudity, Violence or Sensitive."]);
  });

  it("refuses a crop outside 0 to 1, or smaller than 1% either way", () => {
    expect(checkThread(doc(p("x"), grid(null, pic("a", { crop: { x: 0, y: 0.25, w: 1, h: 0.5 } }))))).toEqual([]);
    expect(checkThread(doc(p("x"), grid(null, pic("a", { crop: null }))))).toEqual([]);
    for (const crop of [{ x: 0.5, y: 0, w: 0.6, h: 1 }, { x: -0.1, y: 0, w: 0.5, h: 0.5 }, { x: 0, y: 0, w: 0.005, h: 1 }, { x: 0, y: 0, w: "1", h: 1 }]) {
      expect(codes(doc(p("x"), grid(null, pic("a", { crop }))))).toEqual(["Post 1 has a picture cropped outside itself. Crop it again."]);
    }
  });

  it("takes alt text up to 1,000 characters", () => {
    expect(ALT_MAX).toBe(1000);
    expect(checkThread(doc(p("x"), grid(null, pic("a", { alt: "a".repeat(1000) }))))).toEqual([]);
    expect(codes(doc(p("x"), grid(null, pic("a", { alt: "a".repeat(1001) }))))).toEqual(["Post 1 has a picture description of 1001 characters. Descriptions are at most 1,000; shorten it."]);
  });

  it("refuses something other than a picture in a grid", () => {
    expect(codes(doc(p("x"), { type: "postMediaGrid", attrs: { step: null }, content: [p("words")] } as unknown as ThreadBlock))).toContain(
      "Post 1 has something other than a picture with its pictures. Move it out.",
    );
  });
});

describe("mediaAttrsOf", () => {
  it("reads an old picture with CA-07's defaults", () => {
    expect(mediaAttrsOf(pic("a"))).toMatchObject({ mediaId: "a", crop: null, aspect: null, zoom: null, warn: [], alt: "" });
    expect(mediaAttrsOf(pic("a", { aspect: "wide", zoom: 2, warn: ["violence", "x"], crop: { x: 0, y: 0, w: 1, h: 0.5 } }))).toMatchObject({
      aspect: "wide",
      zoom: 2,
      warn: ["violence"],
      crop: { x: 0, y: 0, w: 1, h: 0.5 },
    });
  });
});
