// CA-19 P5: reference groups on their members: the label in the List, Details, the map's tooltip and panel and the
// build page; none for an unnamed group or a single colour; members' edges in the group's colour.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/contexts/ThemeContext";
import { PARTS_S } from "@/dev/fixtures/parts";
import { REFS_COLOURS, REFS_LOGIN, REFS_PLUM, referencesMaking, referencesTree } from "@/dev/fixtures/references";
import type { Making } from "@/lib/build/making";
import { buildCounts, readerMap, readerResults, readerSteps, whatYouNeed } from "@/lib/build/readerSteps";
import { makingWithAllGroupColours, treeWithGroupColours } from "@/lib/build/referenceGroups";
import { nameColourFor } from "@/lib/theme/partColour";
import ReferencesDemo from "@/pages/dev/ReferencesDemo";
import { StepsList } from "@/pages/site/build/BuildSteps";

import { shapeDetailsProps } from "@/dev/fixtures/shapes";

import { DetailsPanel } from "./DetailsPanel";
import { GroupLabelsProvider } from "./groupLabels";

vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: () => undefined })) as never;
});
afterEach(cleanup);

function inApp(children: ReactNode, url = "/dev/kit/pages/sandbox?build=references") {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

const labels = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>("[data-group-label]")].map((label) => label.getAttribute("data-group-label"));
/** A colour as jsdom writes it back in a style. */
const rgb = (hex: string) => hex.toLowerCase();

describe("in the composer", () => {
  it("labels every member of a named group in the List, just before its menu, and nothing else", () => {
    inApp(<ReferencesDemo fit="content" viewport="desktop" />);
    const head = screen.getAllByTestId("session-head").find((el) => el.getAttribute("aria-label")?.startsWith("Session 2"));
    expect(head && labels(head)).toEqual(["Login flow"]);
    const code = screen.getByRole("group", { name: /^Code 4:/ });
    expect(labels(code)).toEqual(["Login flow"]);
    // The unnamed group's tiles and the single colours carry no label.
    expect(labels(screen.getByRole("group", { name: /^Prompt 7:/ }))).toEqual([]);
    expect(labels(screen.getByRole("group", { name: /^Manual step 2:/ }))).toEqual([]);
    expect(labels(document.body).filter((name) => name === "Login flow")).toHaveLength(3);
  });

  it("draws the label 20 tall on the hairline, its dot and name in the group's colour kept readable", () => {
    inApp(<ReferencesDemo fit="content" viewport="desktop" />);
    const label = within(screen.getByRole("group", { name: /^Code 4:/ })).getByTestId("group-label");
    expect(label.style.height).toBe("20px");
    // jsdom drops a var() colour from a style, so the hairline fill is read by the screenshots, not here.
    // Noon: the group's green is moved darker until its name reads at 4.5:1 on the label's own fill.
    const ink = nameColourFor(REFS_COLOURS.login, "noon", "hairline");
    const n = parseInt(ink.slice(1), 16);
    expect((label.lastElementChild as HTMLElement).style.color).toBe(`rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`);
  });

  it("opens the group from a label", () => {
    inApp(<ReferencesDemo fit="content" viewport="desktop" />);
    fireEvent.click(within(screen.getByRole("group", { name: /^Code 4:/ })).getByTestId("group-label"));
    expect((within(screen.getByTestId("group-window")).getByRole("textbox", { name: "Name" }) as HTMLInputElement).value).toBe("Login flow");
  });

  it("says In Login flow under Details' header line, and nothing for a single colour", () => {
    const source = { tree: referencesTree, making: referencesMaking, selected: "rf-c4" };
    const details = (id: string) => (
      <ThemeProvider>
        <GroupLabelsProvider making={referencesMaking}>
          <DetailsPanel {...shapeDetailsProps("one-sitting", id, source)} phone={false} colour={{ what: "Code 4", colour: REFS_COLOURS.login, to: `node:${id}`, onPick: () => undefined }} />
        </GroupLabelsProvider>
      </ThemeProvider>
    );
    const { unmount } = render(details("rf-c4"));
    expect(screen.getByTestId("details-group-label").textContent).toBe("In Login flow");
    unmount();
    render(details("rf-m2"));
    expect(screen.queryByTestId("details-group-label")).toBeNull();
  });

  it("puts no label on a map box, which keeps its outline, and says the group in its tooltip and the panel", () => {
    inApp(<ReferencesDemo fit="content" viewport="desktop" />, "/dev/kit/pages/sandbox?build=references&lens=map");
    const box = document.querySelector<HTMLElement>(`[data-testid="map-box"][data-session-key="${PARTS_S[1]}"]`) as HTMLElement;
    expect(box.title).toBe("Session 2 · in Login flow");
    expect(labels(box)).toEqual([]);
    expect(box.style.borderColor).toBe(rgb(REFS_COLOURS.login));
    fireEvent.click(box);
    expect(screen.getByTestId("panel-group-label").textContent).toBe("Login flow");
  });

  it("draws members' edges in the group's colour: a tile's border, a session's line", () => {
    inApp(<ReferencesDemo fit="content" viewport="desktop" />);
    expect(screen.getByRole("group", { name: /^Code 4:/ }).style.borderColor).toBe(rgb(REFS_COLOURS.login));
    expect(screen.getByRole("group", { name: /^Prompt 7:/ }).style.borderColor).toBe(rgb(REFS_COLOURS.plum));
    expect(REFS_LOGIN && REFS_PLUM).toBeTruthy();
  });
});

describe("on the build page", () => {
  function readerView() {
    const making = makingWithAllGroupColours(referencesMaking) as Making;
    const tree = treeWithGroupColours(referencesTree, referencesMaking);
    const media = new Map();
    const steps = readerSteps(tree, making, media);
    const map = readerMap(tree, making, media);
    return { steps, results: readerResults(tree, media), need: whatYouNeed(steps, tree, making, media), counts: buildCounts(steps), map, groups: map.groups, making, mapAvailable: true, onCopy: async () => true, resolveMedia: () => undefined, otherBody: () => null, focus: null };
  }

  it("labels members for readers as the List does, and draws their edges in the group's colour", () => {
    const { container } = render(
      <ThemeProvider>
        <GroupLabelsProvider making={referencesMaking}>
          <StepsList view={readerView() as never} phone={false} announce={() => undefined} />
        </GroupLabelsProvider>
      </ThemeProvider>,
    );
    const code = container.querySelector('[data-testid="step-card"][data-step="4"]') as HTMLElement;
    expect(labels(code)).toEqual(["Login flow"]);
    expect(code.style.borderColor).toBe(rgb(REFS_COLOURS.login));
    expect(labels(container.querySelector('[data-testid="step-card"][data-step="2"]') as HTMLElement)).toEqual([]);
    expect(labels(container.querySelector('[data-testid="step-card"][data-step="7"]') as HTMLElement)).toEqual([]);
    // A reader's label is a label, not a button.
    expect(code.querySelector("button[data-group-label]")).toBeNull();
  });
});
