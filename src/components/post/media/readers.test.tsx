// CA-07 P7 — what readers see: old posts as grids, the ALT sheet, the content warning cover, the full screen viewer,
// the Gallery card's grid, and what a screen reader hears.

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { FeedPost } from "@/components/gallery/FeedPost";
import { PostThread } from "@/components/post/PostThread";
import type { GalleryBuild, GalleryMedia } from "@/lib/build";
import { splitThread, type ThreadBlock, type ThreadDoc } from "@/lib/build/thread";

import { MediaViewerProvider } from "./MediaViewer";
import { PostMediaGrid } from "./PostMediaGrid";

afterEach(cleanup);

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
const IDS = ["a", "b", "c", "d"];
const MEDIA = new Map<string, GalleryMedia>(IDS.map((id) => [id, row(id)]));
const SRC = new Map(IDS.map((id) => [`p/${id}.png`, `https://signed.test/${id}.png`]));

function viewerGrid(pictures: unknown[]) {
  return render(
    <MediaViewerProvider>
      <PostMediaGrid pictures={pictures} mediaById={MEDIA} srcByPath={SRC} />
    </MediaViewerProvider>,
  );
}
const viewer = () => screen.getByTestId("media-viewer");

describe("old posts", () => {
  it("are drawn as grids without being saved again: pictures between the lines and a row, captions not shown", () => {
    const old: ThreadDoc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Opening words" }] },
        pic("a", { caption: "Kept, not shown" }),
        { type: "paragraph", content: [{ type: "text", text: "More words" }] },
        { type: "postMediaRow", content: [pic("b"), pic("c"), pic("d")] },
      ] as ThreadBlock[],
    };
    const frozen = JSON.stringify(old);
    render(<PostThread posts={splitThread(old)} mediaById={MEDIA} srcByPath={SRC} mode="page" />);
    const grids = document.querySelectorAll("[data-post-media-grid]");
    expect(grids).toHaveLength(1);
    expect(grids[0].getAttribute("aria-label")).toBe("4 pictures");
    expect(screen.queryByText("Kept, not shown")).toBeNull();
    expect(JSON.stringify(old)).toBe(frozen);
  });
});

describe("the ALT badge", () => {
  it("is a button that opens Image description from the bottom, with Dismiss, and focus goes back to it", async () => {
    render(<PostMediaGrid pictures={[pic("a", { alt: "The shop front at dawn" })]} mediaById={MEDIA} srcByPath={SRC} />);
    const badge = screen.getByRole("button", { name: "Image description" });
    fireEvent.click(badge);
    const sheet = await screen.findByTestId("alt-sheet");
    expect(within(sheet).getByRole("heading", { name: "Image description" })).toBeInTheDocument();
    expect(within(sheet).getByText("The shop front at dawn")).toBeInTheDocument();
    expect(sheet.style.bottom).toBe("0px");
    fireEvent.click(within(sheet).getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(screen.queryByTestId("alt-sheet")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(badge));
  });

  it("closes on Esc", async () => {
    render(<PostMediaGrid pictures={[pic("a", { alt: "Words" })]} mediaById={MEDIA} srcByPath={SRC} />);
    fireEvent.click(screen.getByRole("button", { name: "Image description" }));
    fireEvent.keyDown(await screen.findByTestId("alt-sheet"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("alt-sheet")).toBeNull());
  });
});

describe("a content warning", () => {
  it("covers the picture, blurred, with the warning names, the line and Show, and the viewer stays shut", () => {
    viewerGrid([pic("a", { warn: ["violence", "sensitive"] })]);
    const img = document.querySelector("[data-grid-tile] img") as HTMLElement;
    expect(img.style.filter).toBe("blur(28px)");
    expect(img.style.transform).toBe("scale(1.1)");
    expect(screen.getByText("Content warning: Violence, Sensitive")).toBeInTheDocument();
    expect(screen.getByText("The maker flagged this picture.")).toBeInTheDocument();
    expect(document.querySelector("[data-open-viewer]")).toBeNull();
    const show = screen.getByRole("button", { name: "Show" });
    expect(show.style.borderRadius).toBe("999px");
    fireEvent.click(show);
    expect(screen.queryByText(/Content warning/)).toBeNull();
    expect((document.querySelector("[data-grid-tile] img") as HTMLElement).style.filter).toBe("");
    expect(document.querySelector("[data-open-viewer]")).not.toBeNull();
  });
});

describe("the full screen viewer", () => {
  it("opens on the picture pressed, says 2 / 4, shows the whole original, and moves with the arrows and the keys", async () => {
    viewerGrid([pic("a"), pic("b", { crop: { x: 0.25, y: 0, w: 0.5, h: 1 } }), pic("c"), pic("d")]);
    const opener = document.querySelectorAll<HTMLElement>("[data-open-viewer]")[1];
    fireEvent.click(opener);
    await screen.findByTestId("media-viewer");
    expect(within(viewer()).getByText("2 / 4")).toBeInTheDocument();
    const media = viewer().querySelector("[data-viewer-media]") as HTMLImageElement;
    expect(media.getAttribute("src")).toBe("https://signed.test/b.png");
    // Contained and whole: never the crop's percentages.
    expect(media.style.objectFit).toBe("contain");
    expect(media.style.left).toBe("");
    fireEvent.click(within(viewer()).getByRole("button", { name: "Next picture" }));
    expect(within(viewer()).getByText("3 / 4")).toBeInTheDocument();
    fireEvent.keyDown(viewer().firstElementChild as HTMLElement, { key: "ArrowRight" });
    expect(within(viewer()).getByText("4 / 4")).toBeInTheDocument();
    expect(within(viewer()).queryByRole("button", { name: "Next picture" })).toBeNull();
    fireEvent.keyDown(viewer().firstElementChild as HTMLElement, { key: "ArrowLeft" });
    fireEvent.keyDown(viewer().firstElementChild as HTMLElement, { key: "ArrowLeft" });
    fireEvent.keyDown(viewer().firstElementChild as HTMLElement, { key: "ArrowLeft" });
    expect(within(viewer()).getByText("1 / 4")).toBeInTheDocument();
    expect(within(viewer()).queryByRole("button", { name: "Previous picture" })).toBeNull();
  });

  it("opens on Enter on a picture, has a round Close at the top left, closes on Esc, and focus goes back", async () => {
    viewerGrid([pic("a", { alt: "Shop" })]);
    const opener = document.querySelector<HTMLElement>("[data-open-viewer]") as HTMLElement;
    opener.focus();
    fireEvent.keyDown(opener, { key: "Enter" });
    fireEvent.click(opener);
    await screen.findByTestId("media-viewer");
    const close = within(viewer()).getByRole("button", { name: "Close" });
    expect([close.style.top, close.style.left, close.style.borderRadius]).toEqual(["16px", "16px", "999px"]);
    // One picture: no count and no arrows; its ALT badge at the bottom left.
    expect(viewer().querySelector("[data-viewer-count]")).toBeNull();
    expect(within(viewer()).getByRole("button", { name: "Image description" }).style.left).toBe("16px");
    fireEvent.keyDown(viewer(), { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("media-viewer")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("moves with a sideways swipe and closes with a swipe down", async () => {
    viewerGrid([pic("a"), pic("b")]);
    fireEvent.click(document.querySelector("[data-open-viewer]") as HTMLElement);
    await screen.findByTestId("media-viewer");
    const surface = viewer().firstElementChild as HTMLElement;
    // jsdom has no PointerEvent; a mouse event of the pointer's name carries the coordinates.
    const pointer = (type: string, clientX: number, clientY: number) => fireEvent(surface, new MouseEvent(type, { bubbles: true, clientX, clientY }));
    pointer("pointerdown", 300, 300);
    pointer("pointerup", 150, 310);
    expect(within(viewer()).getByText("2 / 2")).toBeInTheDocument();
    pointer("pointerdown", 300, 200);
    pointer("pointerup", 305, 400);
    await waitFor(() => expect(screen.queryByTestId("media-viewer")).toBeNull());
  });

  it("plays a video with its controls", async () => {
    const media = new Map<string, GalleryMedia>([["v", row("v", { kind: "video", path: "p/v.mp4" })]]);
    render(
      <MediaViewerProvider>
        <PostMediaGrid pictures={[pic("v")]} mediaById={media} srcByPath={new Map([["p/v.mp4", "https://signed.test/v.mp4"]])} />
      </MediaViewerProvider>,
    );
    fireEvent.click(document.querySelector("[data-open-viewer]") as HTMLElement);
    const video = (await screen.findByTestId("media-viewer")).querySelector("video") as HTMLVideoElement;
    expect(video.hasAttribute("controls")).toBe(true);
    expect(video.getAttribute("src")).toBe("https://signed.test/v.mp4");
  });

  it("is only where a provider is: no opener on a grid without one", () => {
    render(<PostMediaGrid pictures={[pic("a")]} mediaById={MEDIA} srcByPath={SRC} />);
    expect(document.querySelector("[data-open-viewer]")).toBeNull();
  });
});

describe("a Gallery card", () => {
  const build = (doc: ThreadDoc) =>
    ({
      id: "b1",
      slug: "crumb",
      title: "Crumb",
      creator_id: "u1",
      made_with: [],
      post_doc: doc,
      media: IDS.map((id) => row(id)),
      nodes: [],
      created_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
    }) as unknown as GalleryBuild;

  it("draws the same grid, with no viewer and no Show the whole picture", () => {
    const doc: ThreadDoc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }, pic("a", { w: 1170, h: 2532 })] as ThreadBlock[] };
    render(
      <MemoryRouter>
        <FeedPost build={build(doc)} srcByPath={SRC} makerHandle="sam" makerName="Sam" makerAvatar={null} modelsUsed={[]} />
      </MemoryRouter>,
    );
    const grid = document.querySelector("[data-post-media-grid]") as HTMLElement;
    expect(grid).not.toBeNull();
    // The 3:4 clamp replaces the old tall cap.
    expect(grid.style.aspectRatio).toBe("0.75");
    expect(screen.queryByRole("button", { name: "Show the whole picture" })).toBeNull();
    expect(document.querySelector("[data-open-viewer]")).toBeNull();
    expect(screen.getByTestId("feed-build-title").getAttribute("href")).toBe("/b2/crumb");
  });
});

describe("screen readers", () => {
  it("hear each tile's alt text, or Picture 2 of 4, Video or GIF, in a group named by the count", () => {
    const media = new Map<string, GalleryMedia>([...MEDIA, ["v", row("v", { kind: "video", path: "p/v.mp4" })], ["g", row("g", { path: "p/g.gif" })]]);
    act(() => {
      render(<PostMediaGrid pictures={[pic("a", { alt: "The counter" }), pic("b"), pic("v"), pic("g")]} mediaById={media} srcByPath={new Map()} />);
    });
    const group = screen.getByRole("group", { name: "4 pictures" });
    expect(within(group).getAllByRole("img").map((one) => one.getAttribute("aria-label"))).toEqual(["The counter", "Picture 2 of 4", "Video", "GIF"]);
  });
});
