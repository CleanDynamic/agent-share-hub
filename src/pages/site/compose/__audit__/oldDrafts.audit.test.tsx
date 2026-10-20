// CA-08 Part 2, cause 8 — does an old draft crash the composer when it is opened?
//
// CA-06 and CA-07 changed how post_doc is read (references, toGrids, the grid node). Each shape a stored thread can
// have is run through every reader (threadOf, toGrids, splitThread, checkThread, tidyThread, editorShape, postRuns,
// holdSentence, threadMediaIds), drawn by the reader's PostThread, and opened in the composer's real editor
// (PostTab, through postTabKit). A draft saved before PT-01 has no post_doc at all and opens through legacyThread.
// Every test passes: none of them throws.

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PostThread } from "@/components/post/PostThread";
import type { GalleryMedia } from "@/lib/build";
import { linksPost } from "@/dev/fixtures/postLinks";
import {
  checkThread,
  splitThread,
  THREAD_MARK_TYPES,
  THREAD_NODE_TYPES,
  threadMediaIds,
  threadOf,
  toGrids,
  type ThreadBlock,
  type ThreadDoc,
  type ThreadPostMedia,
} from "@/lib/build/thread";
import { editorShape, holdSentence, postRuns, tidyThread } from "@/lib/build/threadEditor";

import { brk, doc, mountPostTab, p } from "../postTabKit";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

vi.stubGlobal(
  "ClipboardEvent",
  class extends Event {
    clipboardData = null;
  },
);

const pic = (mediaId: string, attrs: Record<string, unknown> = {}): ThreadPostMedia =>
  ({ type: "postMedia", attrs: { mediaId, width: 100, w: 1600, h: 900, alt: "", caption: "", ...attrs } }) as ThreadPostMedia;
const row = (...pictures: ThreadPostMedia[]): ThreadBlock => ({ type: "postMediaRow", content: pictures });
const grid = (step: string | null, ...pictures: ThreadPostMedia[]): ThreadBlock => ({ type: "postMediaGrid", attrs: { step }, content: pictures });

const media = (id: string): GalleryMedia => ({ id, node_id: null, bucket: "build-media", path: `p/${id}.png`, kind: "image", width: 1600, height: 900, poster_path: null, duration: null, post_position: null, post_text: null });
const IDS = ["a", "b", "c", "d", "e"];
const MEDIA = new Map(IDS.map((id) => [id, media(id)]));
const SRC = new Map(IDS.map((id) => [`p/${id}.png`, `https://signed.test/${id}.png`]));

/** Every stored shape a thread has had, oldest first. */
const SHAPES: Record<string, ThreadDoc> = {
  "PT-06: pictures between the lines, a row, sizes and captions": doc(
    p("Before the first picture."),
    pic("a", { width: 60, caption: "A caption" }),
    p("Between the pictures."),
    row(pic("b", { caption: "Left" }), pic("c", { caption: "Right" })),
    brk,
    p("The second post."),
    pic("d", { width: 40 }),
    p("After it."),
  ),
  "CA-06: references as marks, the posts.ts fixture": linksPost,
  "CA-07: one grid per post, last, naming a step": doc(p("Words first."), grid("node:o-p2", pic("a", { alt: "The menu.", warn: ["sensitive"], crop: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 } }), pic("b"))),
  "a post that is only pictures": doc(pic("a"), brk, p("Then words.")),
  "five pictures in one post (a row and loose ones)": doc(p("x"), pic("a"), pic("b"), row(pic("c"), pic("d")), pic("e")),
};

describe("CA-08 · cause 8: old drafts, through every reader and the editor", () => {
  for (const [name, stored] of Object.entries(SHAPES)) {
    it(`${name}: every reader reads it, PostThread draws it, the editor opens it with its words`, () => {
      const read = threadOf({ post_doc: stored, outcome: null }, []);
      expect(read).toBe(stored);
      const grids = toGrids(stored);
      expect(() => splitThread(grids)).not.toThrow();
      expect(() => [checkThread(stored), tidyThread(stored), editorShape(stored), postRuns(stored), holdSentence(stored), threadMediaIds(stored)]).not.toThrow();
      // After toGrids no row is left, so nothing reaches the editor that its schema lacks.
      expect(JSON.stringify(editorShape(stored))).not.toContain("postMediaRow");

      expect(() => render(<PostThread posts={splitThread(stored)} mediaById={MEDIA} srcByPath={SRC} mode="page" />)).not.toThrow();
      cleanup();

      const warned = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const { editor } = mountPostTab(stored);
      expect(editor.isEmpty).toBe(false);
      // TipTap answers content it cannot read by opening an EMPTY document and warning "[tiptap warn]: Invalid content".
      expect(warned.mock.calls.some(([first]) => String(first).includes("Invalid content"))).toBe(false);
    });
  }

  it("five pictures in one post: checkThread refuses it, so the save waits with a sentence rather than failing", () => {
    const five = SHAPES["five pictures in one post (a row and loose ones)"];
    expect(checkThread(toGrids(five)).map((problem) => problem.code)).toContain("too_many_post_pictures");
    expect(holdSentence(toGrids(five))).toMatch(/at most 4/);
  });

  it("the editor's schema holds every node and mark checkThread lets a thread store, but postMediaRow, which toGrids removes", () => {
    const { editor } = mountPostTab(doc(p("x")));
    const nodes = Object.keys(editor.schema.nodes);
    const marks = Object.keys(editor.schema.marks);
    const missing = [...THREAD_NODE_TYPES].filter((type) => !nodes.includes(type));
    expect(missing).toEqual(["postMediaRow"]);
    expect([...THREAD_MARK_TYPES].filter((type) => !marks.includes(type))).toEqual([]);
  });

  it("a draft saved before PT-01 (post_doc absent or null) opens through legacyThread, from the post-media set", () => {
    const set = [
      { ...media("a"), post_position: 0, post_text: "The first picture's words." },
      { ...media("b"), post_position: 1, post_text: null },
    ];
    for (const build of [{ outcome: "What it does." }, { outcome: "What it does.", post_doc: null }]) {
      const thread = threadOf(build, set);
      expect(thread).not.toBeNull();
      expect(threadMediaIds(thread as ThreadDoc)).toEqual(["a", "b"]);
      const { editor } = mountPostTab(thread as ThreadDoc);
      expect(editor.isEmpty).toBe(false);
      cleanup();
    }
    // With no set and no outcome there is nothing to open, and the editor starts empty, as for a new post.
    expect(threadOf({ outcome: null, post_doc: null }, [])).toBeNull();
  });

  it("a post_doc that is not a thread at all is read as no thread (useComposeThread then opens an empty one)", () => {
    for (const odd of [{}, { type: "doc" }, []]) {
      expect(threadOf({ post_doc: odd, outcome: null }, [])).toBeNull();
    }
  });
});
