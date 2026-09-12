import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FlatShell, type FlatShellProps } from "./FlatShell";

/* ────────────────────────────────────────────────
   BG-P14 — the layout prop, in the DOM.

   jsdom has no layout engine, so nothing here measures anything: these tests
   cover the half of the mode that is a component decision rather than a CSS
   one — which class lands on the root, and whether the right rail is in the
   DOM at all. The measurements are covered as stylesheet text in
   flat-shell.wide.test.ts and as rendered geometry in the browser sweep.
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
const rail = () => document.querySelector(".fs-right");

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

describe("the right rail across the two modes", () => {
  it("standard mode renders the rail the container supplied, as it always did", () => {
    renderShell();
    expect(rail()).not.toBeNull();
  });

  it("standard mode ignores wideRightRail entirely", () => {
    renderShell({ wideRightRail: false });
    expect(rail()).not.toBeNull();
  });

  it("wide mode suppresses the rail by default", () => {
    renderShell({ layout: "wide" });
    expect(rail()).toBeNull();
  });

  it("wide mode mounts the rail when the route asked for it", () => {
    renderShell({ layout: "wide", wideRightRail: true });
    expect(rail()).not.toBeNull();
  });

  it("never mounts either rail on mobile, in either mode", () => {
    renderShell({ isMobile: true, layout: "wide", wideRightRail: true });
    expect(rail()).toBeNull();
    expect(document.querySelector(".fs-left")).toBeNull();
  });

  it("still respects a container that supplied no rail", () => {
    renderShell({ layout: "wide", wideRightRail: true, rightRail: null });
    expect(rail()).toBeNull();
  });
});

describe("the left rail is untouched by the mode", () => {
  it("renders in wide mode exactly as in standard", () => {
    renderShell({ layout: "wide" });
    expect(document.querySelector(".fs-left")).not.toBeNull();
  });

  it("still honours hideLeftRail in wide mode", () => {
    renderShell({ layout: "wide", hideLeftRail: true });
    expect(document.querySelector(".fs-left")).toBeNull();
  });
});
