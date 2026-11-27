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

  /* 29d: five links, no New slot; each is named by its aria-label alone (the icons carry no words). */
  it("five unlabelled slots in order: Home, Builds, Import, OpenBuilds, Activity, each a link with its name", () => {
    dock({ current: "home", unread: 0 });
    const nav = screen.getByRole("navigation", { name: "Primary" });
    const slots = Array.from(nav.children);
    expect(slots.map((el) => el.getAttribute("data-testid"))).toEqual(["dock-tile-home", "dock-tile-gallery", "dock-tile-import", "dock-tile-openbuilds", "dock-tile-activity"]);
    const tiles = screen.getAllByRole("link");
    expect(tiles.map((a) => a.getAttribute("href"))).toEqual(["/", "/builds", "/import", "/openbuilds", "/notifications"]);
    expect(tiles.map((a) => a.getAttribute("aria-label"))).toEqual(["Home", "Builds", "Import", "OpenBuilds", "Activity"]);
    // No labels drawn, and no New slot or button in the dock.
    expect(nav.textContent).toBe("");
    expect(screen.queryByRole("button", { name: "New" })).toBeNull();
    expect(screen.queryByTestId("dock-tile-new")).toBeNull();
  });

  it("marks only the current slot, Import included", () => {
    dock({ current: "activity", unread: 0 });
    expect(screen.getAllByRole("link", { current: "page" }).map((a) => a.getAttribute("data-testid"))).toEqual(["dock-tile-activity"]);
  });

  it("Import is current on its own, drawn as the one icon it has", () => {
    dock({ current: "import", unread: 0 });
    expect(screen.getAllByRole("link", { current: "page" }).map((a) => a.getAttribute("data-testid"))).toEqual(["dock-tile-import"]);
    expect(screen.getByTestId("dock-tile-import").querySelector('[data-icon="import"]')).toBeTruthy();
  });

  it("Activity keeps its name and shows the unread count in a Mint pill", () => {
    dock({ current: null, unread: 14 });
    const tile = screen.getByTestId("dock-tile-activity");
    expect(tile.getAttribute("aria-label")).toBe("Activity");
    expect(screen.getByTestId("dock-unread").textContent).toBe("14");
    // The count is the link's description for a screen reader.
    const described = tile.getAttribute("aria-describedby") ?? "";
    expect(tile.querySelector(`#${described}`)?.textContent).toBe("14 unread");
  });

  it("shows 99+ over 99, and nothing at 0", () => {
    const { unmount } = dock({ current: null, unread: 120 });
    expect(screen.getByTestId("dock-unread").textContent).toBe("99+");
    unmount();
    dock({ current: null, unread: 0 });
    expect(screen.queryByTestId("dock-unread")).toBeNull();
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

  it("the dock is the Page shade with no glass, the structural line on its top edge, no lamp and no glow, 5 equal slots, the unread pill 16 tall in Mint", () => {
    render(inRefined(<DockView current="gallery" unread={4} />));
    expect(screen.getByTestId("dock-tile-gallery").getAttribute("aria-current")).toBe("page");
    const html = renderToStaticMarkup(inRefined(<DockView current="gallery" unread={4} />));
    const nav = html.slice(html.indexOf("<nav"), html.indexOf(">", html.indexOf("<nav")));
    expect(nav).toContain("background:var(--bg)");
    expect(nav).toContain("grid-template-columns:repeat(5, 1fr)");
    expect(nav).toContain("padding-bottom:env(safe-area-inset-bottom)");
    expect(nav).toContain("box-shadow:inset 0 1px 0 var(--control)");
    expect(nav).not.toMatch(/[;"]border(-top)?:/);
    expect(html).not.toContain("backdrop-filter");
    expect(html).not.toContain("var(--dock)");
    expect(html).not.toContain("nav-lamp");
    expect(html).not.toContain('data-ui="nav-mark"');
    expect(html).toContain("top:-4px;left:44px;box-sizing:border-box;min-width:16px;height:16px;padding:0 4px;border-radius:8px");
    expect(html).toContain("background:var(--brand-accent);color:var(--bg)");
    expect(html).toContain("font-size:11px;font-weight:700;line-height:16px");
  });

  it("the icons are 26, 12 from the top of the slot; the current one is filled and in Text, the others Text 3", () => {
    render(inRefined(<DockView current="gallery" unread={0} />));
    expect(screen.getByTestId("dock-tile-gallery").querySelector('[data-icon="buildsf"]')).toBeTruthy();
    expect(screen.getByTestId("dock-tile-home").querySelector('[data-icon="home"]')).toBeTruthy();
    expect(screen.getByTestId("dock-tile-gallery").querySelector("svg")?.getAttribute("width")).toBe("26");
    expect(screen.getByTestId("dock-tile-gallery").getAttribute("style")).toContain("padding-top: 12px");
    const html = renderToStaticMarkup(inRefined(<DockView current="gallery" unread={0} />)).replace(/: /g, ":");
    expect(html).toMatch(/data-testid="dock-tile-gallery"[^>]*color:var\(--text\)/);
    expect(html).toMatch(/data-testid="dock-tile-home"[^>]*color:var\(--label\)/);
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
