// CA-07 P4 — pictures in the composer, as X adds them: into the right post's grid, the limits, drop and paste, the
// file shown at once with its bar, stopping, a failed upload and Retry, removing, reordering, the keys and the strip.

import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { uploadMedia } = vi.hoisted(() => ({ uploadMedia: vi.fn() }));

vi.mock("@/lib/build/media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build/media")>()),
  uploadMedia,
  probeFile: vi.fn(async () => ({ width: 900, height: 300, duration: null })),
  signedMediaUrl: vi.fn(async (ref: { path: string }) => `https://signed.test/${ref.path}`),
}));

import { POST_FULL_TITLE } from "@/components/post/editor/PostToolbar";
import { movedSentence, UPLOADING_OPACITY } from "@/components/post/editor/GridView";
import { postSpans } from "@/components/post/editor/pictures";
import { MEDIA_MAX_BYTES } from "@/lib/build/media";
import { POST_FULL_SENTENCE, THREAD_FULL_SENTENCE } from "@/lib/build/postMedia";
import type { ThreadBlock, ThreadDoc, ThreadPostMedia } from "@/lib/build/thread";
import { holdSentence, tidyThread } from "@/lib/build/threadEditor";

import { brk, doc, mountPostTab as mount, p, startOf } from "./postTabKit";

(document as unknown as { elementFromPoint: () => null }).elementFromPoint ??= () => null;

const BUILD_ID = "00000000-0000-4000-8000-000000000001";
const pic = (mediaId: string): ThreadPostMedia => ({ type: "postMedia", attrs: { mediaId, width: 100, w: 800, h: 600, alt: "", crop: null, aspect: null, zoom: null, warn: [], caption: "" } });
const grid = (...pictures: ThreadPostMedia[]): ThreadBlock => ({ type: "postMediaGrid", attrs: { step: null }, content: pictures });
const file = (name = "harbour.png", type = "image/png") => new File(["x"], name, { type });
const json = (editor: Editor) => editor.getJSON() as ThreadDoc;
const gridsOf = (editor: Editor) => json(editor).content.map((block, index) => [index, block] as const).filter(([, block]) => block.type === "postMediaGrid");
const idsIn = (editor: Editor, post: number) => {
  const span = postSpans(editor.state.doc)[post];
  const out: string[] = [];
  span.grid?.node.forEach((child) => out.push(child.attrs.mediaId || `up:${child.attrs.uploadId ? "yes" : "no"}`));
  return out;
};
const tiles = () => Array.from(document.querySelectorAll<HTMLElement>("[data-grid-view] [data-grid-tile]"));
/** Node views are React portals; wait until `count` tiles are drawn. */
async function drawn(count = 1) {
  await waitFor(() => expect(tiles().length).toBeGreaterThanOrEqual(count));
}

function media(id: string, over: Record<string, unknown> = {}) {
  return { id, build_id: BUILD_ID, node_id: null, bucket: "build-media", path: `${BUILD_ID}/unplaced/${id}.png`, kind: "image", mime: "image/png", bytes: 10, width: 1200, height: 800, duration: null, poster_path: null, created_at: "", ...over };
}

/** The caret into the top-level block at `index`. */
function caretAt(editor: Editor, index: number) {
  act(() => {
    editor.commands.setTextSelection(startOf(editor, index));
  });
}

async function choose(editor: Editor, files: File[]) {
  fireEvent.click(within(screen.getByTestId("post-toolbar")).getByRole("button", { name: "Picture or video" }));
  const input = screen.getByTestId("post-picture-file") as HTMLInputElement;
  expect(input.multiple).toBe(true);
  Object.defineProperty(input, "files", { value: files, configurable: true });
  await act(async () => {
    fireEvent.change(input);
  });
  void editor;
}

function fileDrag(type: "dragover" | "drop", target: Element, files: File[], clientY = 4) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientY });
  Object.defineProperty(event, "dataTransfer", { value: { files, types: ["Files"], getData: () => "", dropEffect: "copy" } });
  fireEvent(target, event);
  return event;
}

let urls = 0;
beforeEach(() => {
  urls = 0;
  vi.stubGlobal("URL", Object.assign(globalThis.URL, { createObjectURL: vi.fn(() => `blob:local/${++urls}`), revokeObjectURL: vi.fn() }));
  uploadMedia.mockReset();
  let n = 0;
  uploadMedia.mockImplementation(async ({ onProgress }: { onProgress?: (fraction: number) => void }) => {
    onProgress?.(1);
    n += 1;
    return media(`m-new-${n}`);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("where pictures go", () => {
  it("into the grid of the post the caret is in, made at its end, several files at once", async () => {
    const { editor } = mount(doc(p("one"), brk, p("two"), p("more")));
    caretAt(editor, 2);
    await choose(editor, [file("a.png"), file("b.png")]);
    await waitFor(() => expect(idsIn(editor, 1)).toEqual(["m-new-1", "m-new-2"]));
    expect(json(editor).content.map((block) => block.type)).toEqual(["paragraph", "postBreak", "paragraph", "paragraph", "postMediaGrid"]);
    expect(uploadMedia).toHaveBeenCalledWith(expect.objectContaining({ buildId: BUILD_ID }));
  });

  it("adds to a post's grid that is already there", async () => {
    const { editor } = mount(doc(p("one"), grid(pic("a"))));
    caretAt(editor, 0);
    await choose(editor, [file()]);
    await waitFor(() => expect(idsIn(editor, 0)).toEqual(["a", "m-new-1"]));
    expect(gridsOf(editor)).toHaveLength(1);
  });

  it("mixes a video with pictures", async () => {
    const { editor } = mount(doc(p("one")));
    caretAt(editor, 0);
    await choose(editor, [file("a.png"), file("clip.mp4", "video/mp4")]);
    await waitFor(() => expect(idsIn(editor, 0)).toHaveLength(2));
    expect(screen.queryByText(POST_FULL_SENTENCE)).toBeNull();
  });
});

describe("the limits", () => {
  it("takes the first that fit of a fifth, in the order chosen, and says why", async () => {
    const { editor } = mount(doc(p("one"), grid(pic("a"), pic("b"), pic("c"))));
    caretAt(editor, 0);
    await choose(editor, [file("first.png"), file("second.png")]);
    await waitFor(() => expect(idsIn(editor, 0)).toEqual(["a", "b", "c", "m-new-1"]));
    expect(uploadMedia).toHaveBeenCalledTimes(1);
    expect((uploadMedia.mock.calls[0][0] as { file: File }).file.name).toBe("first.png");
    expect(await screen.findByText(POST_FULL_SENTENCE)).toBeInTheDocument();
  });

  it("refuses a forty-first in the thread", async () => {
    const posts: ThreadBlock[] = [];
    for (let post = 0; post < 10; post++) {
      if (post) posts.push(brk);
      posts.push(p(`post ${post}`), grid(pic(`a${post}`), pic(`b${post}`), pic(`c${post}`), pic(`d${post}`)));
    }
    const { editor } = mount(doc(...posts, brk, p("eleventh")));
    caretAt(editor, editor.state.doc.childCount - 1);
    await choose(editor, [file()]);
    expect(await screen.findByText(THREAD_FULL_SENTENCE)).toBeInTheDocument();
    expect(uploadMedia).not.toHaveBeenCalled();
  });

  it("refuses a file too big or of the wrong type with pictureRejection's sentence", async () => {
    const { editor } = mount(doc(p("one")));
    caretAt(editor, 0);
    const big = file("huge.png");
    Object.defineProperty(big, "size", { value: MEDIA_MAX_BYTES + 1 });
    await choose(editor, [big, file("notes.txt", "text/plain")]);
    expect(await screen.findByText(/huge\.png is .*MB\. A picture or video has to be under/)).toBeInTheDocument();
    expect(screen.getByText(/notes\.txt is text\/plain\. A post holds pictures and videos/)).toBeInTheDocument();
    expect(uploadMedia).not.toHaveBeenCalled();
  });

  it("turns Picture or video off at four, with the title A post holds 4 pictures", () => {
    const { editor } = mount(doc(p("one"), grid(pic("a"), pic("b"), pic("c"), pic("d")), brk, p("two")));
    caretAt(editor, 0);
    const button = within(screen.getByTestId("post-toolbar")).getByRole("button", { name: "Picture or video" });
    expect(button).toBeDisabled();
    expect(button.getAttribute("title")).toBe(POST_FULL_TITLE);
    expect(POST_FULL_TITLE).toBe("A post holds 4 pictures");
    caretAt(editor, 3);
    expect(within(screen.getByTestId("post-toolbar")).getByRole("button", { name: "Picture or video" })).not.toBeDisabled();
  });
});

describe("drop and paste", () => {
  it("puts files dropped on a post into that post's grid, outlining the post while they are over it", async () => {
    const { editor } = mount(doc(p("one"), brk, p("two")));
    // jsdom lays nothing out: post 2 starts 12 down (the gap after its 0-high break), so 20 is over it.
    const words = screen.getByTestId("post-words");
    fileDrag("dragover", words, [file()], 20);
    const outline = screen.getByTestId("post-drop-target");
    expect(outline.getAttribute("style")).toContain("border-radius: 16px");
    // (jsdom drops a border written with a var() colour; the 2px dashed --label line is read in the source.)
    expect(outline.style.left).toBe("-4px");
    expect(outline.getAttribute("data-post")).toBe("1");
    const event = fileDrag("drop", editor.view.dom, [file()], 20);
    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(idsIn(editor, 1)).toEqual(["m-new-1"]));
    expect(screen.queryByTestId("post-drop-target")).toBeNull();
  });

  it("does nothing with files dropped elsewhere on the page, and keeps the browser from opening them", () => {
    const { editor } = mount(doc(p("one")));
    const event = fileDrag("drop", document.body, [file()]);
    expect(event.defaultPrevented).toBe(true);
    expect(gridsOf(editor)).toHaveLength(0);
    expect(uploadMedia).not.toHaveBeenCalled();
  });

  it("puts a pasted picture in the post holding the caret, and leaves a pasted link a link", async () => {
    const { editor } = mount(doc(p("one"), brk, p("two")));
    caretAt(editor, 2);
    const paste = new Event("paste", { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
    paste.clipboardData = { files: [file()], getData: () => "", types: ["Files"] };
    act(() => {
      editor.view.dom.dispatchEvent(paste);
    });
    await waitFor(() => expect(idsIn(editor, 1)).toEqual(["m-new-1"]));
    expect(idsIn(editor, 0)).toEqual([]);
  });
});

describe("while it uploads", () => {
  let finish: (row?: ReturnType<typeof media>) => void = () => undefined;
  let fail: () => void = () => undefined;
  beforeEach(() => {
    uploadMedia.mockImplementation(({ onProgress }: { onProgress?: (fraction: number) => void }) => {
      onProgress?.(0.4);
      return new Promise((resolve, reject) => {
        finish = (row = media("m-late")) => resolve(row);
        fail = () => reject(new Error("offline"));
      });
    });
  });

  it("shows the file itself at 55% with a bar along the bottom, and no Edit", async () => {
    const { editor } = mount(doc(p("one")));
    caretAt(editor, 0);
    await choose(editor, [file()]);
    const bar = await screen.findByRole("progressbar", { name: "Uploading" });
    expect(bar.getAttribute("aria-valuenow")).toBe("40");
    expect(bar.style.height).toBe("3px");
    expect((bar.firstElementChild as HTMLElement).style.width).toBe("40%");
    const img = tiles()[0].querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("blob:local/1");
    expect(img.style.opacity).toBe(String(UPLOADING_OPACITY));
    expect(tiles()[0].querySelector("[data-edit-pill]")).toBeNull();
    expect(within(tiles()[0]).getByRole("button", { name: "Stop uploading" })).toBeInTheDocument();
    // The save waits.
    expect(holdSentence(json(editor))).toContain("has not finished uploading");
  });

  it("stops: the tile goes, the late result is ignored, and the file's URL is let go", async () => {
    const { editor } = mount(doc(p("one")));
    caretAt(editor, 0);
    await choose(editor, [file()]);
    fireEvent.click(await screen.findByRole("button", { name: "Stop uploading" }));
    expect(gridsOf(editor)).toHaveLength(0);
    await act(async () => finish());
    expect(gridsOf(editor)).toHaveLength(0);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:local/1");
  });

  it("stays at 30% with Did not upload and Retry when it fails, the save naming it, and Retry starts the same file", async () => {
    const { editor } = mount(doc(p("one"), p("two"), grid(pic("a"))));
    caretAt(editor, 0);
    await choose(editor, [file("again.png")]);
    await act(async () => fail());
    expect(await screen.findByText("Did not upload")).toBeInTheDocument();
    const tile = tiles()[1];
    expect((tile.querySelector("img") as HTMLElement).style.opacity).toBe("0.3");
    expect(holdSentence(json(editor))).toBe("Picture 2 in post 1 did not upload. Retry it or remove it.");
    // Still in the document with no mediaId: it never saves half done.
    expect(JSON.stringify(tidyThread(json(editor)))).toContain('"mediaId":""');
    fireEvent.click(within(tile).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(uploadMedia).toHaveBeenCalledTimes(2));
    expect((uploadMedia.mock.calls[1][0] as { file: File }).file.name).toBe("again.png");
    await act(async () => finish(media("m-retried")));
    await waitFor(() => expect(idsIn(editor, 0)).toEqual(["a", "m-retried"]));
    expect(holdSentence(json(editor))).toBeNull();
  });
});

describe("a finished picture", () => {
  it("is removed with × in one step that Undo puts back; the last one takes the grid", async () => {
    const { editor } = mount(doc(p("one"), grid(pic("a"), pic("b"))));
    await drawn(2);
    const remove = within(tiles()[0]).getByRole("button", { name: "Remove" });
    const shape = remove.querySelector("[data-shape]") as HTMLElement;
    expect([shape.style.minWidth, shape.style.height, shape.style.borderRadius]).toEqual(["32px", "32px", "999px"]);
    expect([remove.style.top, remove.style.right]).toEqual(["8px", "8px"]);
    fireEvent.click(remove);
    expect(idsIn(editor, 0)).toEqual(["b"]);
    act(() => {
      editor.commands.undo();
    });
    expect(idsIn(editor, 0)).toEqual(["a", "b"]);
    fireEvent.click(within(tiles()[0]).getByRole("button", { name: "Remove" }));
    fireEvent.click(within(tiles()[0]).getByRole("button", { name: "Remove" }));
    expect(gridsOf(editor)).toHaveLength(0);
  });

  it("has Edit at the top left: 30 tall, round, on the shade, white Edit at 13 / 600", async () => {
    mount(doc(p("one"), grid(pic("a"))));
    await drawn(1);
    const pill = tiles()[0].querySelector("[data-edit-pill]") as HTMLElement;
    expect([pill.style.top, pill.style.left]).toEqual(["8px", "8px"]);
    const shape = pill.firstElementChild as HTMLElement;
    expect([shape.style.height, shape.style.borderRadius, shape.style.fontSize, shape.style.fontWeight, shape.textContent]).toEqual(["30px", "999px", "13px", "600", "Edit"]);
  });

  it("opens Edit on Enter, on Crop for a picture, and goes on Backspace or Delete", async () => {
    const { editor, view } = mount(doc(p("one"), grid(pic("a"), pic("b"), pic("c"))));
    await drawn(3);
    void view;
    const host = (editor.extensionManager.extensions.find((extension) => extension.name === "postMediaGrid")?.options as { host: { openEdit: { current: unknown } } }).host;
    const opened = vi.fn();
    host.openEdit.current = opened;
    fireEvent.keyDown(tiles()[1], { key: "Enter" });
    expect(opened).toHaveBeenCalledWith(expect.objectContaining({ index: 1, tab: "crop" }));
    fireEvent.keyDown(tiles()[1], { key: "Backspace" });
    expect(idsIn(editor, 0)).toEqual(["a", "c"]);
    fireEvent.keyDown(tiles()[0], { key: "Delete" });
    expect(idsIn(editor, 0)).toEqual(["c"]);
  });

  it("is a focusable tile named by its alt text or its place", async () => {
    mount(doc(p("one"), grid(pic("a"), pic("b"))));
    await drawn(2);
    expect(tiles().map((tile) => [tile.tabIndex, tile.getAttribute("aria-label")])).toEqual([
      [0, "Picture 1 of 2"],
      [0, "Picture 2 of 2"],
    ]);
  });
});

describe("reordering", () => {
  it("moves a picture one place with Alt and an arrow, says where, and the grid follows the order", async () => {
    const { editor } = mount(doc(p("one"), grid(pic("a"), pic("b"), pic("c"), pic("d"))));
    await drawn(4);
    fireEvent.keyDown(tiles()[1], { key: "ArrowRight", altKey: true });
    expect(idsIn(editor, 0)).toEqual(["a", "c", "b", "d"]);
    expect(screen.getByText(movedSentence(2, 4))).toBeInTheDocument();
    expect(movedSentence(2, 4)).toBe("Picture moved to 3 of 4.");
    fireEvent.keyDown(tiles()[0], { key: "ArrowLeft", altKey: true });
    expect(idsIn(editor, 0)).toEqual(["a", "c", "b", "d"]);
    act(() => {
      editor.commands.undo();
    });
    expect(idsIn(editor, 0)).toEqual(["a", "b", "c", "d"]);
  });

  it("is sortable by drag with two or more, and not with one", async () => {
    mount(doc(p("one"), grid(pic("a"), pic("b")), brk, p("two"), grid(pic("c"))));
    await drawn(3);
    const [first, , only] = tiles();
    expect(first.getAttribute("aria-roledescription")).toBe("sortable picture");
    expect(only.getAttribute("aria-roledescription")).toBeNull();
    // A single picture's tile is not disabled: its Edit and Remove stay usable for assistive tech.
    expect(only.getAttribute("aria-disabled")).toBeNull();
  });
});

describe("on a phone, while writing", () => {
  it("draws two or more as a strip that scrolls sideways: 180 tall, at most 78% wide, 8 apart, radius 16", async () => {
    mount(doc(p("one"), grid(pic("a"), pic("b"), pic("c"))), { phone: true });
    await drawn(3);
    const strip = document.querySelector("[data-post-media-strip]") as HTMLElement;
    expect(strip.style.overflowX).toBe("auto");
    expect(strip.style.scrollSnapType).toBe("x mandatory");
    expect(strip.style.gap).toBe("8px");
    const [tile] = tiles();
    expect([tile.style.height, tile.style.maxWidth, tile.style.borderRadius, tile.style.scrollSnapAlign]).toEqual(["180px", "78%", "16px", "start"]);
    // Edit and × keep 44 hit areas round their shapes.
    const remove = within(tile).getByRole("button", { name: "Remove" });
    expect(remove.style.padding).toBe("6px");
  });

  it("keeps one picture as a grid", async () => {
    mount(doc(p("one"), grid(pic("a"))), { phone: true });
    await drawn(1);
    expect(document.querySelector("[data-post-media-strip]")).toBeNull();
    expect(document.querySelector("[data-grid-view] [data-post-media-grid]")).not.toBeNull();
  });
});

describe("a thread saved before CA-07", () => {
  it("opens as grids, saves nothing on opening, and is saved in the new shape, captions kept, after an edit", async () => {
    const old = doc(
      p("One"),
      { ...pic("a"), attrs: { ...pic("a").attrs, caption: "Launch day" } } as unknown as ThreadBlock,
      p("Two"),
      { type: "postMediaRow", content: [pic("b"), { ...pic("c"), attrs: { ...pic("c").attrs, caption: "A loaf" } }, pic("d")] } as ThreadBlock,
    );
    const { editor, thread } = mount(old);
    await drawn(4);
    expect(json(editor).content.map((block) => block.type)).toEqual(["paragraph", "paragraph", "postMediaGrid"]);
    expect(thread.onDoc).not.toHaveBeenCalled();
    act(() => {
      editor.commands.insertContentAt(1, "Now ");
    });
    const saved = tidyThread((thread.onDoc as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as ThreadDoc);
    expect(saved.content.map((block) => block.type)).toEqual(["paragraph", "paragraph", "postMediaGrid"]);
    const pictures = (saved.content[2] as { content: ThreadPostMedia[] }).content;
    expect(pictures.map((one) => one.attrs.mediaId)).toEqual(["a", "b", "c", "d"]);
    expect(pictures.map((one) => one.attrs.caption)).toEqual(["Launch day", "", "A loaf", ""]);
  });
});
