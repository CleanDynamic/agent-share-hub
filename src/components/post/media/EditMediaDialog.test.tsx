// CA-07 P5 — Edit on a picture: Crop media, ALT and Content warning, saved in one step, the file never changed.

import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/build/media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build/media")>()),
  signedMediaUrl: vi.fn(async (ref: { path: string }) => `https://signed.test/${ref.path}`),
}));

import { postSpans } from "@/components/post/editor/pictures";
import type { ThreadBlock, ThreadPostMedia } from "@/lib/build/thread";
import { doc, mountPostTab as mount, p } from "@/pages/site/compose/postTabKit";

import { cropFor, dragView, storedCrop } from "./cropStyle";
import { EDIT_COPY } from "./EditMediaDialog";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const pic = (mediaId: string, over: Record<string, unknown> = {}): ThreadPostMedia =>
  ({ type: "postMedia", attrs: { mediaId, width: 100, w: 1600, h: 900, alt: "", crop: null, aspect: null, zoom: null, warn: [], caption: "", ...over } }) as ThreadPostMedia;
const grid = (...pictures: ThreadPostMedia[]): ThreadBlock => ({ type: "postMediaGrid", attrs: { step: null }, content: pictures });
const attrsOf = (editor: Editor, index: number) => postSpans(editor.state.doc)[0].grid?.node.child(index).attrs as Record<string, unknown>;
const pill = (index: number) => document.querySelectorAll<HTMLElement>("[data-grid-view] [data-edit-pill]")[index];
const dialog = () => screen.getByTestId("edit-media-dialog");

async function open(content: ThreadBlock, index = 0, rows: Record<string, unknown>[] = []) {
  const mounted = mount(doc(p("words"), content));
  const host = (mounted.editor.extensionManager.extensions.find((extension) => extension.name === "postMediaGrid")?.options as { host: { store: { addRows: (rows: unknown[]) => void } } }).host;
  if (rows.length) act(() => host.store.addRows(rows));
  await waitFor(() => expect(pill(index)).toBeTruthy());
  fireEvent.click(pill(index));
  await screen.findByTestId("edit-media-dialog");
  return mounted;
}

const tab = (name: string) => within(dialog()).getByRole("tab", { name });
const save = () => fireEvent.click(within(dialog()).getByRole("button", { name: "Save" }));

describe("opening", () => {
  it("opens from Edit on the Crop tab for a picture, headed Crop media, with Back and Save", async () => {
    await open(grid(pic("a")));
    expect(within(dialog()).getByRole("heading", { name: "Crop media" })).toBeInTheDocument();
    expect(tab("Crop").getAttribute("aria-selected")).toBe("true");
    expect(within(dialog()).getByRole("button", { name: EDIT_COPY.back })).toBeInTheDocument();
    expect(within(dialog()).getByRole("tablist").querySelectorAll('[role="tab"]')).toHaveLength(3);
    expect(tab("ALT").textContent).toBe("ALT");
    expect(tab("Content warning").querySelector("svg")).not.toBeNull();
  });

  it("opens on ALT for a video, with Crop off and saying why", async () => {
    await open(grid(pic("v")), 0, [{ id: "v", path: "b/v.mp4", bucket: "build-media", kind: "video", width: 1920, height: 1080, poster_path: null, duration: 3 }]);
    expect(within(dialog()).getByRole("heading", { name: "Description" })).toBeInTheDocument();
    expect(tab("Crop").getAttribute("aria-disabled")).toBe("true");
    expect(tab("Crop").getAttribute("title")).toBe("GIFs and videos can't be cropped");
    fireEvent.click(tab("Crop"));
    expect(tab("ALT").getAttribute("aria-selected")).toBe("true");
  });

  it("names the Content warning tab's heading", async () => {
    await open(grid(pic("a")));
    fireEvent.click(tab("Content warning"));
    expect(within(dialog()).getByRole("heading", { name: "Content warning" })).toBeInTheDocument();
  });
});

describe("the Crop tab", () => {
  const frame = () => dialog().querySelector("[data-crop-frame]") as HTMLElement;
  const zoom = () => within(dialog()).getByLabelText("Zoom") as HTMLInputElement;

  it("frames the picture in its own shape, with thirds drawn as four 1px lines", async () => {
    await open(grid(pic("a")));
    expect(frame().getAttribute("aria-label")).toBe(EDIT_COPY.frame);
    expect(frame().style.aspectRatio).toBe("1.7778");
    expect(frame().querySelectorAll("[data-third]")).toHaveLength(4);
  });

  it("changes to Wide and Square, each a pressed button named for its shape", async () => {
    await open(grid(pic("a", { w: 1000, h: 1000 })));
    const shape = (name: string) => within(dialog()).getByRole("button", { name });
    expect(shape("Original").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(shape("Wide"));
    expect(frame().style.aspectRatio).toBe("1.7778");
    expect(shape("Wide").getAttribute("aria-pressed")).toBe("true");
    expect(shape("Wide").getAttribute("title")).toBe("Wide");
    fireEvent.click(shape("Square"));
    expect(frame().style.aspectRatio).toBe("1");
  });

  it("zooms by the slider, by the buttons in steps of 0.25, and by + and - in steps of 0.1", async () => {
    await open(grid(pic("a")));
    fireEvent.change(zoom(), { target: { value: "2" } });
    expect(zoom().value).toBe("2");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Zoom in" }));
    expect(zoom().value).toBe("2.25");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Zoom out" }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Zoom out" }));
    expect(zoom().value).toBe("1.75");
    fireEvent.keyDown(frame(), { key: "+" });
    expect(zoom().value).toBe("1.85");
    fireEvent.keyDown(frame(), { key: "-" });
    fireEvent.keyDown(frame(), { key: "-" });
    expect(zoom().value).toBe("1.65");
    fireEvent.change(zoom(), { target: { value: "9" } });
    expect(zoom().value).toBe("3");
  });

  it("moves the picture 1% of the frame with the arrow keys, and saves the crop as fractions of the original", async () => {
    const { editor } = await open(grid(pic("a", { w: 1000, h: 1000 })));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Wide" }));
    fireEvent.keyDown(frame(), { key: "ArrowUp" });
    save();
    const crop = attrsOf(editor, 0).crop as { x: number; y: number; w: number; h: number };
    expect(crop.w).toBe(1);
    expect(crop.h).toBeCloseTo(0.5625, 4);
    // Moving the picture up shows a little more of what is below the middle.
    expect(crop.y).toBeCloseTo(0.21875 + 0.01 * 0.5625, 4);
    expect(attrsOf(editor, 0)).toMatchObject({ aspect: "wide", zoom: 1 });
  });

  it("can never be dragged to leave a gap", () => {
    const view = { ratio: 1, frame: 16 / 9, zoom: 2, cx: 0.5, cy: 0.5 };
    for (const [dx, dy] of [[5, 0], [-5, 0], [0, 5], [0, -5], [3, -3]]) {
      const crop = cropFor(dragView(view, dx, dy));
      expect(crop.x).toBeGreaterThanOrEqual(0);
      expect(crop.y).toBeGreaterThanOrEqual(0);
      expect(crop.x + crop.w).toBeLessThanOrEqual(1 + 1e-9);
      expect(crop.y + crop.h).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it("stores no crop at all for Original at zoom 1", async () => {
    expect(storedCrop("original", { ratio: 1.5, frame: 1.5, zoom: 1, cx: 0.5, cy: 0.5 })).toBeNull();
    const { editor } = await open(grid(pic("a", { crop: { x: 0, y: 0, w: 0.5, h: 0.5 }, aspect: "square", zoom: 2 })));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Original" }));
    fireEvent.change(zoom(), { target: { value: "1" } });
    save();
    expect(attrsOf(editor, 0)).toMatchObject({ crop: null, aspect: null, zoom: null });
  });

  it("reopens as it was left", async () => {
    await open(grid(pic("a", { crop: { x: 0.25, y: 0, w: 0.5, h: 1 }, aspect: "square", zoom: 1.5 })));
    expect(within(dialog()).getByRole("button", { name: "Square" }).getAttribute("aria-pressed")).toBe("true");
    expect(zoom().value).toBe("1.5");
  });
});

describe("the ALT tab", () => {
  it("takes up to 1,000 characters, counted under the field, with the badge note beside it", async () => {
    const { editor } = await open(grid(pic("a")));
    fireEvent.click(tab("ALT"));
    const field = within(dialog()).getByLabelText("Description") as HTMLTextAreaElement;
    expect(field.getAttribute("placeholder")).toBe("Describe what is in the picture for people who can't see it");
    expect(within(dialog()).getByText("Readers see an ALT badge on the picture.")).toBeInTheDocument();
    fireEvent.change(field, { target: { value: "a".repeat(1001) } });
    expect(field.value).toHaveLength(1000);
    expect(dialog().querySelector("[data-alt-count]")?.textContent).toBe("1,000 / 1,000");
    fireEvent.change(field, { target: { value: "The shop front" } });
    expect(dialog().querySelector("[data-alt-count]")?.textContent).toBe("14 / 1,000");
    save();
    expect(attrsOf(editor, 0).alt).toBe("The shop front");
    // The crop was not touched, so nothing about it is written.
    expect(attrsOf(editor, 0).crop).toBeNull();
  });
});

describe("the Content warning tab", () => {
  it("says what a warning does and offers Nudity, Violence and Sensitive as brand checkboxes", async () => {
    const { editor } = await open(grid(pic("a")));
    fireEvent.click(tab("Content warning"));
    expect(within(dialog()).getByText("Choose a warning and readers see it before the picture, with a button to show it.")).toBeInTheDocument();
    const boxes = within(dialog()).getAllByRole("checkbox");
    expect(boxes).toHaveLength(3);
    expect(dialog().querySelectorAll('[data-ui="checkbox"]')).toHaveLength(3);
    fireEvent.click(within(dialog()).getByLabelText("Sensitive"));
    fireEvent.click(within(dialog()).getByLabelText("Violence"));
    save();
    expect(attrsOf(editor, 0).warn).toEqual(["violence", "sensitive"]);
  });
});

describe("several pictures", () => {
  it("switches with 44px thumbnails, the current one ringed, keeping every change until Save, which is one Undo", async () => {
    const { editor } = await open(grid(pic("a"), pic("b")));
    const thumbs = () => Array.from(dialog().querySelectorAll<HTMLElement>("[data-thumb]"));
    expect(thumbs()).toHaveLength(2);
    expect(thumbs()[0].style.width).toBe("44px");
    expect(thumbs()[0].getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(tab("ALT"));
    fireEvent.change(within(dialog()).getByLabelText("Description"), { target: { value: "First" } });
    fireEvent.click(thumbs()[1]);
    expect(thumbs()[1].getAttribute("aria-pressed")).toBe("true");
    fireEvent.change(within(dialog()).getByLabelText("Description"), { target: { value: "Second" } });
    fireEvent.click(thumbs()[0]);
    expect((within(dialog()).getByLabelText("Description") as HTMLTextAreaElement).value).toBe("First");
    save();
    expect([attrsOf(editor, 0).alt, attrsOf(editor, 1).alt]).toEqual(["First", "Second"]);
    act(() => {
      editor.commands.undo();
    });
    expect([attrsOf(editor, 0).alt, attrsOf(editor, 1).alt]).toEqual(["", ""]);
  });
});

describe("closing", () => {
  it("throws the changes away with Back, and focus goes back to the tile's Edit", async () => {
    const { editor } = await open(grid(pic("a")));
    fireEvent.click(tab("ALT"));
    fireEvent.change(within(dialog()).getByLabelText("Description"), { target: { value: "Gone" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: EDIT_COPY.back }));
    await waitFor(() => expect(screen.queryByTestId("edit-media-dialog")).toBeNull());
    expect(attrsOf(editor, 0).alt).toBe("");
    await waitFor(() => expect(document.activeElement).toBe(pill(0)));
  });

  it("throws the changes away with Esc", async () => {
    const { editor } = await open(grid(pic("a")));
    fireEvent.click(tab("Content warning"));
    fireEvent.click(within(dialog()).getByLabelText("Nudity"));
    fireEvent.keyDown(dialog(), { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("edit-media-dialog")).toBeNull());
    expect(attrsOf(editor, 0).warn).toEqual([]);
  });
});
