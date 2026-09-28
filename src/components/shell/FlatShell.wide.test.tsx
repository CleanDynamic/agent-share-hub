import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FlatShell, type FlatShellProps } from "./FlatShell";

/* ────────────────────────────────────────────────
   BG-P14 — the layout prop, in the DOM.

   jsdom has no layout engine, so nothing here measures anything: these tests
   cover the half of the mode that is a component decision rather than a CSS
   one — which class lands on the root, and whether the right-hand slot is in
   the DOM at all. The measurements are covered as stylesheet text in
   flat-shell.wide.test.ts and as rendered geometry in the browser sweep.

   RC-P06 removed the right rail. The slot that held it survives for the legacy
   editor's workspace on /upload/blueprint alone, so the tests below are about
   when that slot may appear, and the wideRightRail prop they used to pass is
   gone with the rail.
──────────────────────────────────────────────── */

function renderShell(props: Partial<FlatShellProps> = {}) {
  const all: FlatShellProps = {
    navItems: [{ key: "home", label: "Home", icon: null, route: "/" }],
    activeKey: "home",
    onNavClick: vi.fn(),
    user: null,
    onSignIn: vi.fn(),
    onJoin: vi.fn(),
    onUserMenu: vi.fn(),
    onLogoClick: vi.fn(),
    rightRail: <div data-testid="rail" />,
    children: <div data-testid="page" />,
    isMobile: false,
    ...props,
  };
  return render(<FlatShell {...all} />);
}

const root = () => document.querySelector(".fs-root")!;
const slot = () => document.querySelector(".fs-right");

describe("FlatShell layout prop", () => {
  it("defaults to standard and adds no class", () => {
    renderShell();
    expect(root().className).toBe("fs-root");
    expect(root().getAttribute("data-layout")).toBe("standard");
  });

  it("is standard when asked for standard", () => {
    renderShell({ layout: "standard" });
    expect(root().classList.contains("fs-wide")).toBe(false);
  });

  it("adds .fs-wide in wide mode", () => {
    renderShell({ layout: "wide" });
    expect(root().classList.contains("fs-root")).toBe(true);
    expect(root().classList.contains("fs-wide")).toBe(true);
    expect(root().getAttribute("data-layout")).toBe("wide");
  });
});

describe("the right-hand slot across the two modes (RC-P06)", () => {
  it("standard mode renders what the container supplied, as it always did", () => {
    renderShell();
    expect(slot()).not.toBeNull();
  });

  it("standard mode names the slot for its one tenant, the editor workspace", () => {
    renderShell();
    expect(slot()!.getAttribute("aria-label")).toBe("Editor workspace");
  });

  it("wide mode never mounts the slot", () => {
    renderShell({ layout: "wide" });
    expect(slot()).toBeNull();
  });

  it("wide mode leaves the left nav and the centre as the frame's only columns", () => {
    renderShell({ layout: "wide" });
    expect(document.querySelectorAll(".fs-rail")).toHaveLength(1);
    expect(document.querySelector(".fs-centre")).not.toBeNull();
  });

  it("never mounts the slot or the nav on mobile, in either mode", () => {
    renderShell({ isMobile: true, layout: "wide" });
    expect(slot()).toBeNull();
    expect(document.querySelector(".fs-left")).toBeNull();
  });

  it("still respects a container that supplied nothing", () => {
    renderShell({ rightRail: null });
    expect(slot()).toBeNull();
  });
});

describe("the left rail is untouched by the mode", () => {
  it("renders in wide mode exactly as in standard", () => {
    renderShell({ layout: "wide" });
    expect(document.querySelector(".fs-left")).not.toBeNull();
  });

  it("marks the two columns for browser tests to measure", () => {
    const { getByTestId } = renderShell();
    expect(getByTestId("frame-left")).toBe(document.querySelector(".fs-left"));
    expect(getByTestId("frame-centre")).toBe(document.querySelector(".fs-centre"));
  });

  it("still honours hideLeftRail in wide mode", () => {
    renderShell({ layout: "wide", hideLeftRail: true });
    expect(document.querySelector(".fs-left")).toBeNull();
  });
});
