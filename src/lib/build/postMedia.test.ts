// PT-06, CA-07 — the rules of pictures in a post, with no editor: refusals, the sentences and a new picture. CA-07 took
// out the sizes, the rows and the moves; the editor's grid is tested in PostTab.grid.test.tsx.

import { describe, expect, it } from "vitest";

import { limitText, newPicture, pictureRejection, POST_FULL_SENTENCE, THREAD_FULL_SENTENCE } from "./postMedia";
import { MAX_POST_PICTURES, MAX_THREAD_MEDIA } from "./thread";
import { MEDIA_MAX_BYTES } from "./media";

const file = (name: string, type: string, size = 10) => ({ name, type, size }) as File;

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
    expect(sentence).not.toContain("\u2014");
  });

  it("refuses what is neither a picture nor a video, naming the file", () => {
    const sentence = pictureRejection(file("notes.pdf", "application/pdf")) as string;
    expect(sentence).toContain("notes.pdf");
    expect(sentence).toContain("pictures and videos");
    expect(pictureRejection(file("song.mp3", "audio/mpeg"))).not.toBeNull();
  });
});

describe("the limits", () => {
  it("says what the product says when a post or the thread is full", () => {
    expect(POST_FULL_SENTENCE).toBe("A post holds 4 pictures. Start a new post or remove one.");
    expect(THREAD_FULL_SENTENCE).toBe("A thread holds 40 pictures. Remove one before adding another.");
    expect(MAX_THREAD_MEDIA).toBe(MAX_POST_PICTURES * 10);
  });
});

describe("a new picture", () => {
  it("has no file, no description, crop or warning yet", () => {
    expect(newPicture({ uploadId: "u" }).attrs).toMatchObject({ mediaId: "", alt: "", crop: null, aspect: null, zoom: null, warn: [], uploadId: "u" });
  });
});

describe("text", () => {
  it("is cut at a number of characters, an emoji counting one", () => {
    expect(limitText("abcdef", 3)).toBe("abc");
    expect(limitText("\u{1F6E0}\u{1F6E0}\u{1F6E0}", 2)).toBe("\u{1F6E0}\u{1F6E0}");
    expect(limitText("ab", 3)).toBe("ab");
  });
});
