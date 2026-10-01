import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { boardHeight, SiteFrameView } from "./SiteFrame";
import { SITE_FRAME_ROUTES, usesSiteFrame } from "./siteFrameRoutes";

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

describe("usesSiteFrame", () => {
  it("starts empty", () => {
    expect(SITE_FRAME_ROUTES).toEqual([]);
    expect(usesSiteFrame("/notifications")).toBe(false);
  });
});

describe("SiteFrameView", () => {
  it("draws the backdrop first, then a skip link, main#main and the slots (desktop)", () => {
    frame({ viewport: "desktop", header: <i data-testid="h" />, footer: <i data-testid="f" />, children: <p>page</p> });
    const root = screen.getByTestId("site-frame");
    expect(root.firstElementChild?.getAttribute("data-ui")).toBe("page-backdrop");
    expect(screen.getByText("Skip to content").getAttribute("href")).toBe("#main");
    expect(root.querySelector("main#main")).not.toBeNull();
    expect(screen.getByTestId("h")).toBeTruthy();
    expect(screen.getByTestId("f")).toBeTruthy();
  });

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
