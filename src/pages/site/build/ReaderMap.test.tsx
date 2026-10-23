// CA-17 P4, P6 — the build page's map of sessions, rendered with the dev fixture: the maker's direction, a head with Fit to
// screen and no maker controls, the panel without "Open in the build", and the map offered only when the maker shows it.

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

function mount(steps: BuildStepsView = view()) {
  render(
    <MemoryRouter initialEntries={[REFINED]}>
      <ReaderMap view={steps} announce={vi.fn()} onRead={vi.fn()} />
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

  it("draws the maker's direction: horizontal unless they chose vertical", () => {
    mount();
    expect(screen.getByTestId("session-map-drawing").getAttribute("data-direction")).toBe("horizontal");
    document.body.innerHTML = "";
    mount(view("list", { making: { map: { on: true, direction: "vertical", onBuildPage: true } } }));
    expect(screen.getByTestId("session-map-drawing").getAttribute("data-direction")).toBe("vertical");
  });

  it("before a session is picked the panel lists the stages and says what to do", () => {
    mount();
    const panel = screen.getByTestId("map-panel");
    expect(within(panel).getByText("Stages")).toBeTruthy();
    expect(within(panel).getByTestId("panel-nothing").textContent).toBe("Nothing selected. Select a session to see what joins it.");
  });

  it("a box fills the panel, without Open in the build, and Esc clears", async () => {
    mount();
    const first = screen.getAllByTestId("map-box")[0];
    fireEvent.click(first);
    const panel = screen.getByTestId("map-panel");
    expect(within(panel).getByTestId("panel-title")).toBeTruthy();
    expect(within(panel).getByTestId("panel-connections")).toBeTruthy();
    expect(within(panel).queryByRole("button", { name: "Open in the build" })).toBeNull();
    fireEvent.keyDown(screen.getByTestId("session-map"), { key: "Escape" });
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

  it("shows the map when Map is chosen: the column and the panel 312 wide", async () => {
    list();
    fireEvent.click(screen.getByRole("button", { name: "Map" }));
    expect(await screen.findByTestId("reader-map")).toBeTruthy();
    expect(screen.getByText("click a session to see what joins it · Esc clears")).toBeTruthy();
    expect(screen.getByTestId("map-panel").style.width).toBe("312px");
  });

  it("offers no List and Map switch when the maker has not put the map on the build page", () => {
    list({ mapAvailable: false });
    expect(screen.queryByRole("button", { name: "Map" })).toBeNull();
    expect(screen.queryByTestId("reader-map")).toBeNull();
  });
});
