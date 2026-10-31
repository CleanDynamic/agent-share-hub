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
    const main = surface.querySelector("main#main")!;
    expect(main.firstElementChild?.contains(screen.getByTestId("b"))).toBe(true);
  });

  it("draws the surface recipe on --frame, with the board's main padding", () => {
    const html = markup({ viewport: "desktop", children: <p>page</p> });
    expect(html).toContain("background:var(--frame)");
    expect(html).toContain("width:calc(100% - 12px);max-width:1428px;margin:0 auto 6px");
    expect(html).toContain("background:var(--surface);border:1px solid var(--surface-border);border-radius:10px;box-shadow:var(--surface-shadow)");
    expect(html).toContain("padding:24px clamp(16px, 4.6vw, 64px) 48px");
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
