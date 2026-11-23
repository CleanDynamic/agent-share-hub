// CA-24 P1 - the first load: the skeleton stands where the columns will, from `frameOf`, at every width; the content takes its
// place without anything moving; and a screen reader meets one "Loading the build".

import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetMotionMediaCache } from "@/lib/theme/motion";

import { ComposeArrival, ComposeSkeleton } from "./ComposeSkeleton";
import { LIST_GUTTER, ORIGIN, frameOf, innerWidthOf } from "./detailsLayout";
import { COUNTS_WIDTH, DETAILS_WIDTHS, PANEL_PAD, SOURCES_WIDTHS, TILES, TILE_INSET, resetFirstShow } from "./loadingBlocks";

function stage(width: number, phone = false, reduced = false) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 900 });
  vi.stubGlobal("matchMedia", (query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query);
    const min = /min-width:\s*(\d+)px/.exec(query);
    const matches = query.includes("reduce") ? reduced : max ? width <= Number(max[1]) : min ? width >= Number(min[1]) : false;
    return { matches: phone && max ? true : matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined };
  });
  __resetMotionMediaCache();
}

beforeEach(resetFirstShow);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  __resetMotionMediaCache();
});

const px = (value: string) => Number.parseFloat(value);
const widthsIn = (testId: string) => within(screen.getByTestId(testId)).getAllByTestId("loading-blocks").map((block) => px((block as HTMLElement).style.width));

describe.each([1024, 1100, 1280, 1440, 1920])("the skeleton at %i", (width) => {
  it("stands each panel where frameOf puts it (Synth 09)", () => {
    stage(width);
    render(<ComposeSkeleton />);
    const frame = frameOf(innerWidthOf(width));
    const sources = screen.getByTestId("skeleton-sources");
    const build = screen.getByTestId("skeleton-build");
    expect(px(sources.style.left)).toBe(frame.sourcesLeft - ORIGIN);
    expect(px(sources.style.width)).toBe(frame.sources);
    expect(px(build.style.marginLeft)).toBe(frame.buildLeft - ORIGIN);
    expect(px(build.style.width)).toBe(frame.build);
    // The panels start 8 under the title row's panel, as the real ones do, and pad their content 16 in.
    expect(screen.getByTestId("skeleton-columns").style.padding).toBe("8px 0px 0px");
    expect(build.style.padding).toBe(`${PANEL_PAD}px`);
    if (frame.beside) {
      const details = screen.getByTestId("skeleton-details");
      expect(px(details.style.left)).toBe(frame.detailsLeft - ORIGIN);
      expect(px(details.style.width)).toBe(frame.detailsWidth);
      expect(widthsIn("skeleton-details")).toEqual(DETAILS_WIDTHS.map((w) => Math.min(w, frame.detailsWidth - 2 * PANEL_PAD)));
    } else {
      expect(screen.queryByTestId("skeleton-details")).toBeNull();
    }
  });

  it("draws the blocks the board names", () => {
    stage(width);
    render(<ComposeSkeleton />);
    const frame = frameOf(innerWidthOf(width));
    expect(widthsIn("skeleton-sources")).toEqual(SOURCES_WIDTHS.map((w) => Math.min(w, frame.sources - 2 * PANEL_PAD)));
    const build = within(screen.getByTestId("skeleton-build")).getAllByTestId("loading-blocks") as HTMLElement[];
    // The post (3 rows at the post's width), the counts line, then five tiles of 3 rows at the tile width.
    expect(build).toHaveLength(2 + TILES);
    expect([build[0].getAttribute("data-rows"), px(build[0].style.width)]).toEqual(["3", frame.build - 2 * PANEL_PAD]);
    expect([build[1].getAttribute("data-rows"), px(build[1].style.width)]).toEqual(["1", COUNTS_WIDTH]);
    // SV-05 P4: a tile box is a tile's height.
    for (const tile of build.slice(2)) expect([tile.getAttribute("data-rows"), px(tile.style.width)]).toEqual(["9", frame.build - 2 * PANEL_PAD - LIST_GUTTER - TILE_INSET]);
    const title = within(screen.getByTestId("skeleton-tabrow")).getAllByTestId("loading-blocks");
    expect(title.map((block) => px((block as HTMLElement).style.width))).toEqual([180, 120]);
  });

  it("G20: says what is loading once, never a bare Loading, is busy, and hides the blocks", () => {
    stage(width);
    render(<ComposeSkeleton />);
    expect(screen.getAllByText("Loading the build")).toHaveLength(1);
    expect(screen.queryByText("Loading")).toBeNull();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
    for (const block of screen.getAllByTestId("loading-blocks")) expect(block.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("the skeleton from 761 to 1023 (Synth 09)", () => {
  it("has no Sources panel (Sources is a button there), and Build fills the width", () => {
    stage(900);
    render(<ComposeSkeleton />);
    const frame = frameOf(innerWidthOf(900));
    expect(screen.queryByTestId("skeleton-sources")).toBeNull();
    expect(screen.queryByTestId("skeleton-details")).toBeNull();
    expect(px(screen.getByTestId("skeleton-build").style.width)).toBe(frame.build);
  });
});

describe("the skeleton on a phone", () => {
  it("is one column: the title lines, then the post and the tiles", () => {
    stage(390, true);
    render(<ComposeSkeleton />);
    const root = screen.getByTestId("compose-skeleton");
    expect(root.getAttribute("data-layout")).toBe("phone");
    expect(screen.queryByTestId("skeleton-sources")).toBeNull();
    expect(screen.queryByTestId("skeleton-details")).toBeNull();
    const blocks = within(root).getAllByTestId("loading-blocks");
    expect(blocks.map((block) => block.getAttribute("data-rows"))).toEqual(["1", "1", "3", "1", "9", "9", "9", "9", "9"]);
  });
});

describe("building and the swap", () => {
  it("builds on the first show only", () => {
    // Part E: every show of a block builds in from its top in the dot field, so the first show and the next draw the same
    // boxes; nothing in the DOM rises any more.
    stage(1440);
    const boxes = (container: HTMLElement) =>
      Array.from(container.querySelectorAll<HTMLElement>('[data-testid="loading-blocks"]')).map((block) => [block.style.width, block.style.height]);
    const first = render(<ComposeSkeleton />);
    const shown = boxes(first.container);
    expect(first.container.innerHTML).not.toContain("bgLoadRise");
    first.unmount();
    const second = render(<ComposeSkeleton />);
    expect(boxes(second.container)).toEqual(shown);
  });

  it("shows the content over a copy of the skeleton that fades out, then leaves only the content", () => {
    stage(1440);
    vi.useFakeTimers();
    const content = <p data-testid="content">the composer</p>;
    const { rerender } = render(<ComposeArrival loading>{null}</ComposeArrival>);
    expect(screen.queryByTestId("content")).toBeNull();
    expect(screen.getByTestId("compose-skeleton")).toBeTruthy();
    rerender(<ComposeArrival loading={false}>{content}</ComposeArrival>);
    // The content is in at once, fading in over 250 ms; the blocks stay in the same place as a ghost.
    expect(screen.getByTestId("content")).toBeTruthy();
    const ghost = screen.getByTestId("compose-skeleton-ghost");
    expect(ghost.style.position).toBe("absolute");
    expect(ghost.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByTestId("compose-arrival").firstElementChild?.getAttribute("style")).toContain("bgContentIn 250ms");
    act(() => {
      vi.advanceTimersByTime(50);
    });
    // Part E: the ghost's blocks are gone (their dots wind down in the field), their boxes where they were.
    expect(within(ghost).getAllByTestId("loading-blocks")[0].hasAttribute("data-gone")).toBe(true);
    act(() => {
      ghost.dispatchEvent(new Event("transitionend", { bubbles: true }));
    });
    expect(screen.queryByTestId("compose-skeleton-ghost")).toBeNull();
    expect(screen.getByTestId("content")).toBeTruthy();
    vi.useRealTimers();
  });

  it("is an instant swap under reduced motion", () => {
    stage(1440, false, true);
    const { rerender } = render(<ComposeArrival loading>{null}</ComposeArrival>);
    rerender(
      <ComposeArrival loading={false}>
        <p data-testid="content">the composer</p>
      </ComposeArrival>,
    );
    expect(screen.getByTestId("content")).toBeTruthy();
    expect(screen.queryByTestId("compose-skeleton-ghost")).toBeNull();
    expect(screen.queryByTestId("loading-blocks")).toBeNull();
  });

  it("shows content that was never loading at once", () => {
    stage(1440);
    render(
      <ComposeArrival loading={false}>
        <p data-testid="content">the composer</p>
      </ComposeArrival>,
    );
    expect(screen.getByTestId("content")).toBeTruthy();
    expect(screen.queryByTestId("compose-arrival")).toBeNull();
  });
});
