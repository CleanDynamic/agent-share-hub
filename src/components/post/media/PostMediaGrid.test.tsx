// CA-07 P3 — a post's pictures as X draws them: the shape of the block for 1 to 4, the clamp, the badges, the play mark.

import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { GalleryMedia } from "@/lib/build";
import type { PostBlock } from "@/lib/build/thread";
import { PostBody } from "@/components/post/PostBody";

import { BADGE_HEIGHT, PLAY_SIZE, videoLength } from "./GridTile";
import { gridLayout, PostMediaGrid } from "./PostMediaGrid";
import { PICTURE_INK, PICTURE_SHADE } from "./shade";

const row = (id: string, over: Partial<GalleryMedia> = {}): GalleryMedia => ({
  id,
  node_id: null,
  bucket: "build-media",
  path: `p/${id}.png`,
  kind: "image",
  width: 1600,
  height: 900,
  poster_path: null,
  duration: null,
  post_position: null,
  post_text: null,
  ...over,
});
const pic = (mediaId: string, over: Record<string, unknown> = {}) => ({ type: "postMedia", attrs: { mediaId, width: 100, w: 1600, h: 900, alt: "", caption: "", ...over } });
const MEDIA = new Map<string, GalleryMedia>(["a", "b", "c", "d"].map((id) => [id, row(id)]));
const SIGNED = new Map(["a", "b", "c", "d"].map((id) => [`p/${id}.png`, `https://signed.test/${id}.png`]));

const grid = (pictures: unknown[], media = MEDIA, src: ReadonlyMap<string, string> = SIGNED) =>
  render(<PostMediaGrid pictures={pictures} mediaById={media} srcByPath={src} />).container.querySelector("[data-post-media-grid]") as HTMLElement;
const cells = (block: HTMLElement) => Array.from(block.querySelectorAll<HTMLElement>("[data-grid-tile]"));

describe("the block", () => {
  it("is radius 16, a 1px hairline round it, 2px between, on the hairline", () => {
    const block = grid([pic("a"), pic("b")]);
    expect(block.style.borderRadius).toBe("16px");
    expect(block.style.overflow).toBe("hidden");
    expect(block.style.gap).toBe("2px");
    // jsdom drops a var() colour from a React style, so the colours are read from the markup.
    const html = renderToStaticMarkup(<PostMediaGrid pictures={[pic("a"), pic("b")]} mediaById={MEDIA} srcByPath={SIGNED} />);
    expect(html).toContain("border:1px solid var(--hairline);background:var(--hairline)");
    expect(block.getAttribute("role")).toBe("group");
    expect(block.getAttribute("aria-label")).toBe("2 pictures");
  });

  it("1: the picture's own shape, held between 3:4 and 2:1", () => {
    expect(grid([pic("a")]).style.aspectRatio).toBe(String(Math.round((1600 / 900) * 1e4) / 1e4));
    expect(grid([pic("a", { w: 1000, h: 3000 })]).style.aspectRatio).toBe("0.75");
    expect(grid([pic("a", { w: 4000, h: 1000 })]).style.aspectRatio).toBe("2");
  });

  it("1: cuts a tall picture from the top and a wide one from the middle", () => {
    expect(gridLayout([{ w: 1000, h: 3000, crop: null }]).cells[0].align).toBe("top");
    expect(gridLayout([{ w: 4000, h: 1000, crop: null }]).cells[0].align).toBe("middle");
    const tall = grid([pic("a", { w: 1000, h: 3000 })]);
    expect((tall.querySelector("img") as HTMLElement).style.top).toBe("0%");
  });

  it("1: takes its shape after Crop", () => {
    expect(grid([pic("a", { w: 1000, h: 1000, crop: { x: 0, y: 0.21875, w: 1, h: 0.5625 } })]).style.aspectRatio).toBe("1.7778");
  });

  it("2: a 16:9 block, two columns", () => {
    const block = grid([pic("a"), pic("b")]);
    expect(block.style.aspectRatio).toBe("1.7778");
    expect(block.style.gridTemplateColumns).toBe("1fr 1fr");
    expect(block.style.gridTemplateRows).toBe("1fr");
    expect(cells(block)).toHaveLength(2);
  });

  it("3: one tall on the left, two stacked", () => {
    const block = grid([pic("a"), pic("b"), pic("c")]);
    expect(block.style.gridTemplateRows).toBe("1fr 1fr");
    const [first, second, third] = cells(block);
    expect(first.style.gridRow).toBe("1 / span 2");
    expect([second.style.gridColumn, second.style.gridRow, third.style.gridRow]).toEqual(["2", "1", "2"]);
  });

  it("4: two by two in a 16:9 block", () => {
    const block = grid([pic("a"), pic("b"), pic("c"), pic("d")]);
    expect(block.style.aspectRatio).toBe("1.7778");
    expect(cells(block).map((cell) => `${cell.style.gridColumn}/${cell.style.gridRow}`)).toEqual(["1/1", "2/1", "1/2", "2/2"]);
    expect(block.getAttribute("aria-label")).toBe("4 pictures");
  });

  it("keeps its height before anything is signed: tiles with no image, named for a screen reader", () => {
    const block = grid([pic("a"), pic("b")], MEDIA, new Map());
    expect(block.style.aspectRatio).toBe("1.7778");
    expect(block.querySelector("img")).toBeNull();
    expect(renderToStaticMarkup(<PostMediaGrid pictures={[pic("a")]} mediaById={MEDIA} srcByPath={new Map()} />)).toContain("background:var(--tile)");
    expect(Array.from(block.querySelectorAll("[data-tile-empty]")).map((tile) => tile.getAttribute("aria-label"))).toEqual(["Picture 1 of 2", "Picture 2 of 2"]);
  });

  it("reads each picture's alt text, or where it is", () => {
    const block = grid([pic("a", { alt: "The shop front" }), pic("b")]);
    expect(Array.from(block.querySelectorAll("img")).map((img) => img.getAttribute("alt"))).toEqual(["The shop front", "Picture 2 of 2"]);
  });
});

describe("the badges", () => {
  const badges = (block: HTMLElement) => Array.from(block.querySelectorAll<HTMLElement>("[data-badge]")).map((badge) => badge.textContent);

  it("say GIF for a GIF, the length for a video, ALT when there is alt text, 4 apart, bottom left", () => {
    const media = new Map<string, GalleryMedia>([
      ["g", row("g", { path: "p/g.gif" })],
      ["v", row("v", { kind: "video", path: "p/v.mp4", duration: 12 })],
      ["a", row("a")],
    ]);
    const block = grid([pic("g"), pic("v"), pic("a", { alt: "Words" })], media, new Map());
    expect(badges(block)).toEqual(["GIF", "0:12", "ALT"]);
    const row_ = block.querySelector("[data-badges]") as HTMLElement;
    expect([row_.style.left, row_.style.bottom, row_.style.gap]).toEqual(["8px", "8px", "4px"]);
    const badge = block.querySelector("[data-badge]") as HTMLElement;
    expect([badge.style.height, badge.style.borderRadius, badge.style.fontSize, badge.style.fontWeight]).toEqual([`${BADGE_HEIGHT}px`, "4px", "11px", "700"]);
    expect(badge.getAttribute("style")).toContain(PICTURE_SHADE.replace(/,/g, ", "));
  });

  it("put a picture's badges side by side", () => {
    const media = new Map<string, GalleryMedia>([["g", row("g", { path: "p/g.gif" })]]);
    expect(badges(grid([pic("g", { alt: "A loop" })], media, new Map()))).toEqual(["GIF", "ALT"]);
  });

  it("read a video's length from its metadata when the row has none", () => {
    expect(videoLength(65)).toBe("1:05");
    expect(videoLength(3723)).toBe("1:02:03");
    expect(videoLength(null)).toBeNull();
  });
});

describe("a reader's video", () => {
  it("has a 56px round play mark in the middle, a 2px white ring, on the shade, and its still as the poster", () => {
    const media = new Map<string, GalleryMedia>([["v", row("v", { kind: "video", path: "p/v.mp4", poster_path: "p/v.jpg" })]]);
    const src = new Map([["p/v.mp4", "https://signed.test/v.mp4"], ["p/v.jpg", "https://signed.test/v.jpg"]]);
    const block = grid([pic("v")], media, src);
    const mark = block.querySelector("[data-play-mark]") as HTMLElement;
    expect([mark.style.width, mark.style.height, mark.style.borderRadius]).toEqual([`${PLAY_SIZE}px`, `${PLAY_SIZE}px`, "999px"]);
    expect([mark.style.borderWidth, mark.style.borderStyle, mark.style.borderColor]).toEqual(["2px", "solid", PICTURE_INK.toLowerCase()]);
    expect(block.querySelector("video")?.getAttribute("poster")).toBe("https://signed.test/v.jpg");
    expect(block.querySelector("video")?.hasAttribute("controls")).toBe(false);
  });
});

describe("PostBody", () => {
  it("draws an old post's pictures, between lines and in a row, as one grid after the words, and no caption", () => {
    const content = [
      { type: "paragraph", content: [{ type: "text", text: "one" }] },
      pic("a", { caption: "A caption" }),
      { type: "paragraph", content: [{ type: "text", text: "two" }] },
      { type: "postMediaRow", content: [pic("b"), pic("c"), pic("d")] },
    ] as PostBlock[];
    const { container } = render(<PostBody post={{ content }} mediaById={MEDIA} srcByPath={SIGNED} />);
    const body = container.querySelector("[data-post-body]") as HTMLElement;
    expect(Array.from(body.children).map((child) => child.tagName + (child.hasAttribute("data-post-media-grid") ? ":grid" : ""))).toEqual(["P", "P", "DIV:grid"]);
    expect(body.querySelector("[data-post-media-grid]")?.getAttribute("data-count")).toBe("4");
    expect(container.textContent).not.toContain("A caption");
    expect(container.querySelector("figcaption")).toBeNull();
  });
});
