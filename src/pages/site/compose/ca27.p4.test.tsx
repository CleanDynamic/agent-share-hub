// CA-27 P4: tablets. The panel Details becomes between 768 and where it fits beside the build, and the title row at those widths.
// Where each column stands, the long press, the touch scroll and the animation are measured in the browser
// (e2e/audit/composer-ca27.spec.ts); this holds the recipe and the rules.

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { sandboxViewProps } from "@/dev/fixtures/sandbox";
import { BASE } from "@/lib/theme/motion";

import { BUILD_ACTIONS, SandboxView, type SandboxViewProps } from "./SandboxView";
import { OVERLAY_FOOT_COPY, OVERLAY_PANEL_PAD, OVERLAY_WIDTH, TABLET_MAX } from "./detailsRecipes";
import { frameOf, innerWidthOf } from "./detailsLayout";

function stubWidth(px: number) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = min ? px >= Number(min[1]) : max ? px <= Number(max[1]) : false;
    return { matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined };
  });
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: px });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 900 });
}

function view(width: number, over: Partial<SandboxViewProps> = {}) {
  stubWidth(width);
  render(
    <MemoryRouter>
      <SandboxView
        {...sandboxViewProps("bakery")}
        slug="a-build"
        selectedKey="p1"
        onEditSelected={() => undefined}
        selection={
          <div>
            <h3>Prompt 1</h3>
            <p>The text of it</p>
          </div>
        }
        {...over}
      />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the panel", () => {
  it("is 300 wide, the window recipe, padded 14, with the foot at its bottom left", () => {
    view(1024);
    const panel = screen.getByTestId("details-overlay");
    expect(OVERLAY_WIDTH).toBe(300);
    expect(OVERLAY_PANEL_PAD).toBe(14);
    expect(panel.style.width).toBe("300px");
    expect(panel.style.padding).toBe("14px");
    expect(panel.style.borderRadius).toBe("12px");
    // jsdom drops a var() colour from an element's style (`background`, `border`); the browser test reads --window, 1px --window-border and the shadow.
    const foot = within(panel).getByTestId("details-foot");
    expect(foot.textContent).toBe(OVERLAY_FOOT_COPY.tap);
    expect(foot.style.fontSize).toBe("12px");
    expect(foot.style.textAlign).toBe("left");
    // Last in the panel: after the content.
    expect(panel.lastElementChild).toBe(foot);
  });

  it("stands over the composer box's right edge, in the columns area, the full height of it", () => {
    view(1024);
    const slot = screen.getByTestId("details-overlay-slot");
    const columns = screen.getByTestId("sandbox-columns");
    expect(slot.parentElement).toBe(columns);
    const frame = frameOf(innerWidthOf(1024));
    expect(frame.beside).toBe(false);
    // Its right edge is the box's: Build's, where Details is not beside it; the columns area starts 7 in from the window's edge.
    expect(parseFloat(slot.style.left) + 300 + 7).toBe(frame.boxRight);
    expect(slot.style.top).toBe("0px");
    expect(slot.style.bottom).toBe("0px");
    expect(slot.style.pointerEvents).toBe("none");
  });

  it("slides in over BASE: 16 across and a fade", () => {
    const animate = vi.fn(() => ({ cancel: () => undefined }) as unknown as Animation);
    const original = Element.prototype.animate;
    Element.prototype.animate = animate as unknown as typeof Element.prototype.animate;
    try {
      view(1024);
      expect(BASE).toBe(200);
      const calls = animate.mock.calls as unknown as [Keyframe[], KeyframeAnimationOptions][];
      expect(calls.some(([keyframes, options]) => keyframes[0].transform === "translateX(16px)" && keyframes[0].opacity === 0 && keyframes[1].opacity === 1 && options.duration === 200)).toBe(true);
    } finally {
      Element.prototype.animate = original;
    }
  });

  it("closes on a tap outside, and on Escape; a tap inside, or in a menu, does not", () => {
    view(1024);
    const panel = screen.getByTestId("details-overlay");
    fireEvent.pointerDown(within(panel).getByText("The text of it"));
    expect(screen.queryByTestId("details-overlay")).not.toBeNull();
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    document.body.appendChild(menu);
    fireEvent.pointerDown(menu);
    expect(screen.queryByTestId("details-overlay")).not.toBeNull();
    menu.remove();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByTestId("details-overlay")).toBeNull();
    cleanup();
    view(1024);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("details-overlay")).toBeNull();
  });

  it("says Tap to edit up to 1152, and Click to edit with a mouse beyond it", () => {
    expect(TABLET_MAX).toBe(1152);
    view(1152);
    expect(screen.getByTestId("details-foot").textContent).toBe("Tap to edit");
    cleanup();
    view(1240);
    expect(screen.getByTestId("details-foot").textContent).toBe("Click to edit");
  });

  it("is not drawn where Details fits beside the build", () => {
    view(1500);
    expect(screen.queryByTestId("details-overlay")).toBeNull();
    expect(screen.getByTestId("sandbox-details-slot")).toBeTruthy();
  });
});

describe("the title row", () => {
  it("at 768 Preview waits in a 'Build actions' menu and Publish stays", async () => {
    view(768);
    const row = screen.getByTestId("sandbox-tabrow");
    expect(within(row).queryByRole("link", { name: "Preview" })).toBeNull();
    expect(within(row).getByRole("button", { name: "Publish" })).toBeTruthy();
    const menu = within(row).getByRole("button", { name: BUILD_ACTIONS.label });
    expect(menu.style.width).toBe("28px");
    expect(menu.style.height).toBe("28px");
    fireEvent.pointerDown(menu, { button: 0, ctrlKey: false });
    fireEvent.keyDown(menu, { key: "Enter" });
    await act(async () => undefined);
    expect(await screen.findByRole("menuitem", { name: "Preview" })).toBeTruthy();
  });

  it("at 1152 and wider Preview stays beside the title and there is no menu", () => {
    view(1152);
    const row = screen.getByTestId("sandbox-tabrow");
    expect(within(row).getByRole("link", { name: "Preview" })).toBeTruthy();
    expect(within(row).queryByRole("button", { name: BUILD_ACTIONS.label })).toBeNull();
  });

  it("a published build keeps its own row", () => {
    view(768, { published: { slug: "a-build", inGallery: true, shortfall: "" } as SandboxViewProps["published"] });
    expect(screen.queryByRole("button", { name: BUILD_ACTIONS.label })).toBeNull();
  });
});
