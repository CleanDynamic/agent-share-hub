// CA-17 P4, P6, MS-05 — the build page's map, rendered with the dev fixture: the canvas in reader mode under a head with Fit to
// screen and no maker controls, a tile opening its window, the phone's sessions map and panel without "Open in the build",
// and the map offered only when the maker shows it.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildStepsFixture, type BuildStepsSample } from "@/dev/fixtures/buildSteps";

import type { BuildStepsView } from "./buildModel";
import ReaderMap from "./ReaderMap";
import { StepsList } from "./BuildSteps";

const REFINED = "/dev/kit/pages/build-steps";

beforeEach(() => {
  window.matchMedia = ((query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
});
afterEach(() => vi.restoreAllMocks());

function view(which: BuildStepsSample = "list", over: Partial<BuildStepsView> = {}): BuildStepsView {
  const { title, outcome, ...steps } = buildStepsFixture(which);
  void title;
  void outcome;
  return { ...steps, ...over };
}

function mount(steps: BuildStepsView = view(), { phone = false, onRead = vi.fn() }: { phone?: boolean; onRead?: (id: string) => void } = {}) {
  render(
    <MemoryRouter initialEntries={[REFINED]}>
      <ReaderMap view={steps} announce={vi.fn()} onRead={onRead} phone={phone} />
    </MemoryRouter>,
  );
}

describe("ReaderMap", () => {
  it("draws a box for each session, with a head that has Fit to screen and nothing a maker changes", () => {
    mount();
    expect(screen.getAllByTestId("map-box").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId("map-title").textContent).toMatch(/^\d+ sessions?/);
    expect(screen.getByRole("button", { name: "Fit to screen" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Map direction" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Map options" })).toBeNull();
    // A reader's head does not say whether it is on the build page: they are reading it there.
    expect(screen.getByTestId("map-sub").textContent).not.toMatch(/build page/);
  });

  it("draws the canvas in reader mode with every placed tile, and a tile opens its Full prompt window", () => {
    const onRead = vi.fn();
    const steps = view();
    mount(steps, { onRead });
    expect(screen.getByTestId("map-canvas").getAttribute("data-mode")).toBe("reader");
    expect(screen.queryByTestId("session-map-drawing")).toBeNull();
    expect(screen.queryByTestId("map-panel")).toBeNull();
    const tiles = screen.getAllByTestId("map-tile");
    expect(tiles.length).toBeGreaterThan(0);
    const first = tiles[0];
    fireEvent.click(within(first).getAllByRole("group")[0]);
    expect(onRead).toHaveBeenCalledWith(first.dataset.tileId);
  });

  it("on a phone, before a session is picked the panel lists the stages and says what to do", () => {
    mount(view(), { phone: true });
    const panel = screen.getByTestId("map-panel");
    expect(within(panel).getByText("Stages")).toBeTruthy();
    expect(within(panel).getByTestId("panel-nothing").textContent).toBe("Nothing selected. Select a session to see what joins it.");
  });

  it("on a phone, a session fills the panel, without Open in the build, and choosing it again clears", async () => {
    mount(view(), { phone: true });
    const first = screen.getAllByTestId("phone-map-session")[0];
    fireEvent.click(first);
    const panel = screen.getByTestId("map-panel");
    expect(within(panel).getByTestId("panel-title")).toBeTruthy();
    expect(within(panel).getByTestId("panel-connections")).toBeTruthy();
    expect(within(panel).queryByRole("button", { name: "Open in the build" })).toBeNull();
    fireEvent.click(first);
    await waitFor(() => expect(within(panel).getByTestId("panel-nothing")).toBeTruthy());
  });
});

describe("StepsList", () => {
  const list = (over: Partial<BuildStepsView> = {}) =>
    render(
      <MemoryRouter initialEntries={[REFINED]}>
        <StepsList view={view("list", over)} phone={false} announce={() => undefined} />
      </MemoryRouter>,
    );

  it("shows the map when Map is chosen: the column and its canvas", async () => {
    list();
    fireEvent.click(screen.getByRole("button", { name: "Map" }));
    expect(await screen.findByTestId("reader-map")).toBeTruthy();
    expect(screen.getByTestId("map-canvas").getAttribute("data-mode")).toBe("reader");
  });

  it("offers no List and Map switch when the maker has not put the map on the build page", () => {
    list({ mapAvailable: false });
    expect(screen.queryByRole("button", { name: "Map" })).toBeNull();
    expect(screen.queryByTestId("reader-map")).toBeNull();
  });
});
