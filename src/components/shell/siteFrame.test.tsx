import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { boardHeight, SiteFrameView } from "./SiteFrame";
import { BOARD_FOOTER_GAP, BOARD_FRAME_HEIGHT, BOARD_GRID_HEIGHT } from "./siteFrameFit";

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

  it("bare draws the entrance's own backdrop, on desktop and on a phone", () => {
    const { unmount } = frame({ variant: "bare", viewport: "desktop", children: <p>page</p> });
    expect(screen.getByTestId("site-frame").querySelector('[data-ui="page-backdrop"]')?.getAttribute("data-tone")).toBe("signin");
    unmount();
    frame({ variant: "bare", viewport: "mobile", children: <p>page</p> });
    expect(screen.getByTestId("site-frame").querySelector('[data-ui="page-backdrop"]')?.getAttribute("data-tone")).toBe("signin");
  });
});

describe("the frame's numbers (UI-P55, the density pass)", () => {
  const slot = (name: string) => screen.getByTestId("site-frame").querySelector<HTMLElement>(`[data-slot="${name}"]`)!;
  const main = () => screen.getByTestId("site-frame").querySelector<HTMLElement>("main#main")!;

  it("holds the desktop header at 52, the breadcrumb at 33 and the column 6 under the header", () => {
    frame({ viewport: "desktop", children: <p>page</p> });
    expect(slot("header").style.minHeight).toBe("52px");
    expect(slot("breadcrumb").style.minHeight).toBe("33px");
    expect(main().style.padding).toBe("6px 24px 33px");
  });

  it("puts the footer where the board does in board fit: the board's 1066, less the frame's boxes", () => {
    expect(BOARD_FOOTER_GAP).toBe(66);
    expect(53 + 6 + 33 + BOARD_GRID_HEIGHT + BOARD_FOOTER_GAP + 88).toBe(BOARD_FRAME_HEIGHT);
    frame({ viewport: "desktop", fit: "board", children: <p>page</p> });
    expect(main().style.padding).toBe("6px 24px 66px");
  });

  it("holds the phone header at 48 and the column 9 apart", () => {
    frame({ viewport: "mobile", children: <p>page</p> });
    expect(slot("mobile-header").style.minHeight).toBe("48px");
    expect(main().style.gap).toBe("9px");
  });
});
