// threadEditor (PT-05): the thread as the editor shows it.

import { describe, expect, it } from "vitest";

import type { ThreadBlock, ThreadDoc } from "./thread";
import {
  canStartPost,
  countLabel,
  emptyThread,
  firstOverLimit,
  holdSentence,
  movePost,
  overLimitSentence,
  postLead,
  postRuns,
  POST_LIMIT_SENTENCE,
  sameThread,
  tidyThread,
} from "./threadEditor";

const p = (text: string): ThreadBlock => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] });
const brk: ThreadBlock = { type: "postBreak" };
const doc = (...content: ThreadBlock[]): ThreadDoc => ({ type: "doc", content });
const picture = (id = "m1"): ThreadBlock => ({ type: "postMedia", attrs: { mediaId: id, width: 100, w: null, h: null, alt: "", caption: "" } });

describe("postRuns", () => {
  it("cuts at breaks and keeps an empty post at either end", () => {
    const runs = postRuns(doc(brk, p("a"), brk, p("b"), brk));
    expect(runs.map((run) => run.blocks.length)).toEqual([0, 1, 1, 0]);
    expect(runs.map((run) => run.index)).toEqual([0, 1, 2, 3]);
  });

  it("always has one run, and records where each starts and ends in doc.content", () => {
    expect(postRuns(emptyThread())).toHaveLength(1);
    const runs = postRuns(doc(p("a"), p("b"), brk, p("c")));
    expect(runs.map((run) => [run.start, run.end])).toEqual([
      [0, 2],
      [3, 4],
    ]);
  });
});

describe("postLead", () => {
  it("is the first words of the first block with any, with an ellipsis once cut", () => {
    expect(postLead(postRuns(doc(p("Hello there")))[0])).toBe("Hello there");
    expect(postLead(postRuns(doc(p("one two three four five six seven eight nine ten")))[0])).toBe("one two three four five six seven eight…");
    expect(postLead(postRuns(doc(p(""), p("second")))[0])).toBe("second");
  });

  it("names a picture, and is empty for an empty post", () => {
    expect(postLead(postRuns(doc(picture()))[0])).toBe("Picture");
    expect(postLead(postRuns(doc(p("")))[0])).toBe("");
  });

  it("reads a list as its items", () => {
    const list: ThreadBlock = { type: "bulletList", content: [{ type: "listItem", content: [p("first") as never] }, { type: "listItem", content: [p("second") as never] }] };
    expect(postLead(postRuns(doc(list))[0])).toBe("first second");
  });
});

describe("the limit", () => {
  it("shows a count only past 900, as 912 / 1,000", () => {
    expect(countLabel(900)).toBeNull();
    expect(countLabel(912)).toBe("912 / 1,000");
    expect(countLabel(1001)).toBe("1,001 / 1,000");
  });

  it("names the first post over 1,000 by its place in the editor", () => {
    const long = "x".repeat(1001);
    const thread = doc(p("short"), brk, p("also short"), brk, p(long));
    expect(firstOverLimit(thread)).toEqual({ index: 2, length: 1001 });
    expect(overLimitSentence(2)).toBe("Post 3 is over 1,000 characters");
    expect(holdSentence(thread)).toBe("Post 3 is over 1,000 characters");
    expect(holdSentence(doc(p("x".repeat(1000))))).toBeNull();
  });

  it("holds a save for any other problem thread.ts finds, in its own sentence", () => {
    const bad = doc({ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] });
    expect(holdSentence(bad)).toMatch(/link that does not start with http, https or mailto/);
  });

  it("refuses an 11th post with a sentence", () => {
    const ten = doc(...Array.from({ length: 10 }, (_, index) => [p(`post ${index}`), brk]).flat().slice(0, -1));
    expect(postRuns(ten)).toHaveLength(10);
    expect(canStartPost(ten)).toBe(false);
    expect(canStartPost(doc(p("a"), brk, p("b")))).toBe(true);
    expect(POST_LIMIT_SENTENCE).toMatch(/at most 10 posts/);
  });
});

describe("movePost", () => {
  const three = doc(p("one"), p("one b"), brk, p("two"), brk, picture(), p("three"));

  it("moves a post's whole run of blocks, breaks staying between", () => {
    const moved = movePost(three, 0, 2);
    expect(moved.content.map((block) => block.type)).toEqual(["paragraph", "postBreak", "postMedia", "paragraph", "postBreak", "paragraph", "paragraph"]);
    expect(postRuns(moved).map((run) => postLead(run))).toEqual(["two", "Picture", "one"]);
  });

  it("moves up as well as down, and a move onto itself changes nothing", () => {
    expect(postRuns(movePost(three, 2, 0)).map((run) => postLead(run))).toEqual(["Picture", "one", "two"]);
    expect(movePost(three, 1, 1)).toBe(three);
    expect(movePost(three, 0, 9)).toBe(three);
  });

  it("keeps every block", () => {
    expect(movePost(three, 1, 0).content).toHaveLength(three.content.length);
  });
});

describe("tidyThread and sameThread", () => {
  it("drops attributes that are only their default, and the empty paragraphs at the end", () => {
    const raw = doc({ type: "paragraph", attrs: { size: "body" }, content: [{ type: "text", text: "hi" }] }, { type: "codeBlock", attrs: { language: null }, content: [{ type: "text", text: "x" }] }, p(""));
    expect(tidyThread(raw).content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "hi" }] },
      { type: "codeBlock", content: [{ type: "text", text: "x" }] },
    ]);
  });

  it("keeps a small paragraph's size", () => {
    expect(tidyThread(doc({ type: "paragraph", attrs: { size: "small" }, content: [{ type: "text", text: "x" }] })).content[0]).toMatchObject({ attrs: { size: "small" } });
  });

  it("treats a trailing empty paragraph, and a default attribute, as no change", () => {
    expect(sameThread(doc(p("a")), doc(p("a"), p("")))).toBe(true);
    expect(sameThread(doc(p("a")), doc({ type: "paragraph", attrs: { size: "body" }, content: [{ type: "text", text: "a" }] }))).toBe(true);
    expect(sameThread(doc(p("a")), doc(p("b")))).toBe(false);
    expect(sameThread(doc(p("a"), brk), doc(p("a")))).toBe(false);
  });
});
