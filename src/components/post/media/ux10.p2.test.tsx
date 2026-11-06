// UX-10 P2: the media dialog gains a header shape, one fixed shape, no warning tab, and a round guide, for a profile's pictures.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { frameRatio } from "./cropStyle";
import { EditMediaDialog, POST_ASPECTS, type PictureSource } from "./EditMediaDialog";

afterEach(() => cleanup());

const source: PictureSource = { still: "https://cdn.test/me.jpg", width: 1600, height: 900, crop: null, alt: "", returnTo: null };

function openPicture(props: Partial<Parameters<typeof EditMediaDialog>[0]> = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const onRemove = vi.fn();
  render(
    <EditMediaDialog
      request={null}
      editor={null}
      phone={false}
      picture={source}
      onClose={onClose}
      onSave={onSave}
      aspects={["square"]}
      round
      showWarning={false}
      remove={{ label: "Remove picture", onRemove }}
      {...props}
    />,
  );
  return { onSave, onClose, onRemove, dialog: screen.getByTestId("edit-media-dialog") };
}

describe("the header shape", () => {
  it("is 4 wide to 1 high; the post shapes are unchanged", () => {
    expect(frameRatio("header", 1.5)).toBe(4);
    expect(frameRatio("wide", 1.5)).toBe(16 / 9);
    expect(frameRatio("square", 1.5)).toBe(1);
    expect(frameRatio("original", 1.5)).toBe(1.5);
  });

  it("is never offered to a post", () => {
    expect(POST_ASPECTS).toEqual(["original", "wide", "square"]);
  });
});

describe("a profile picture in the dialog", () => {
  it("offers one fixed shape, says so, and keeps the title Crop media", () => {
    const { dialog } = openPicture();
    const shapes = dialog.querySelectorAll("[data-shape-button]");
    expect(shapes).toHaveLength(1);
    expect(shapes[0].getAttribute("aria-pressed")).toBe("true");
    expect(shapes[0].getAttribute("aria-disabled")).toBe("true");
    expect(within(dialog).getByText("Only shape for a profile picture")).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Crop media" })).toBeInTheDocument();
  });

  it("draws the round guide for a picture, and none for a header", () => {
    const first = openPicture();
    expect(first.dialog.querySelector("[data-round-guide]")).not.toBeNull();
    cleanup();
    const second = openPicture({ aspects: ["header"], round: false, remove: { label: "Remove header", onRemove: vi.fn() } });
    expect(second.dialog.querySelector("[data-round-guide]")).toBeNull();
    expect(second.dialog.querySelector('[data-aspect="header"]')).not.toBeNull();
    expect(within(second.dialog).getByText("Only shape for a header")).toBeInTheDocument();
  });

  it("has no Content warning tab with showWarning off, and keeps ALT", () => {
    const { dialog } = openPicture();
    expect(within(dialog).getAllByRole("tab")).toHaveLength(2);
    expect(within(dialog).getByRole("tab", { name: "Crop" })).toBeInTheDocument();
    expect(within(dialog).getByRole("tab", { name: "ALT" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("tab", { name: "Content warning" })).toBeNull();
  });

  it("hands back the crop and the ALT on Save", () => {
    const { dialog, onSave, onClose } = openPicture();
    fireEvent.click(within(dialog).getByRole("button", { name: "Zoom in" }));
    fireEvent.click(within(dialog).getByRole("tab", { name: "ALT" }));
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Maya at her desk" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    const edit = onSave.mock.calls[0][0];
    expect(edit.alt).toBe("Maya at her desk");
    expect(edit.crop).not.toBeNull();
    // A square crop of a 16:9 picture: the crop's shape in pixels is 1:1.
    expect((edit.crop.w * 1600) / (edit.crop.h * 900)).toBeCloseTo(1, 3);
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the stored crop when Save is pressed without cropping", () => {
    const crop = { x: 0.1, y: 0, w: 0.5, h: 0.8889 };
    const { dialog, onSave } = openPicture({ picture: { ...source, crop } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(onSave.mock.calls[0][0].crop).toEqual(crop);
  });

  it("Back writes nothing", () => {
    const { dialog, onSave, onClose } = openPicture();
    fireEvent.click(within(dialog).getByRole("button", { name: "Back without saving" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("offers Remove picture as a quiet button", () => {
    const { dialog, onRemove } = openPicture();
    const button = within(dialog).getByRole("button", { name: "Remove picture" });
    expect(button.getAttribute("data-variant")).toBe("ghost");
    fireEvent.click(button);
    expect(onRemove).toHaveBeenCalled();
  });
});
