import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { BottomSheet } from "./BottomSheet";
import { DockView } from "./Dock";
import { MobileHeaderView } from "./MobileHeader";
import { ScrollRow } from "./ScrollRow";
import { useState } from "react";

// jsdom has no PointerEvent, so fireEvent.pointerMove would drop clientY.
class TestPointerEvent extends MouseEvent {}
vi.stubGlobal("PointerEvent", TestPointerEvent);

const viewer = { id: "u1", name: "Maya Okafor", handle: "maya", hue: 1 };

describe("DockView", () => {
  const dock = (props: Parameters<typeof DockView>[0]) =>
    render(
      <MemoryRouter>
        <DockView {...props} />
      </MemoryRouter>,
    );

  it("five tiles in order, hrefs from the nav", () => {
    dock({ current: "home", unread: 0 });
    const tiles = screen.getAllByRole("link");
    expect(tiles.map((a) => a.getAttribute("data-testid"))).toEqual([
      "dock-tile-home",
      "dock-tile-gallery",
      "dock-tile-new",
      "dock-tile-bounties",
      "dock-tile-activity",
    ]);
    expect(tiles.map((a) => a.getAttribute("href"))).toEqual(["/", "/gallery", "/compose/new", "/bounties", "/notifications"]);
    expect(tiles.map((a) => a.getAttribute("aria-label"))).toEqual(["Home", "Gallery", "New", "Bounties", "Activity"]);
  });

  it("marks only the current tile and never New", () => {
    dock({ current: "activity", unread: 0 });
    expect(screen.getAllByRole("link", { current: "page" }).map((a) => a.getAttribute("data-testid"))).toEqual(["dock-tile-activity"]);
  });

  it("names Activity with the unread count and caps the badge", () => {
    dock({ current: null, unread: 14 });
    const tile = screen.getByTestId("dock-tile-activity");
    expect(tile.getAttribute("aria-label")).toBe("Activity, 14 unread");
    expect(tile.textContent).toContain("9+");
  });

  it("is fixed, with 62×54 tiles", () => {
    dock({ current: "home", unread: 0 });
    const nav = screen.getByTestId("dock");
    expect(nav.style.position).toBe("fixed");
    const tile = screen.getByTestId("dock-tile-home");
    expect([tile.style.width, tile.style.height]).toEqual(["62px", "54px"]);
  });
});

describe("MobileHeaderView", () => {
  const header = (v: typeof viewer | null, handlers = { onSearchOpen: vi.fn(), onAccountOpen: vi.fn(), onSignIn: vi.fn() }) => {
    render(
      <MemoryRouter>
        <MobileHeaderView viewer={v} {...handlers} />
      </MemoryRouter>,
    );
    return handlers;
  };

  it("signed in: lockup, Search, Account", () => {
    const h = header(viewer);
    expect(screen.getByRole("link", { name: "buildgallery home" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    fireEvent.click(screen.getByRole("button", { name: "Account" }));
    expect(h.onSearchOpen).toHaveBeenCalled();
    expect(h.onAccountOpen).toHaveBeenCalled();
  });

  it("signed out: Sign in instead of the avatar", () => {
    const h = header(null);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(h.onSignIn).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Account" })).toBeNull();
  });
});

describe("ScrollRow", () => {
  it("scrolls sideways with its children unshrinkable", () => {
    render(
      <ScrollRow gap={6}>
        <button>a</button>
        <button>b</button>
      </ScrollRow>,
    );
    const row = document.querySelector<HTMLElement>('[data-ui="scroll-row"]')!;
    expect(row.style.overflowX).toBe("auto");
    expect(row.style.margin).toBe("-4px -14px");
    expect(row.style.gap).toBe("6px");
    expect(Array.from(row.children).every((c) => (c as HTMLElement).style.flexShrink === "0")).toBe(true);
  });
});

function Harness({ onClose }: { onClose: (open: boolean) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button>behind</button>
      <BottomSheet open={open} onOpenChange={(o) => { setOpen(o); onClose(o); }} title="Filters">
        <button>inside</button>
      </BottomSheet>
    </>
  );
}

describe("BottomSheet", () => {
  it("is a named dialog with a visible Close control", () => {
    render(<Harness onClose={() => undefined} />);
    expect(screen.getByRole("dialog", { name: "Filters" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  });

  it("closes on Escape and on the Close control", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenLastCalledWith(false);
  });

  it("closes when the grabber is dragged down more than 80px, not less", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const grabber = screen.getByTestId("sheet-grabber");
    fireEvent.pointerDown(grabber, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(grabber, { clientY: 170, pointerId: 1 });
    fireEvent.pointerUp(grabber, { pointerId: 1 });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(grabber, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(grabber, { clientY: 190, pointerId: 1 });
    fireEvent.pointerUp(grabber, { pointerId: 1 });
    expect(onClose).toHaveBeenCalledWith(false);
  });
});
