// SV-12 P1: the Maps view, drawn from the board's sample builds through the page's own path (the composer's layout, then
// `cardOf`). The claims: a card says its build in words and hides the drawing, a build with one session says so, the
// direction switch swaps the drawing at once, the grid has three columns wide and fewer below, a box reads as the
// composer's session does, a line is found for each pair of sessions, and the view takes everything through props.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { visionBuildsMapsProps } from "@/dev/fixtures/vision/builds-maps";

import BuildsMapsView, { BOX_H, BOX_W, WELL_H, WELL_W, type BuildsMapsViewProps } from "./BuildsMapsView";

function media(width: number) {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    return {
      matches: min ? width >= Number(min[1]) : false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      onchange: null,
      dispatchEvent: () => false,
    };
  }) as unknown as typeof window.matchMedia;
}

beforeEach(() => media(1440));

function draw(over: Partial<BuildsMapsViewProps> = {}) {
  return render(
    <MemoryRouter>
      <BuildsMapsView {...visionBuildsMapsProps(over)} />
    </MemoryRouter>,
  );
}

const cards = () => screen.getAllByTestId("map-card");

describe("the page", () => {
  it("has the board's head, and the Filters control with its count", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Builds" })).toBeTruthy();
    expect(screen.getByText("Each build's Map: one box per session, one line where a tile in one session uses something from another.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Filters/ }).textContent).toContain("6");
    expect(screen.getByText(/18 builds · 14 with a Map/)).toBeTruthy();
  });

  it("draws one card for each build", () => {
    draw();
    expect(cards()).toHaveLength(6);
    expect(within(cards()[0]).getByRole("link", { name: "Call notes that write themselves" })).toBeTruthy();
    expect(within(cards()[0]).getByText("@maya · 3 sessions")).toBeTruthy();
    expect(within(cards()[1]).getByText("@mira · 2 parts · 5 sessions")).toBeTruthy();
    expect(within(cards()[0]).getByText("6 reproduced")).toBeTruthy();
  });

  it("is three columns wide, two below 1100 and one below 760", () => {
    const columns = () => (screen.getAllByTestId("map-card")[0].parentElement as HTMLElement).style.gridTemplateColumns;
    const first = draw();
    expect(columns()).toBe("repeat(3, minmax(0, 1fr))");
    first.unmount();
    media(1000);
    const second = draw();
    expect(columns()).toBe("repeat(2, minmax(0, 1fr))");
    second.unmount();
    media(500);
    draw();
    expect(columns()).toBe("repeat(1, minmax(0, 1fr))");
  });

  it("lets the browser skip the cards past the first screen", () => {
    const sample = visionBuildsMapsProps().cards;
    draw({ cards: [...sample, ...sample.map((card) => ({ ...card, id: `${card.id}-again` }))] });
    // jsdom does not know the property, so React's assignment is read back as it was made.
    const skipped = (card: HTMLElement) => (card.style as unknown as Record<string, string>).contentVisibility;
    expect(skipped(cards()[6])).toBe("auto");
    expect(skipped(cards()[5])).toBeUndefined();
    expect(skipped(cards()[0])).toBeUndefined();
  });

  it("draws the first four filters and says how many more", () => {
    draw();
    expect(screen.getAllByRole("button", { name: /^Remove filter/ })).toHaveLength(4);
    expect(screen.getByText("+ 2 more")).toBeTruthy();
  });

  it("reports a removed filter and a chosen direction", () => {
    const onRemoveChip = vi.fn();
    const onDirection = vi.fn();
    draw({ onRemoveChip, onDirection });
    fireEvent.click(screen.getByRole("button", { name: "Remove filter Field" }));
    expect(onRemoveChip).toHaveBeenCalledWith("Field");
    fireEvent.click(screen.getByRole("button", { name: "Vertical" }));
    expect(onDirection).toHaveBeenCalledWith("vertical");
    expect(screen.getByRole("button", { name: "Horizontal" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("opens the Table's own filter panel under the row, and only when there is one", () => {
    draw({ panel: <p>The Table's filters</p> });
    expect(screen.queryByText("The Table's filters")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    expect(screen.getByText("The Table's filters")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Filters/ }).getAttribute("aria-expanded")).toBe("true");
  });
});

describe("a card's Map", () => {
  const boxesOf = (card: HTMLElement) => [...card.querySelectorAll<HTMLElement>("[aria-hidden] > span")].filter((span) => span.style.width !== "");

  it("names itself in words and hides the drawing from assistive technology", () => {
    draw();
    const group = within(cards()[0]).getByRole("group", { name: /^Map of Call notes that write themselves: 3 sessions, S1 Transcribe, S2 Clean-up, S3 Summary\./ });
    expect(group.getAttribute("aria-label")).toContain("Lines: S1 to S2, S1 to S3, S2 to S3.");
    expect(group.querySelector("[aria-hidden='true']")).not.toBeNull();
  });

  it("draws a box for each session at the board's size, with its name and its model", () => {
    draw();
    const boxes = boxesOf(cards()[0]);
    expect(boxes).toHaveLength(3);
    expect(boxes[0].style.height).toBe(`${BOX_H}px`);
    expect(boxes[0].style.width).toBe(`${Math.round((BOX_W / WELL_W) * 10000) / 100}%`);
    expect(boxes[0].textContent).toBe("S1 TranscribeOPUS · 4");
    expect(boxes[1].textContent).toBe("S2 Clean-upAGENT · 3");
    expect(boxes[2].textContent).toBe("S3 SummaryOPUS · 7");
  });

  it("draws one line for each pair of sessions that use one another, to one decimal", () => {
    draw();
    const paths = [...cards()[0].querySelectorAll("path")];
    expect(paths).toHaveLength(3);
    for (const path of paths) expect(path.getAttribute("d")).toMatch(/^M-?\d+(\.\d)? -?\d+(\.\d)? [CL]/);
    expect(paths.every((path) => !/\d\.\d\d/.test(path.getAttribute("d") ?? ""))).toBe(true);
  });

  it("labels the parts of a build with two, and none for a build with one", () => {
    draw();
    expect(within(cards()[1]).getByText("PART A · RESEARCH")).toBeTruthy();
    expect(within(cards()[1]).getByText("PART B · WRITE")).toBeTruthy();
    expect(within(cards()[0]).queryByText(/^PART /)).toBeNull();
  });

  it("says a build with one session has no Map, and draws its one box", () => {
    draw();
    const single = cards()[5];
    expect(within(single).getByText("One session. A Map needs two.")).toBeTruthy();
    expect(boxesOf(single)).toHaveLength(1);
    expect(single.querySelectorAll("path")).toHaveLength(0);
    expect(within(cards()[0]).queryByText("One session. A Map needs two.")).toBeNull();
  });

  it("keeps every box inside the drawing, which is the well's 400 x 220 or larger when the Map is (the well then scrolls)", () => {
    draw();
    for (const card of cards()) {
      const [, , w, h] = (card.querySelector("svg")?.getAttribute("viewBox") ?? "0 0 0 0").split(" ").map(Number);
      expect(w).toBeGreaterThanOrEqual(WELL_W);
      expect(h).toBeGreaterThanOrEqual(WELL_H);
      for (const box of boxesOf(card)) {
        const left = (parseFloat(box.style.left) / 100) * w;
        const top = (parseFloat(box.style.top) / 100) * h;
        expect(left).toBeGreaterThanOrEqual(0);
        expect(left + BOX_W).toBeLessThanOrEqual(w + 0.5);
        expect(top).toBeGreaterThanOrEqual(0);
        expect(top + BOX_H).toBeLessThanOrEqual(h + 0.5);
      }
    }
  });

  it("makes a well that holds a Map larger than itself a stop for the keyboard, and no other", () => {
    const [first, second] = visionBuildsMapsProps().cards;
    const wide = { ...second, drawings: second.drawings && { ...second.drawings, horizontal: { ...second.drawings.horizontal, width: 524 } } };
    draw({ cards: [first, wide] });
    const wells = cards().map((card) => within(card).getByRole("group"));
    expect(wells[0].getAttribute("tabindex")).toBeNull();
    expect(wells[1].getAttribute("tabindex")).toBe("0");
    expect(wells[1].style.overflow).toBe("auto");
  });

  it("swaps the drawing at once when the direction changes, with no motion", () => {
    const { rerender } = draw();
    const horizontal = boxesOf(cards()[1]).map((box) => [box.style.left, box.style.top]);
    rerender(
      <MemoryRouter>
        <BuildsMapsView {...visionBuildsMapsProps({ direction: "vertical" })} />
      </MemoryRouter>,
    );
    const vertical = boxesOf(cards()[1]).map((box) => [box.style.left, box.style.top]);
    expect(vertical).toHaveLength(horizontal.length);
    expect(vertical).not.toEqual(horizontal);
    for (const element of document.querySelectorAll<HTMLElement>("[data-testid='map-card'] *")) {
      expect(element.style.transition).toBe("");
      expect(element.style.animation).toBe("");
    }
  });

  it("shows a card whose Map has not arrived as its title with a block in the well", () => {
    draw({ cards: visionBuildsMapsProps().cards.map((card) => ({ ...card, drawings: null })) });
    expect(within(cards()[0]).getByRole("link", { name: "Call notes that write themselves" })).toBeTruthy();
    expect(cards()[0].querySelectorAll("path")).toHaveLength(0);
  });
});

describe("an empty page", () => {
  it("draws the empty sentence and nothing else", () => {
    draw({ cards: [], empty: <p>No builds match these filters.</p> });
    expect(screen.getByText("No builds match these filters.")).toBeTruthy();
    expect(screen.queryAllByTestId("map-card")).toHaveLength(0);
  });
});
