// PT-01: the thread document, read and checked without a database, and saved
// with both writes mocked.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { setPostMedia, updateBuild } = vi.hoisted(() => ({
  setPostMedia: vi.fn(),
  updateBuild: vi.fn(),
}));
vi.mock("@/lib/build/builds", () => ({ updateBuild }));
vi.mock("@/lib/build/cover", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build/cover")>()),
  setPostMedia,
}));

import {
  ALT_MAX,
  CAPTION_MAX,
  MAX_POST_PICTURES,
  MAX_THREAD_MEDIA,
  MAX_THREAD_POSTS,
  POST_BODY_MAX,
  ThreadError,
  checkThread,
  legacyThread,
  postPlainText,
  saveThread,
  splitThread,
  threadMediaIds,
  threadOf,
  type PostBlock,
  type PostMediaAttrs,
  type ThreadBlock,
  type ThreadDoc,
  type ThreadMedia,
} from "@/lib/build/thread";

const BUILD_ID = "b0000000-0000-4000-8000-000000000000";

const doc = (...content: ThreadBlock[]): ThreadDoc => ({ type: "doc", content });
const p = (text: string): PostBlock => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] });
const br: ThreadBlock = { type: "postBreak" };
const pic = (mediaId: string, attrs: Partial<PostMediaAttrs> = {}): PostBlock => ({
  type: "postMedia",
  attrs: { mediaId, width: 100, w: null, h: null, alt: "", crop: null, aspect: null, zoom: null, warn: [], caption: "", ...attrs },
});
const row = (...ids: string[]): PostBlock => ({
  type: "postMediaRow",
  content: ids.map((id) => pic(id) as Extract<PostBlock, { type: "postMedia" }>),
});
const codes = (value: unknown) => checkThread(value).map((problem) => problem.code);

describe("splitThread", () => {
  it("cuts at breaks and drops the empty posts a break at either end makes", () => {
    const posts = splitThread(doc(br, p("one"), br, p("two"), br));
    expect(posts.map(postPlainText)).toEqual(["one", "two"]);
  });

  it("drops an empty paragraph at the ends, as an editor leaves one", () => {
    expect(splitThread(doc(p(""), br, p("one"), br, p("")))).toHaveLength(1);
  });

  it("keeps the empty post two breaks in a row make between posts", () => {
    const posts = splitThread(doc(p("one"), br, br, p("two")));
    expect(posts.map(postPlainText)).toEqual(["one", "", "two"]);
  });

  it("keeps a post holding only a picture", () => {
    expect(splitThread(doc(br, pic("m1"), br))).toEqual([{ content: [pic("m1")] }]);
  });

  it("answers an empty doc with no posts", () => {
    expect(splitThread(doc())).toEqual([]);
  });
});

describe("threadMediaIds", () => {
  it("lists pictures in document order, rows included, each once", () => {
    const thread = doc(pic("m2"), p("x"), row("m1", "m3"), br, pic("m2"), row("m4", "m1"));
    expect(threadMediaIds(thread)).toEqual(["m2", "m1", "m3", "m4"]);
  });

  it("skips a picture with no mediaId", () => {
    expect(threadMediaIds(doc(pic(""), pic("m1")))).toEqual(["m1"]);
  });
});

describe("postPlainText", () => {
  it("reads headings, lists, code and hard breaks, and not captions", () => {
    const [post] = splitThread(
      doc(
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Title" }] },
        { type: "paragraph", content: [{ type: "text", text: "a" }, { type: "hardBreak" }, { type: "text", text: "b" }] },
        { type: "bulletList", content: [{ type: "listItem", content: [p("item") as never] }] },
        { type: "codeBlock", content: [{ type: "text", text: "code" }] },
        pic("m1", { caption: "not counted" }),
      ),
    );
    expect(postPlainText(post)).toBe("Title\na\nb\nitem\ncode");
  });
});

describe("checkThread", () => {
  it("passes a good thread", () => {
    const link = { type: "link" as const, attrs: { href: "https://example.com" } };
    const thread = doc(
      { type: "paragraph", attrs: { size: "small" }, content: [{ type: "text", text: "hi", marks: [{ type: "bold" }, link] }] },
      row("m1", "m2"),
      br,
      pic("m3", { width: 25, alt: "a", caption: "c" }),
    );
    expect(checkThread(thread)).toEqual([]);
  });

  it("refuses something that is not a document", () => {
    expect(codes(null)).toEqual(["not_a_thread"]);
    expect(codes({ type: "doc" })).toEqual(["not_a_thread"]);
  });

  it("refuses more than ten posts", () => {
    const blocks: ThreadBlock[] = [];
    for (let i = 0; i <= MAX_THREAD_POSTS; i++) blocks.push(...(i ? [br] : []), p(`post ${i}`));
    const problems = checkThread(doc(...blocks));
    expect(problems.map((problem) => problem.code)).toEqual(["too_many_posts"]);
    expect(problems[0].post).toBe(MAX_THREAD_POSTS);
    expect(problems[0].message).toMatch(/at most 10/);
  });

  it("refuses more than four pictures in one post, counting rows", () => {
    const problems = checkThread(doc(pic("m1"), row("m2", "m3", "m4"), pic("m5")));
    expect(problems.map((problem) => problem.code)).toEqual(["too_many_post_pictures"]);
    expect(problems[0].post).toBe(0);
    expect(MAX_POST_PICTURES).toBe(4);
  });

  it("refuses more than forty pictures in the thread", () => {
    // Forty-one pictures need eleven posts, so too_many_posts comes too.
    const blocks: ThreadBlock[] = [];
    for (let i = 0; i <= MAX_THREAD_MEDIA; i++) blocks.push(...(i && i % 4 === 0 ? [br] : []), pic(`m${i}`));
    expect(codes(doc(...blocks))).toContain("too_many_thread_pictures");
  });

  it("refuses a post over the body limit, counting code points", () => {
    expect(codes(doc(p("x".repeat(POST_BODY_MAX))))).toEqual([]);
    expect(codes(doc(p("🛠".repeat(POST_BODY_MAX))))).toEqual([]);
    expect(codes(doc(p("x".repeat(POST_BODY_MAX + 1))))).toEqual(["post_too_long"]);
  });

  it("refuses a node not on the list", () => {
    expect(codes(doc({ type: "image", attrs: { src: "x" } } as never))).toEqual(["unknown_node"]);
    expect(codes(doc({ type: "blockquote", content: [p("q")] } as never))).toEqual(["unknown_node"]);
  });

  it("refuses a mark not on the list", () => {
    const thread = doc({ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "strike" }] }] } as never);
    expect(codes(thread)).toEqual(["unknown_mark"]);
  });

  it("refuses a link that is not http, https or mailto", () => {
    const linked = (href: string) =>
      doc({ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href } }] }] });
    expect(codes(linked("javascript:alert(1)"))).toEqual(["bad_link"]);
    expect(codes(linked("/relative"))).toEqual(["bad_link"]);
    expect(codes(linked("mailto:a@b.co"))).toEqual([]);
    expect(codes(linked("http://a.co"))).toEqual([]);
  });

  it("refuses a caption or alt over its limit", () => {
    expect(codes(doc(pic("m1", { caption: "c".repeat(CAPTION_MAX) })))).toEqual([]);
    expect(codes(doc(pic("m1", { caption: "c".repeat(CAPTION_MAX + 1) })))).toEqual(["caption_too_long"]);
    expect(codes(doc(pic("m1", { alt: "a".repeat(ALT_MAX + 1) })))).toEqual(["alt_too_long"]);
  });

  it("refuses a picture outside 25 to 100 percent, and a row of one", () => {
    expect(codes(doc(pic("m1", { width: 10 })))).toEqual(["bad_picture"]);
    expect(codes(doc(row("m1")))).toEqual(["bad_picture"]);
  });

  it("writes each message as a sentence naming the post", () => {
    const [problem] = checkThread(doc(p("a"), br, pic("m1", { caption: "c".repeat(CAPTION_MAX + 1) })));
    expect(problem.post).toBe(1);
    expect(problem.message).toMatch(/^Post 2 .*\.$/);
  });
});

const entry = (id: string, position: number, post_text: string | null = null, size?: [number, number]): ThreadMedia => ({
  id,
  post_position: position,
  post_text,
  width: size?.[0] ?? null,
  height: size?.[1] ?? null,
});

describe("legacyThread", () => {
  it("answers no entries with null", () => {
    expect(legacyThread({ outcome: "It works." }, [])).toBeNull();
    expect(legacyThread({ outcome: "It works." }, [{ ...entry("m1", 0), post_position: null }])).toBeNull();
  });

  it("turns one entry into one post, its text falling back to the outcome", () => {
    expect(legacyThread({ outcome: "It works." }, [entry("m1", 0, null, [800, 600])])).toEqual(
      doc(p("It works."), pic("m1", { w: 800, h: 600 })),
    );
  });

  it("turns four entries into four posts with a break between each, in position order", () => {
    const media = [entry("m3", 3, "three"), entry("m1", 1, "one"), entry("m0", 0, "zero"), entry("m2", 2)];
    expect(legacyThread({ outcome: "Outcome" }, media)).toEqual(
      doc(p("zero"), pic("m0"), br, p("one"), pic("m1"), br, pic("m2"), br, p("three"), pic("m3")),
    );
  });
});

describe("threadOf", () => {
  const media = [entry("m1", 0)];

  it("prefers post_doc when it holds a document", () => {
    const stored = doc(p("new"));
    expect(threadOf({ outcome: "old", post_doc: stored }, media)).toBe(stored);
  });

  it("falls back to the old post when post_doc is null or not a document", () => {
    const legacy = doc(p("old"), pic("m1"));
    expect(threadOf({ outcome: "old", post_doc: null }, media)).toEqual(legacy);
    expect(threadOf({ outcome: "old", post_doc: "nope" }, media)).toEqual(legacy);
    expect(threadOf({ outcome: "old" }, [])).toBeNull();
  });
});

describe("saveThread", () => {
  beforeEach(() => {
    setPostMedia.mockReset();
    updateBuild.mockReset();
  });

  it("writes the set in document order, then the doc", async () => {
    const order: string[] = [];
    setPostMedia.mockImplementation(async () => {
      order.push("set");
      return [];
    });
    updateBuild.mockImplementation(async () => {
      order.push("doc");
      return { id: BUILD_ID };
    });
    const thread = doc(p("a"), pic("m2"), br, row("m1", "m2"));

    await saveThread(BUILD_ID, thread);

    expect(order).toEqual(["set", "doc"]);
    expect(setPostMedia).toHaveBeenCalledWith(BUILD_ID, ["m2", "m1"]);
    expect(updateBuild).toHaveBeenCalledWith(BUILD_ID, { post_doc: thread });
  });

  it("does not write the doc when the set write fails", async () => {
    setPostMedia.mockRejectedValue(new Error("setPostMedia failed: boom"));

    await expect(saveThread(BUILD_ID, doc(pic("m1")))).rejects.toThrow("boom");
    expect(updateBuild).not.toHaveBeenCalled();
  });

  it("refuses a thread with a problem before writing anything", async () => {
    const thread = doc(pic("m1", { caption: "c".repeat(CAPTION_MAX + 1) }));

    await expect(saveThread(BUILD_ID, thread)).rejects.toBeInstanceOf(ThreadError);
    await expect(saveThread(BUILD_ID, thread)).rejects.toMatchObject({ name: "ThreadError", code: "caption_too_long", post: 0 });
    expect(setPostMedia).not.toHaveBeenCalled();
    expect(updateBuild).not.toHaveBeenCalled();
  });
});
