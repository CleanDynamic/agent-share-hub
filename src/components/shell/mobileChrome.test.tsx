import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { BottomSheet } from "./BottomSheet";
import { DockView } from "./Dock";
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

  /* Prompt 19: New opens the New sheet, so it is a button; the other four are links to the same routes as before. */
  it("five slots in order: four links to the nav's routes and New between Builds and OpenBuilds", () => {
    dock({ current: "home", unread: 0 });
    const slots = Array.from(screen.getByRole("navigation", { name: "Primary" }).children);
    expect(slots.map((el) => el.getAttribute("data-testid"))).toEqual([
      "dock-tile-home",
      "dock-tile-gallery",
      "dock-tile-new",
      "dock-tile-openbuilds",
      "dock-tile-activity",
    ]);
    const tiles = screen.getAllByRole("link");
    expect(tiles.map((a) => a.getAttribute("href"))).toEqual(["/", "/builds", "/openbuilds", "/notifications"]);
    expect(tiles.map((a) => a.getAttribute("aria-label"))).toEqual(["Home", "Builds", "OpenBuilds", "Activity"]);
    expect(screen.getByRole("button", { name: "New" })).toBe(screen.getByTestId("dock-tile-new"));
  });

  it("marks only the current slot and never New", () => {
    dock({ current: "activity", unread: 0 });
    expect(screen.getAllByRole("link", { current: "page" }).map((a) => a.getAttribute("data-testid"))).toEqual(["dock-tile-activity"]);
    expect(screen.getByTestId("dock-tile-new").getAttribute("aria-current")).toBeNull();
  });

  it("names Activity with the unread count and draws a Mint square, not a number", () => {
    dock({ current: null, unread: 14 });
    const tile = screen.getByTestId("dock-tile-activity");
    expect(tile.getAttribute("aria-label")).toBe("Activity, 14 unread");
    expect(tile.textContent).toBe("Activity");
    expect(screen.getByTestId("dock-unread")).toBeTruthy();
  });

  it("New calls onNew", () => {
    const onNew = vi.fn();
    dock({ current: null, unread: 0, onNew });
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    expect(onNew).toHaveBeenCalledTimes(1);
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
    // UI-P52 density pass: the bleed follows the page's gutter, 14 → 10, and the
    // drawn 6px gap renders at 4.
    expect(row.style.margin).toBe("-4px -10px");
    expect(row.style.padding).toBe("4px 10px");
    expect(row.style.gap).toBe("4px");
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
    expect(screen.getByRole("button", { name: /^Close/ })).toBeTruthy();
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

/* UI-P87, then prompt 19 — the phone chrome: the dock on Page with no glass, sheets on the window recipe. */
describe("phone chrome under the refined look", () => {
  const REFINED = "/dev/kit/pages/home";
  const inRefined = (node: React.ReactElement) => <MemoryRouter initialEntries={[REFINED]}>{node}</MemoryRouter>;

  it("the dock is the Page shade with no glass, the structural line on its top edge, no lamp and no glow, 5 equal slots, New a 44 by 28 Mint pill", () => {
    render(inRefined(<DockView current="gallery" unread={4} />));
    expect(screen.getByTestId("dock-tile-gallery").getAttribute("aria-current")).toBe("page");
    const html = renderToStaticMarkup(inRefined(<DockView current="gallery" unread={4} />));
    const nav = html.slice(html.indexOf("<nav"), html.indexOf(">", html.indexOf("<nav")));
    expect(nav).toContain("background:var(--bg)");
    expect(nav).toContain("grid-template-columns:repeat(5, 1fr)");
    expect(nav).toContain("padding-bottom:env(safe-area-inset-bottom)");
    expect(nav).not.toMatch(/[;"]border(-top)?:/);
    expect(html).not.toContain("backdrop-filter");
    expect(html).not.toContain("var(--dock)");
    expect(html).not.toContain("nav-lamp");
    expect(html).not.toContain('data-ui="nav-mark"');
    expect(html).toContain("width:44px;height:28px;border-radius:14px;background:var(--brand-accent);color:var(--on-brand-accent)");
    expect(html).toContain("width:9px;height:9px;border-radius:3px;background:var(--brand-accent);box-shadow:0 0 0 2px var(--bg)");
  });

  it("the current slot is the filled icon with its label 600 in Text; the others are Text 3 at 500", () => {
    render(inRefined(<DockView current="gallery" unread={0} />));
    expect(screen.getByTestId("dock-tile-gallery").querySelector('[data-icon="buildsf"]')).toBeTruthy();
    expect(screen.getByTestId("dock-tile-home").querySelector('[data-icon="home"]')).toBeTruthy();
    expect(screen.getByTestId("dock-tile-gallery").getAttribute("style")).toContain("font-weight: 600");
    expect(screen.getByTestId("dock-tile-home").getAttribute("style")).toContain("font-weight: 500");
  });

  it("a sheet takes the window recipe over --scrim, and keeps its name and Close", () => {
    render(
      inRefined(
        <BottomSheet open onOpenChange={vi.fn()} title="Account">
          <p>inside</p>
        </BottomSheet>,
      ),
    );
    expect(screen.getByRole("dialog", { name: "Account" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Close/ })).toBeTruthy();
    const sheet = screen.getByTestId("bottom-sheet");
    expect(sheet.style.borderRadius).toBe("12px 12px 0 0");
    expect(sheet.style.backdropFilter ?? "").toBe("");
  });
});
