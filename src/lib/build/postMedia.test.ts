// PT-06 — the rules of pictures in a post, with no editor: sizes, limits, refusals and moves.

import { describe, expect, it } from "vitest";

import {
  limitText,
  moveBlock,
  newPicture,
  newRow,
  pictureRejection,
  POST_FULL_SENTENCE,
  postPictureCounts,
  roomAt,
  ROW_FULL_SENTENCE,
  snapWidth,
  stepGap,
  stepWidth,
  THREAD_FULL_SENTENCE,
  widthFromPointer,
  withoutPicture,
} from "./postMedia";
import { MAX_POST_PICTURES, MAX_THREAD_MEDIA, type ThreadBlock, type ThreadDoc } from "./thread";
import { MEDIA_MAX_BYTES } from "./media";

const pic = (id: string, over = {}) => newPicture({ mediaId: id, w: 800, h: 600, ...over });
const para = (text: string): ThreadBlock => ({ type: "paragraph", content: [{ type: "text", text }] });
const doc = (...content: ThreadBlock[]): ThreadDoc => ({ type: "doc", content });
const file = (name: string, type: string, size = 10) => ({ name, type, size }) as File;
const ids = (d: ThreadDoc) => d.content.map((block) => (block.type === "postMedia" ? block.attrs.mediaId : block.type === "postMediaRow" ? block.content.map((c) => c.attrs.mediaId).join("+") : block.type));

describe("the sizes", () => {
  it("snaps to 40, 60, 80 and 100 within 3 points and nowhere else", () => {
    expect(snapWidth(43)).toBe(40);
    expect(snapWidth(37)).toBe(40);
    expect(snapWidth(63)).toBe(60);
    expect(snapWidth(83)).toBe(80);
    expect(snapWidth(97)).toBe(100);
    expect(snapWidth(44)).toBe(44);
    expect(snapWidth(51.4)).toBe(51);
    expect(snapWidth(88)).toBe(88);
  });

  it("holds a drag to 25 through 100", () => {
    expect(snapWidth(3)).toBe(25);
    expect(snapWidth(140)).toBe(100);
    expect(snapWidth(Number.NaN)).toBe(100);
  });

  it("steps through the four sizes, from a size that is not one of them too", () => {
    expect(stepWidth(100, -1)).toBe(80);
    expect(stepWidth(80, -1)).toBe(60);
    expect(stepWidth(60, -1)).toBe(40);
    expect(stepWidth(40, -1)).toBe(40);
    expect(stepWidth(40, 1)).toBe(60);
    expect(stepWidth(100, 1)).toBe(100);
    expect(stepWidth(50, 1)).toBe(60);
    expect(stepWidth(50, -1)).toBe(40);
    expect(stepWidth(25, -1)).toBe(40);
  });

  it("reads a drag on the corner as twice the distance from the column's centre", () => {
    const column = { left: 100, width: 600 };
    expect(widthFromPointer(100 + 300 + 0.6 * 300, column)).toBe(60);
    expect(widthFromPointer(100 + 300 + 0.62 * 300, column)).toBe(60);
    expect(widthFromPointer(100 + 300 + 0.7 * 300, column)).toBe(70);
    expect(widthFromPointer(100 + 300 + 50 * 300, column)).toBe(100);
    expect(widthFromPointer(100, column)).toBe(25);
  });
});

describe("the files", () => {
  it("accepts a picture and a video under the limit", () => {
    expect(pictureRejection(file("a.png", "image/png"))).toBeNull();
    expect(pictureRejection(file("a.mp4", "video/mp4"))).toBeNull();
  });

  it("names the file and the limit when it is too large", () => {
    const sentence = pictureRejection(file("big.mov", "video/quicktime", MEDIA_MAX_BYTES + 1024 * 1024)) as string;
    expect(sentence).toContain("big.mov");
    expect(sentence).toContain("26.0MB");
    expect(sentence).toContain("25.0MB");
    expect(sentence).toContain("not uploaded");
    expect(sentence).not.toContain("—");
  });

  it("refuses what is neither a picture nor a video, naming the file", () => {
    const sentence = pictureRejection(file("notes.pdf", "application/pdf")) as string;
    expect(sentence).toContain("notes.pdf");
    expect(sentence).toContain("pictures and videos");
    expect(pictureRejection(file("song.mp3", "audio/mpeg"))).not.toBeNull();
  });
});

describe("the limits", () => {
  const full = doc(pic("a"), pic("b"), pic("c"), pic("d"), para("text"));

  it("says what the product says when a fifth picture is added to a post", () => {
    expect(POST_FULL_SENTENCE).toBe("A post holds 4 pictures. Start a new post or remove one.");
    expect(roomAt(full, 5, 1)).toEqual({ allowed: 0, sentence: POST_FULL_SENTENCE });
  });

  it("counts a row's pictures and the ones still uploading", () => {
    const d = doc(newRow([pic("a"), pic("b")]), newPicture({ uploadId: "u" }), { type: "postBreak" }, pic("c"));
    expect(postPictureCounts(d)).toEqual([3, 1]);
    // Gap 2 is the end of the first post, gap 3 the start of the second.
    expect(roomAt(d, 2, 2)).toEqual({ allowed: 1, sentence: POST_FULL_SENTENCE });
    expect(roomAt(d, 3, 2)).toEqual({ allowed: 2, sentence: null });
  });

  it("holds the thread to its own limit", () => {
    const posts: ThreadBlock[] = [];
    for (let post = 0; post < 10; post++) {
      if (post > 0) posts.push({ type: "postBreak" });
      for (let at = 0; at < 4; at++) posts.push(pic(`m${post}-${at}`));
    }
    const room = roomAt(doc(...posts), posts.length, 1);
    expect(MAX_THREAD_MEDIA).toBe(MAX_POST_PICTURES * 10);
    expect(room).toEqual({ allowed: 0, sentence: POST_FULL_SENTENCE });
    expect(THREAD_FULL_SENTENCE).toContain("40");
  });
});

describe("moving a block", () => {
  it("moves a block up and down by one place, and not past either end", () => {
    const d = doc(para("one"), para("two"), para("three"));
    const down = moveBlock(d, { top: 0 }, { gap: stepGap(0, 1) });
    expect(down && "doc" in down && down.doc.content.map((b) => (b.type === "paragraph" ? b.content?.[0] : null))).toMatchObject([{ text: "two" }, { text: "one" }, { text: "three" }]);
    expect(moveBlock(d, { top: 0 }, { gap: stepGap(0, -1) })).toBeNull();
    expect(moveBlock(d, { top: 2 }, { gap: stepGap(2, 1) })).toBeNull();
    const up = moveBlock(d, { top: 2 }, { gap: stepGap(2, -1) });
    expect(up && "at" in up && up.at).toEqual({ top: 1 });
  });

  it("makes a row of two when a picture is dropped on the edge of another", () => {
    const d = doc(pic("a"), para("x"), pic("b"));
    const right = moveBlock(d, { top: 2 }, { beside: { top: 0 }, side: "right" });
    expect(right && "doc" in right && ids(right.doc)).toEqual(["a+b", "paragraph"]);
    const left = moveBlock(d, { top: 2 }, { beside: { top: 0 }, side: "left" });
    expect(left && "doc" in left && ids(left.doc)).toEqual(["b+a", "paragraph"]);
  });

  it("adds to a row up to three, then refuses", () => {
    const d = doc(newRow([pic("a"), pic("b")]), pic("c"), pic("d"));
    const three = moveBlock(d, { top: 1 }, { beside: { top: 0, child: 1 }, side: "right" });
    expect(three && "doc" in three && ids(three.doc)).toEqual(["a+b+c", "d"]);
    const four = moveBlock((three as { doc: ThreadDoc }).doc, { top: 1 }, { beside: { top: 0, child: 0 }, side: "left" });
    expect(four).toEqual({ refused: ROW_FULL_SENTENCE });
  });

  it("makes a picture single again when it is dragged out of a row, and a row of one disappears", () => {
    const d = doc(newRow([pic("a"), pic("b")]), para("x"));
    const out = moveBlock(d, { top: 0, child: 0 }, { gap: 2 });
    expect(out && "doc" in out && ids(out.doc)).toEqual(["b", "paragraph", "a"]);

    const three = doc(newRow([pic("a"), pic("b"), pic("c")]));
    const two = moveBlock(three, { top: 0, child: 1 }, { gap: 1 });
    expect(two && "doc" in two && ids(two.doc)).toEqual(["a+c", "b"]);
  });

  it("reorders inside a row by dropping on the edge of a sibling", () => {
    const d = doc(newRow([pic("a"), pic("b")]));
    const swapped = moveBlock(d, { top: 0, child: 0 }, { beside: { top: 0, child: 1 }, side: "right" });
    expect(swapped && "doc" in swapped && ids(swapped.doc)).toEqual(["b+a"]);
  });

  it("will not drop a row on a picture, a picture on itself or a block on a break", () => {
    const d = doc(newRow([pic("a"), pic("b")]), pic("c"), { type: "postBreak" });
    expect(moveBlock(d, { top: 0 }, { beside: { top: 1 }, side: "left" })).toBeNull();
    expect(moveBlock(d, { top: 1 }, { beside: { top: 1 }, side: "left" })).toBeNull();
    expect(moveBlock(d, { top: 2 }, { gap: 0 })).toBeNull();
  });

  it("refuses to move a picture into a post that already holds four", () => {
    const d = doc(pic("a"), pic("b"), pic("c"), pic("d"), { type: "postBreak" }, pic("e"));
    const result = moveBlock(d, { top: 5 }, { gap: 0 });
    expect(result).toEqual({ refused: POST_FULL_SENTENCE });
    expect(moveBlock(d, { top: 0 }, { gap: 6 })).not.toEqual({ refused: POST_FULL_SENTENCE });
  });

  it("takes a picture out of a row and leaves a single picture behind", () => {
    const d = doc(newRow([pic("a"), pic("b")]));
    expect(ids(withoutPicture(d, { top: 0, child: 1 }))).toEqual(["a"]);
    expect(ids(withoutPicture(doc(pic("a"), pic("b")), { top: 0 }))).toEqual(["b"]);
  });
});

describe("text", () => {
  it("is cut at a number of characters, an emoji counting one", () => {
    expect(limitText("abcdef", 3)).toBe("abc");
    expect(limitText("🛠🛠🛠", 2)).toBe("🛠🛠");
    expect(limitText("ab", 3)).toBe("ab");
  });
});
