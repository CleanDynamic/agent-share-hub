import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { boardHeight, SiteFrameView } from "./SiteFrame";

const frame = (props: Parameters<typeof SiteFrameView>[0]) =>
  render(
    <MemoryRouter>
      <SiteFrameView {...props} />
    </MemoryRouter>,
  );

describe("boardHeight", () => {
  it("is a fixed height on the board and a minimum on a live route", () => {
    expect(boardHeight("board")).toEqual({ height: 820 });
    expect(boardHeight("content")).toEqual({ minHeight: 820 });
    expect(boardHeight()).toEqual({ minHeight: 820 });
  });
});

describe("SiteFrameView", () => {

  it("uses the phone slots below 768px", () => {
    frame({ viewport: "mobile", header: <i data-testid="h" />, mobileHeader: <i data-testid="mh" />, dock: <i data-testid="d" /> });
    expect(screen.queryByTestId("h")).toBeNull();
    expect(screen.getByTestId("mh")).toBeTruthy();
    expect(screen.getByTestId("d")).toBeTruthy();
  });

  it("bare renders only the backdrop and the page", () => {
    frame({ variant: "bare", header: <i data-testid="h" />, footer: <i data-testid="f" />, children: <p>page</p> });
    expect(screen.queryByTestId("h")).toBeNull();
    expect(screen.queryByTestId("f")).toBeNull();
    expect(screen.getByText("page")).toBeTruthy();
  });
});

/* UI-P87 — the refined frame: the root on --frame, one surface wrapping main and the footer. */
describe("SiteFrameView under the refined look", () => {
  const REFINED = "/dev/kit/pages/home";
  const refinedFrame = (props: Parameters<typeof SiteFrameView>[0]) =>
    render(
      <MemoryRouter initialEntries={[REFINED]}>
        <SiteFrameView {...props} />
      </MemoryRouter>,
    );
  const markup = (props: Parameters<typeof SiteFrameView>[0]) =>
    renderToStaticMarkup(
      <MemoryRouter initialEntries={[REFINED]}>
        <SiteFrameView {...props} />
      </MemoryRouter>,
    );

  it("keeps the slots in order and puts main and the footer inside the one surface (desktop)", () => {
    refinedFrame({
      viewport: "desktop",
      header: <i data-testid="h" />,
      breadcrumb: <i data-testid="b" />,
      footer: <i data-testid="f" />,
      children: <p>page</p>,
    });
    const root = screen.getByTestId("site-frame");
    expect(screen.getByText("Skip to content").getAttribute("href")).toBe("#main");
    const surface = root.querySelector('[data-ui="surface"]')!;
    expect(surface.querySelector("main#main")).not.toBeNull();
    expect(surface.contains(screen.getByTestId("f"))).toBe(true);
    expect(surface.contains(screen.getByTestId("h"))).toBe(false);
    // The page's PageHeader draws the breadcrumb now; the frame keeps its slot for the composer only.
    expect(screen.queryByTestId("b")).toBeNull();
    expect(surface.querySelector("main#main")!.firstElementChild?.textContent).toBe("page");
  });

  it("keeps the breadcrumb slot first in main for the composer (wide)", () => {
    refinedFrame({ viewport: "desktop", wide: true, breadcrumb: <i data-testid="b" />, children: <p>page</p> });
    const main = screen.getByTestId("site-frame").querySelector("main#main")!;
    expect(main.firstElementChild?.contains(screen.getByTestId("b"))).toBe(true);
  });

  it("draws the surface recipe on --frame, with the board's main padding", () => {
    const html = markup({ viewport: "desktop", children: <p>page</p> });
    expect(html).toContain("background:var(--frame)");
    expect(html).toContain("width:calc(100% - 16px);max-width:1428px;margin:0 auto 8px");
    expect(html).toContain("background:var(--surface);border:1px solid var(--surface-border);border-radius:10px;box-shadow:var(--surface-shadow)");
    expect(html).toContain("padding:39px 55px 48px");
  });

  it("keeps the 6px inset and radius 10 on a phone, with the phone header and the dock", () => {
    refinedFrame({ viewport: "mobile", mobileHeader: <i data-testid="mh" />, dock: <i data-testid="d" />, children: <p>page</p> });
    expect(screen.getByTestId("mh")).toBeTruthy();
    expect(screen.getByTestId("d")).toBeTruthy();
    const html = markup({ viewport: "mobile", children: <p>page</p> });
    expect(html).toContain("width:calc(100% - 12px);max-width:1428px;margin:0 auto 6px");
    expect(html).toContain("border-radius:10px");
  });
});

/* G4: the skip link's target takes focus: main is a programmatic focus target (tabIndex -1) and draws no outline. */
describe("G4: main takes the skip link's focus", () => {
  it.each(["site", "bare"] as const)("%s: main has tabIndex -1 and no outline", (variant) => {
    frame({ variant, viewport: "desktop", children: <p>page</p> });
    const main = screen.getByTestId("site-frame").querySelector("main#main") as HTMLElement;
    expect(main.tabIndex).toBe(-1);
    expect(main.style.outline).toBe("none");
    main.focus();
    expect(document.activeElement).toBe(main);
  });
});

/* G22: in a short window (a zoomed one) the header and the dock scroll with the page rather than cover it. */
describe("G22: a short window pins nothing", () => {
  const withMedia = (matches: (query: string) => boolean) => {
    const before = window.matchMedia;
    window.matchMedia = ((query: string) => ({ matches: matches(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
    return () => {
      window.matchMedia = before;
    };
  };

  it("the header slot is sticky in a tall window and relative in a short one", () => {
    let restore = withMedia(() => false);
    const { unmount } = frame({ viewport: "desktop", header: <i />, children: <p>page</p> });
    expect((document.querySelector('[data-slot="header"]') as HTMLElement).style.position).toBe("sticky");
    unmount();
    restore();
    restore = withMedia((query) => query.includes("max-height"));
    frame({ viewport: "desktop", header: <i />, children: <p>page</p> });
    expect((document.querySelector('[data-slot="header"]') as HTMLElement).style.position).toBe("relative");
    restore();
  });
});
