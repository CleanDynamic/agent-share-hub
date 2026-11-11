// BF-06 P1 (A1): the Filters dialog. The claims: it draws nothing closed; open, it is a dialog named Filters holding what
// it is given and a Done button; Escape, Close and Done each ask to close; it has the spec's size on a desktop and fills
// the screen on a phone.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const phone = vi.hoisted(() => ({ on: false }));
vi.mock("@/components/shell/useMinWidth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/shell/useMinWidth")>()),
  useIsPhone: () => phone.on,
}));

import { BuildsFiltersDialog, dialogFrame } from "./BuildsFiltersDialog";

beforeEach(() => {
  phone.on = false;
});

function draw(open: boolean, onOpenChange = vi.fn()) {
  render(
    <BuildsFiltersDialog open={open} onOpenChange={onOpenChange}>
      <p>The filter panel</p>
    </BuildsFiltersDialog>,
  );
  return onOpenChange;
}

describe("BuildsFiltersDialog", () => {
  it("closed: nothing is drawn", () => {
    draw(false);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("The filter panel")).toBeNull();
  });

  it("open: a dialog named Filters holds its children and a Done button", () => {
    draw(true);
    const dialog = screen.getByRole("dialog", { name: "Filters" });
    expect(dialog.textContent).toContain("The filter panel");
    expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();
  });

  it("Escape, the Close button and Done each call onOpenChange(false)", () => {
    for (const close of [
      () => fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" }),
      () => fireEvent.click(screen.getByRole("button", { name: "Close" })),
      () => fireEvent.click(screen.getByRole("button", { name: "Done" })),
    ]) {
      const onOpenChange = draw(true);
      close();
      expect(onOpenChange).toHaveBeenCalledWith(false);
      cleanup();
    }
  });

  // jsdom drops `min()` and `dvh` from an inline style, so the size is read from the frame the content is given.
  it("the content has the spec's desktop size", () => {
    draw(true);
    expect(screen.getByTestId("builds-filters-dialog").style.gridTemplateRows).toBe("auto minmax(0, 1fr) auto");
    expect(dialogFrame(false)).toMatchObject({ width: "min(820px, calc(100vw - 28px))", height: "min(640px, calc(100dvh - 28px))", top: "50%", left: "50%" });
  });

  it("on a phone it fills the screen", () => {
    phone.on = true;
    draw(true);
    const content = screen.getByTestId("builds-filters-dialog");
    expect(content.style.inset).toMatch(/^0(px)?$/);
    expect(content.style.borderRadius).toMatch(/^0(px)?$/);
    expect(dialogFrame(true)).toMatchObject({ inset: 0, borderRadius: 0, border: 0 });
    expect(dialogFrame(true)).not.toHaveProperty("width");
  });
});
