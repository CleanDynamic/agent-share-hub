// PT-06 — pictures and videos in the composer's editor: adding, limits, sizes, replacing, rows, saving and moving.

import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { uploadMedia, updateBuild, setPostMedia } = vi.hoisted(() => ({ uploadMedia: vi.fn(), updateBuild: vi.fn(), setPostMedia: vi.fn() }));

vi.mock("@/lib/build/media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build/media")>()),
  uploadMedia,
  probeFile: vi.fn(async () => ({ width: 900, height: 300, duration: null })),
  signedMediaUrl: vi.fn(async (ref: { path: string }) => `https://signed.test/${ref.path}`),
}));
vi.mock("@/lib/build/builds", () => ({ updateBuild }));
vi.mock("@/lib/build/cover", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/build/cover")>()), setPostMedia }));

import { MEDIA_MAX_BYTES } from "@/lib/build/media";
import { POST_FULL_SENTENCE } from "@/lib/build/postMedia";
import { saveThread, type ThreadBlock, type ThreadDoc, type ThreadPostMedia } from "@/lib/build/thread";
import { tidyThread } from "@/lib/build/threadEditor";

import { brk, doc, mountPostTab as mount, p, startOf } from "./postTabKit";

// jsdom has no hit testing; ProseMirror asks for it when the editor reports a size, as the tests below make it.
(document as unknown as { elementFromPoint: () => null }).elementFromPoint ??= () => null;

const BUILD_ID = "00000000-0000-4000-8000-000000000001";

const row = (id: string, over: Record<string, unknown> = {}): ThreadBlock => pic(id, over);
function pic(id: string, over: Record<string, unknown> = {}): ThreadPostMedia {
  return { type: "postMedia", attrs: { mediaId: id, width: 100, w: 800, h: 600, alt: "", caption: "", ...over } } as ThreadPostMedia;
}
const rowOf = (...pictures: ThreadPostMedia[]): ThreadBlock => ({ type: "postMediaRow", content: pictures });

function media(id: string, over: Record<string, unknown> = {}) {
  return { id, build_id: BUILD_ID, node_id: null, bucket: "build-media", path: `${BUILD_ID}/unplaced/${id}.png`, kind: "image", mime: "image/png", bytes: 10, width: 1200, height: 800, duration: null, poster_path: null, created_at: "", ...over };
}

const file = (name = "harbour.png", type = "image/png") => new File(["x"], name, { type });
const json = (editor: Editor) => editor.getJSON() as ThreadDoc;
const pictures = (editor: Editor) => json(editor).content.filter((block) => block.type === "postMedia") as ThreadPostMedia[];

const RECT = { top: 0, bottom: 20, height: 20, left: 0, right: 100, width: 100, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;

/** jsdom has no DragEvent, so the drop is a MouseEvent that carries a dataTransfer. */
function drop(target: Element, dataTransfer: Record<string, unknown>, x: number, y: number) {
  const event = new MouseEvent("drop", { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  fireEvent(target, event);
}

/** A drop of `files` at (x, y), the editor reporting `pos` under the pointer. */
function dropFiles(editor: Editor, files: File[], at: { pos: number; inside?: number; x?: number; y?: number }) {
  vi.spyOn(editor.view, "posAtCoords").mockReturnValue({ pos: at.pos, inside: at.inside ?? -1 });
  drop(editor.view.dom, { files, types: ["Files"], getData: () => "", dropEffect: "copy" }, at.x ?? 5, at.y ?? 4);
}

/** Node views are React portals; wait until the pictures of the mounted document are drawn. */
async function drawn(count = 1) {
  await waitFor(() => expect(document.querySelectorAll("[data-picture]").length).toBeGreaterThanOrEqual(count));
}

/** Selects the block at `index` as a node: what clicking a picture does. */
async function select(editor: Editor, index: number) {
  act(() => {
    editor.commands.setNodeSelection(startOf(editor, index) - 1);
  });
  await waitFor(() => expect(document.querySelector("[data-picture] [data-selected]")).not.toBeNull());
}

function focus(editor: Editor) {
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  editor.view.dom.tabIndex = 0;
  act(() => {
    editor.view.dom.focus();
  });
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(RECT);
  uploadMedia.mockReset();
  uploadMedia.mockImplementation(async ({ onProgress }: { onProgress?: (fraction: number) => void }) => {
    onProgress?.(1);
    return media("m-new");
  });
  updateBuild.mockReset();
  setPostMedia.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("adding a picture", () => {
  it("inserts a dropped file at the drop point, on the side of the block the pointer is nearest", async () => {
    const { editor } = mount(doc(p("one"), p("two"), p("three")));
    dropFiles(editor, [file()], { pos: startOf(editor, 1) + 1, y: 4 });
    await waitFor(() => expect(pictures(editor)).toHaveLength(1));
    expect(json(editor).content.map((block) => block.type)).toEqual(["paragraph", "postMedia", "paragraph", "paragraph"]);

    cleanup();
    const second = mount(doc(p("one"), p("two"), p("three")));
    dropFiles(second.editor, [file()], { pos: startOf(second.editor, 1) + 1, y: 15 });
    await waitFor(() => expect(pictures(second.editor)).toHaveLength(1));
    expect(json(second.editor).content.map((block) => block.type)).toEqual(["paragraph", "paragraph", "postMedia", "paragraph"]);
  });

  it("shows the node at its probed size as a tile reading Uploading 40%, then gives it mediaId, w and h and width 100", async () => {
    let finish: () => void = () => undefined;
    uploadMedia.mockImplementation(({ onProgress }: { onProgress?: (fraction: number) => void }) => {
      onProgress?.(0.4);
      return new Promise((resolve) => {
        finish = () => resolve(media("m-new", { width: 1200, height: 800 }));
      });
    });
    const { editor } = mount(doc(p("one"), p("")));
    dropFiles(editor, [file()], { pos: startOf(editor, 1) });

    const bar = await screen.findByRole("progressbar", { name: "Uploading" });
    expect(bar.textContent).toBe("Uploading 40%");
    expect(bar.style.aspectRatio).toBe("3");
    // (jsdom drops a colour written as var(), so the tile's fill and the 12px t.text2 are read in the source, not here.)
    expect(bar.style.borderRadius).toBe("6px");
    expect(bar.style.fontSize).toBe("12px");
    expect(pictures(editor)[0].attrs).toMatchObject({ mediaId: "", w: 900, h: 300, width: 100 });
    // The save waits: thread.ts refuses a picture with no mediaId.
    expect(uploadMedia).toHaveBeenCalledWith(expect.objectContaining({ buildId: BUILD_ID }));

    await act(async () => finish());
    await waitFor(() => expect(pictures(editor)[0].attrs.mediaId).toBe("m-new"));
    expect(pictures(editor)[0].attrs).toMatchObject({ w: 1200, h: 800, width: 100 });
    expect(JSON.stringify(json(editor))).not.toContain("uploadId\":\"");
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("replaces the empty paragraph a drop lands on, and keeps the one the writer is in", async () => {
    const { editor } = mount(doc(p("one"), p("")));
    dropFiles(editor, [file()], { pos: startOf(editor, 1) });
    await waitFor(() => expect(pictures(editor)).toHaveLength(1));
    expect(json(editor).content.map((block) => block.type).slice(0, 2)).toEqual(["paragraph", "postMedia"]);
  });

  it("refuses a file that is not a picture or video, or is too large, with a sentence naming it, and uploads nothing", async () => {
    const { editor } = mount(doc(p("one")));
    const big = file("big.mov", "video/quicktime");
    Object.defineProperty(big, "size", { value: MEDIA_MAX_BYTES + 5 * 1024 * 1024 });
    dropFiles(editor, [big, file("notes.pdf", "application/pdf")], { pos: 2 });

    expect(await screen.findByText(/big\.mov is 30\.0MB\. A picture or video has to be under 25\.0MB, so it was not uploaded\./)).toBeTruthy();
    expect(screen.getByText(/notes\.pdf is application\/pdf/)).toBeTruthy();
    expect(uploadMedia).not.toHaveBeenCalled();
    expect(pictures(editor)).toHaveLength(0);
  });

  it("refuses a fifth picture in a post with the sentence, and uploads nothing", async () => {
    const { editor } = mount(doc(p("one"), pic("m1"), pic("m2"), rowOf(pic("m3"), pic("m4"))));
    dropFiles(editor, [file()], { pos: 2 });
    expect(await screen.findByText("A post holds 4 pictures. Start a new post or remove one.")).toBeTruthy();
    expect(POST_FULL_SENTENCE).toBe("A post holds 4 pictures. Start a new post or remove one.");
    expect(uploadMedia).not.toHaveBeenCalled();
    expect(json(editor).content).toHaveLength(4);
  });

  it("takes a picture into the next post when the first is full", async () => {
    const { editor } = mount(doc(pic("m1"), pic("m2"), pic("m3"), pic("m4"), brk, p("")));
    dropFiles(editor, [file()], { pos: startOf(editor, 5) });
    await waitFor(() => expect(uploadMedia).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(pictures(editor).map((picture) => picture.attrs.mediaId)).toContain("m-new"));
  });

  it("puts a pasted image where the caret is", async () => {
    const { editor, dom } = mount(doc(p("one"), p("")));
    act(() => {
      editor.commands.setTextSelection(startOf(editor, 1));
    });
    fireEvent.paste(dom, { clipboardData: { files: [file("shot.png")], types: ["Files"], getData: () => "" } });
    await waitFor(() => expect(pictures(editor)).toHaveLength(1));
    await waitFor(() => expect(pictures(editor)[0].attrs.mediaId).toBe("m-new"));
  });

  it("inserts a row of 2 or 3 files from the slash menu, and says so when the count is wrong", async () => {
    const { editor } = mount(doc(p("")));
    act(() => {
      editor.commands.focus();
      editor.commands.insertContent("/");
    });
    fireEvent.click(await screen.findByRole("option", { name: /Row of pictures/ }));
    const input = screen.getByTestId("post-picture-file") as HTMLInputElement;
    expect(input.multiple).toBe(true);
    expect(input.accept).toContain("video/mp4");

    fireEvent.change(input, { target: { files: [file("a.png"), file("b.png")] } });
    await waitFor(() => expect(json(editor).content[0].type).toBe("postMediaRow"));
    await waitFor(() => expect(uploadMedia).toHaveBeenCalledTimes(2));

    cleanup();
    const lone = mount(doc(p("")));
    act(() => {
      lone.editor.commands.focus();
      lone.editor.commands.insertContent("/");
    });
    fireEvent.click(await screen.findByRole("option", { name: /Row of pictures/ }));
    fireEvent.change(screen.getByTestId("post-picture-file"), { target: { files: [file("a.png")] } });
    expect(await screen.findByText("A row holds 2 or 3 pictures. Choose 2 or 3 files.")).toBeTruthy();
    expect(json(lone.editor).content.some((block) => block.type === "postMediaRow")).toBe(false);
  });
});

describe("the size of a picture", () => {
  it("is set by Small, Medium, Large and Full on a dark plate, 10px in from the top-right corner", async () => {
    const { editor } = mount(doc(pic("m1"), p("")));
    await drawn();
    await select(editor, 0);
    const plate = screen.getByRole("group", { name: "Picture size" });
    const buttons = within(plate).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["Small", "Medium", "Large", "Full"]);
    const dark = plate.parentElement as HTMLElement;
    expect([dark.style.borderRadius, dark.style.padding]).toEqual(["6px", "2px"]);
    // The plate re-points the tokens Segmented reads: text is t.onInverse2, the chosen one t.onInverse on t.text2.
    expect([dark.style.getPropertyValue("--text"), dark.style.getPropertyValue("--text2")]).toEqual(["var(--on-inverse)", "var(--on-inverse-2)"]);
    expect((dark.parentElement as HTMLElement).style.getPropertyValue("--control")).toBe("var(--text2)");
    expect(plate.style.height).toBe("26px");
    const corner = (plate.parentElement?.parentElement as HTMLElement).style;
    expect([corner.top, corner.right]).toEqual(["10px", "10px"]);

    for (const [name, width] of [["Small", 40], ["Medium", 60], ["Large", 80], ["Full", 100]] as const) {
      fireEvent.click(within(plate).getByRole("button", { name }));
      expect(pictures(editor)[0].attrs.width).toBe(width);
      expect(within(plate).getByRole("button", { name }).getAttribute("aria-pressed")).toBe("true");
    }
  });

  it("steps through 40, 60, 80 and 100 with [ and ] while the picture is selected", async () => {
    const { editor, dom } = mount(doc(pic("m1"), p("")));
    await select(editor, 0);
    const widths: number[] = [];
    for (const key of ["[", "[", "[", "[", "]", "]", "]", "]"]) {
      fireEvent.keyDown(dom, { key });
      widths.push(pictures(editor)[0].attrs.width);
    }
    expect(widths).toEqual([80, 60, 40, 40, 60, 80, 100, 100]);
  });

  it("does not step a picture that is not selected, nor a caret in text", () => {
    const { editor, dom } = mount(doc(pic("m1"), p("text")));
    act(() => {
      editor.commands.setTextSelection(startOf(editor, 1) + 1);
    });
    fireEvent.keyDown(dom, { key: "[" });
    expect(pictures(editor)[0].attrs.width).toBe(100);
  });

  it("is set by dragging the corner to any percent from 25 to 100, snapping within 3 points of a step", async () => {
    const { editor } = mount(doc(pic("m1"), p("")));
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ ...RECT, left: 0, width: 600, right: 600 });
    await select(editor, 0);
    const corner = screen.getByRole("button", { name: "Resize picture" });
    const dragTo = (percent: number) => {
      fireEvent(corner, new MouseEvent("pointerdown", { bubbles: true, cancelable: true, clientX: 600 }));
      const x = 300 + (percent / 100) * 300;
      fireEvent(window, new MouseEvent("pointermove", { clientX: x }));
      fireEvent(window, new MouseEvent("pointerup", { clientX: x }));
    };
    dragTo(62);
    expect(pictures(editor)[0].attrs.width).toBe(60);
    dragTo(77);
    expect(pictures(editor)[0].attrs.width).toBe(80);
    dragTo(70);
    expect(pictures(editor)[0].attrs.width).toBe(70);
    dragTo(25);
    expect(pictures(editor)[0].attrs.width).toBe(25);
    dragTo(98);
    expect(pictures(editor)[0].attrs.width).toBe(100);
  });
});

describe("a selected picture", () => {
  it("has a 1px --selected-edge outline 3px outside it, and no outline when it is not selected", async () => {
    const { editor } = mount(doc(p("above"), pic("m1"), p("")));
    await drawn();
    const area = () => document.querySelector("[data-drag-handle]") as HTMLElement;
    expect(area().style.outline).toBe("none");
    await select(editor, 1);
    expect(area().style.outline).toBe("1px solid var(--selected-edge)");
    expect(area().style.outlineOffset).toBe("3px");
  });

  it("is drawn by PostMedia at the reserved shape, with the caption left to the editor's own field", async () => {
    mount(doc(pic("m1", { w: 800, h: 400, caption: "A caption" }), p("")));
    await drawn();
    const box = document.querySelector("[data-post-media-box]") as HTMLElement;
    expect(box.style.aspectRatio).toBe("800 / 400");
    expect(document.querySelectorAll("figcaption")).toHaveLength(0);
    expect((screen.getByRole("textbox", { name: "Caption" }) as HTMLTextAreaElement).value).toBe("A caption");
  });
});

describe("replacing a picture", () => {
  it("puts the new file in the same node and keeps its width and caption", async () => {
    const { editor } = mount(doc(pic("m1", { width: 60, caption: "Harbour at noon", alt: "old description" }), p("")));
    await select(editor, 0);
    uploadMedia.mockImplementation(async () => media("m2", { width: 640, height: 480 }));
    fireEvent.change(screen.getByTestId("picture-replace"), { target: { files: [file("new.png")] } });
    await waitFor(() => expect(pictures(editor)[0].attrs.mediaId).toBe("m2"));
    expect(pictures(editor)).toHaveLength(1);
    expect(pictures(editor)[0].attrs).toMatchObject({ width: 60, caption: "Harbour at noon", w: 640, h: 480, alt: "" });
  });

  it("puts the old picture back when the new file does not upload", async () => {
    const { editor } = mount(doc(pic("m1", { width: 60, caption: "Harbour", alt: "kept" }), p("")));
    await select(editor, 0);
    uploadMedia.mockRejectedValue(new Error("network"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fireEvent.change(screen.getByTestId("picture-replace"), { target: { files: [file("new.png")] } });
    expect(await screen.findByText("new.png did not upload. Check your connection and try again.")).toBeTruthy();
    expect(pictures(editor)[0].attrs).toMatchObject({ mediaId: "m1", width: 60, caption: "Harbour", alt: "kept" });
  });

  it("refuses a replacement that is not a picture before anything is changed", async () => {
    const { editor } = mount(doc(pic("m1"), p("")));
    await select(editor, 0);
    fireEvent.change(screen.getByTestId("picture-replace"), { target: { files: [file("a.pdf", "application/pdf")] } });
    expect(await screen.findByText(/a\.pdf is application\/pdf/)).toBeTruthy();
    expect(pictures(editor)[0].attrs.mediaId).toBe("m1");
    expect(uploadMedia).not.toHaveBeenCalled();
  });
});

describe("removing a picture", () => {
  it("takes the node out and deletes no file", async () => {
    const { editor } = mount(doc(p("a"), pic("m1"), p("b")));
    await select(editor, 1);
    fireEvent.click(screen.getByRole("button", { name: "Remove picture" }));
    expect(pictures(editor)).toHaveLength(0);
    expect(json(editor).content.map((block) => block.type)).toEqual(["paragraph", "paragraph"]);
  });

  it("clears the picture's place in the post when the thread is saved, and the file is not deleted", async () => {
    const { editor } = mount(doc(pic("m1"), pic("m2"), p("")));
    await select(editor, 0);
    fireEvent.click(screen.getByRole("button", { name: "Remove picture" }));
    await saveThread(BUILD_ID, tidyThread(json(editor)));
    expect(setPostMedia).toHaveBeenCalledWith(BUILD_ID, ["m2"]);
  });

  it("leaves a single picture when a row of two loses one", async () => {
    const { editor } = mount(doc(rowOf(pic("m1"), pic("m2")), p("")));
    await drawn(2);
    const view = editor.view;
    let pos = -1;
    editor.state.doc.descendants((node, at) => {
      if (node.type.name === "postMedia" && node.attrs.mediaId === "m2") pos = at;
    });
    act(() => {
      editor.commands.setNodeSelection(pos);
    });
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Remove picture" })).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Remove picture" }));
    expect(view.state.doc.child(0).type.name).toBe("postMedia");
    expect(view.state.doc.child(0).attrs.mediaId).toBe("m1");
  });
});

describe("a row of pictures", () => {
  it("gives each picture a share of the row in proportion to its shape, so the heights are equal", async () => {
    const { editor } = mount(doc(rowOf(pic("m1", { w: 2000, h: 1000 }), pic("m2", { w: 1000, h: 1000 }), pic("m3", { w: 1500, h: 1000 })), p("")));
    await drawn(3);
    const rowDom = document.querySelector("[data-post-media-row]") as HTMLElement;
    expect(rowDom.style.display).toBe("flex");
    expect(rowDom.style.gap).toBe("8px");
    const slots = Array.from(rowDom.children) as HTMLElement[];
    const grows = slots.map((slot) => Number(slot.style.flexGrow));
    expect(grows).toEqual([2, 1, 1.5]);
    expect(slots.every((slot) => slot.style.flexBasis === "0px" || slot.style.flexBasis === "0")).toBe(true);
    // width = share * (row - gaps); height = width / ratio, the same for all.
    const sum = grows.reduce((a, b) => a + b, 0);
    const heights = grows.map((grow, index) => (grow / sum) / [2, 1, 1.5][index]);
    expect(new Set(heights.map((height) => height.toFixed(6))).size).toBe(1);
    expect(json(editor).content[0].type).toBe("postMediaRow");
  });

  it("hides the size control and the corner inside a row, and keeps Alt text, Replace and Remove", async () => {
    const { editor } = mount(doc(rowOf(pic("m1"), pic("m2")), p("")));
    await drawn(2);
    let pos = -1;
    editor.state.doc.descendants((node, at) => {
      if (pos < 0 && node.type.name === "postMedia") pos = at;
    });
    act(() => {
      editor.commands.setNodeSelection(pos);
    });
    await screen.findByRole("button", { name: "Alt text" });
    fireEvent.mouseEnter(document.querySelector("[data-picture]") as HTMLElement);
    expect(screen.queryByRole("group", { name: "Picture size" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Resize picture" })).toBeNull();
    expect(screen.getByRole("button", { name: "Replace" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove picture" })).toBeTruthy();
  });

  it("is made by dropping a picture on the left or right edge of another, and added to up to three", async () => {
    const { editor, dom } = mount(doc(pic("m1"), pic("m2"), pic("m3"), p("")));
    await drawn(3);
    const dropOnEdge = (from: number, target: number, x: number) => {
      act(() => {
        editor.commands.setNodeSelection(startOf(editor, from) - 1);
      });
      editor.view.dragging = { slice: editor.view.state.selection.content(), move: true };
      vi.spyOn(editor.view, "posAtCoords").mockReturnValue({ pos: target, inside: target });
      drop(dom, { files: [], types: [], getData: () => "" }, x, 5);
    };
    dropOnEdge(1, 0, 90);
    expect(json(editor).content.map((block) => block.type)).toEqual(["postMediaRow", "postMedia", "paragraph"]);
    expect((json(editor).content[0] as { content: ThreadPostMedia[] }).content.map((c) => c.attrs.mediaId)).toEqual(["m1", "m2"]);

    // The picture at the row's first slot sits at position 1, just inside the row.
    dropOnEdge(1, 1, 10);
    expect((json(editor).content[0] as { content: ThreadPostMedia[] }).content.map((c) => c.attrs.mediaId)).toEqual(["m3", "m1", "m2"]);
  });

  it("turns a picture dragged out of a row into a single picture again", async () => {
    const { editor, dom } = mount(doc(rowOf(pic("m1"), pic("m2")), p("end")));
    await drawn(2);
    const child = 1;
    act(() => {
      editor.commands.setNodeSelection(child);
    });
    editor.view.dragging = { slice: editor.view.state.selection.content(), move: true };
    vi.spyOn(editor.view, "posAtCoords").mockReturnValue({ pos: editor.state.doc.content.size - 1, inside: -1 });
    drop(dom, { files: [], types: [], getData: () => "" }, 5, 19);
    // The editor keeps an empty paragraph after a picture that ends the document.
    expect(json(editor).content.map((block) => block.type)).toEqual(["postMedia", "paragraph", "postMedia", "paragraph"]);
    expect(pictures(editor).map((picture) => picture.attrs.mediaId)).toEqual(["m2", "m1"]);
  });
});

describe("alt text and caption", () => {
  it("survive a save and a reload", async () => {
    const first = mount(doc(pic("m1", { width: 60 }), p("")));
    await select(first.editor, 0);
    fireEvent.change(screen.getByRole("textbox", { name: "Caption" }), { target: { value: "Harbour at noon" } });
    fireEvent.click(screen.getByRole("button", { name: "Alt text" }));
    const dialog = screen.getByRole("dialog", { name: "Alt text" });
    expect(within(dialog).getByText("Describe what the picture shows for people who can't see it.")).toBeTruthy();
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Alt text" }), { target: { value: "Boats in a harbour" } });

    await saveThread(BUILD_ID, tidyThread(json(first.editor)));
    const stored = updateBuild.mock.calls[0][1].post_doc as ThreadDoc;
    expect(stored.content[0]).toMatchObject({ type: "postMedia", attrs: { mediaId: "m1", width: 60, alt: "Boats in a harbour", caption: "Harbour at noon" } });

    cleanup();
    const reloaded = mount(stored);
    await select(reloaded.editor, 0);
    expect((screen.getByRole("textbox", { name: "Caption" }) as HTMLTextAreaElement).value).toBe("Harbour at noon");
    fireEvent.click(screen.getByRole("button", { name: "Alt text" }));
    expect((within(screen.getByRole("dialog", { name: "Alt text" })).getByRole("textbox") as HTMLTextAreaElement).value).toBe("Boats in a harbour");
  });

  it("stop at 200 and 300 characters", async () => {
    const { editor } = mount(doc(pic("m1"), p("")));
    await select(editor, 0);
    fireEvent.change(screen.getByRole("textbox", { name: "Caption" }), { target: { value: "c".repeat(260) } });
    expect(pictures(editor)[0].attrs.caption).toHaveLength(200);
    fireEvent.click(screen.getByRole("button", { name: "Alt text" }));
    fireEvent.change(within(screen.getByRole("dialog", { name: "Alt text" })).getByRole("textbox"), { target: { value: "a".repeat(340) } });
    expect(pictures(editor)[0].attrs.alt).toHaveLength(300);
  });

  it("shows Add a caption in --label while the caption is empty", () => {
    mount(doc(pic("m1"), p("")));
    const placeholder = screen.getByText("Add a caption");
    expect(placeholder.style.fontSize).toBe("13px");
  });
});

describe("the handle in the margin", () => {
  const order = (editor: Editor) => json(editor).content.map((block) => (block.type === "paragraph" ? ((block.content?.[0] as { text: string } | undefined)?.text ?? "") : block.type));

  it("moves a block up and down with Alt and the arrow keys while it is focused", async () => {
    const { editor } = mount(doc(p("one"), p("two"), p("three")));
    focus(editor);
    act(() => {
      editor.commands.setTextSelection(startOf(editor, 1) + 1);
    });
    const handle = await screen.findByRole("button", { name: "Move block" });
    fireEvent.keyDown(handle, { key: "ArrowUp", altKey: true });
    expect(order(editor)).toEqual(["two", "one", "three"]);
    fireEvent.keyDown(handle, { key: "ArrowUp", altKey: true });
    expect(order(editor)).toEqual(["two", "one", "three"]);
    fireEvent.keyDown(handle, { key: "ArrowDown", altKey: true });
    fireEvent.keyDown(handle, { key: "ArrowDown", altKey: true });
    expect(order(editor)).toEqual(["one", "three", "two"]);
    fireEvent.keyDown(handle, { key: "ArrowDown", altKey: true });
    expect(order(editor)).toEqual(["one", "three", "two"]);
  });

  it("ignores the arrow keys without Alt", async () => {
    const { editor } = mount(doc(p("one"), p("two")));
    focus(editor);
    act(() => {
      editor.commands.setTextSelection(startOf(editor, 1) + 1);
    });
    fireEvent.keyDown(await screen.findByRole("button", { name: "Move block" }), { key: "ArrowUp" });
    expect(order(editor)).toEqual(["one", "two"]);
  });

  it("moves a picture and a row the same way, and across a break into the other post", async () => {
    const { editor } = mount(doc(p("one"), pic("m1"), brk, rowOf(pic("m2"), pic("m3"))));
    focus(editor);
    act(() => {
      editor.commands.setNodeSelection(startOf(editor, 1) - 1);
    });
    const handle = await screen.findByRole("button", { name: "Move block" });
    fireEvent.keyDown(handle, { key: "ArrowUp", altKey: true });
    expect(order(editor)).toEqual(["postMedia", "one", "postBreak", "postMediaRow", ""]);
    fireEvent.keyDown(handle, { key: "ArrowDown", altKey: true });
    fireEvent.keyDown(handle, { key: "ArrowDown", altKey: true });
    expect(order(editor)).toEqual(["one", "postBreak", "postMedia", "postMediaRow", ""]);
  });

  it("will not move a picture into a post that already holds four", async () => {
    const { editor } = mount(doc(pic("m1"), pic("m2"), pic("m3"), pic("m4"), brk, pic("m5")));
    focus(editor);
    act(() => {
      editor.commands.setNodeSelection(startOf(editor, 5) - 1);
    });
    const handle = await screen.findByRole("button", { name: "Move block" });
    // Up past the break puts it in the first post, which holds four.
    fireEvent.keyDown(handle, { key: "ArrowUp", altKey: true });
    expect(await screen.findByText(POST_FULL_SENTENCE)).toBeTruthy();
    expect(json(editor).content.map((block) => block.type)).toEqual(["postMedia", "postMedia", "postMedia", "postMedia", "postBreak", "postMedia", "paragraph"]);
  });

  it("is a grip in --label, 24 square, named, and draggable", async () => {
    const { editor } = mount(doc(p("one")));
    focus(editor);
    const handle = await screen.findByRole("button", { name: "Move block" });
    expect([handle.style.width, handle.style.height, handle.style.left]).toEqual(["24px", "24px", "-24px"]);
    expect(handle.getAttribute("draggable")).toBe("true");
    expect(handle.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("is not drawn on a phone", () => {
    const { editor } = mount(doc(p("one")), { phone: true });
    focus(editor);
    expect(screen.queryByRole("button", { name: "Move block" })).toBeNull();
  });
});

describe("what is stored", () => {
  it("never holds the editor's mark on a picture that has landed", async () => {
    const { editor } = mount(doc(p("")));
    dropFiles(editor, [file()], { pos: 1 });
    await waitFor(() => expect(pictures(editor)[0]?.attrs.mediaId).toBe("m-new"));
    const stored = tidyThread(json(editor)) as ThreadDoc;
    expect(JSON.stringify(stored)).not.toContain("uploadId");
  });
});
