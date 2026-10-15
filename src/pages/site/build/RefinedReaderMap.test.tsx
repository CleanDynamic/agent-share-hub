// UI-P91 — the build page's Map in the refined look, rendered with the dev fixture: the same boxes, names, words and
// handlers as `ReaderMap`, in a well with lanes led by real marks, boxes dimmed by the filter, and the open step as a
// module with its tags, its text in a well, Copy, Before you send it and Then.

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { buildStepsFixture, type BuildStepsSample } from "@/dev/fixtures/buildSteps";

import type { BuildStepsView } from "./buildModel";
import RefinedReaderMap from "./RefinedReaderMap";
import { RefinedStepsList } from "./RefinedBuildSteps";

const REFINED = "/dev/kit/pages/build-steps?look=refined";

function view(which: BuildStepsSample = "list", over: Partial<BuildStepsView> = {}): BuildStepsView {
  const { title, outcome, ...steps } = buildStepsFixture(which);
  void title;
  void outcome;
  return { ...steps, ...over };
}

function mount(steps: BuildStepsView = view(), announce = vi.fn(), onRead = vi.fn()) {
  render(
    <MemoryRouter initialEntries={[REFINED]}>
      <RefinedReaderMap view={steps} announce={announce} onRead={onRead} />
    </MemoryRouter>,
  );
  return { announce, onRead };
}

const box = (name: RegExp) => screen.getByRole("button", { name });

describe("RefinedReaderMap", () => {
  it("draws the map in a well with the dot grid, lanes led by the session's real mark and no arrowheads", () => {
    mount();
    const map = screen.getByTestId("build-map");
    // jsdom drops a shorthand that carries var(), so the grid and the fill are read in the browser (audit:design).
    expect(map.style.boxShadow).toBe("var(--well-shadow)");
    expect(map.style.borderRadius).toBe("6px");
    const lanes = screen.getAllByTestId("map-lane");
    expect(lanes[0].textContent).toContain("Session 1");
    expect(lanes[0].querySelector('[data-mark="openai"]')).not.toBeNull();
    // The real logo, never an initial in a tile.
    expect(map.querySelector("[data-mark] span")).toBeNull();
    for (const wire of screen.getAllByTestId("map-wire")) {
      expect(wire.getAttribute("marker-end")).toBeNull();
      expect(wire.getAttribute("stroke-width")).toBe("1.2");
    }
  });

  it("before a box is picked the panel says what to do", () => {
    mount();
    expect(screen.getByTestId("reading-panel").textContent).toContain("Click a box to read its full prompt.");
  });

  it("a box fills the open step: eyebrow, title, tags with marks, the text in a well, words and Copy", async () => {
    const onCopy = vi.fn().mockResolvedValue(true);
    const { announce } = mount(view("list", { onCopy }));
    fireEvent.click(box(/^Prompt 4, Build the homepage/));
    const panel = screen.getByTestId("reading-panel");
    expect(panel.textContent).toContain("Step 4 of 5");
    expect(within(panel).getByRole("heading", { name: "Build the homepage" })).toBeTruthy();
    expect(within(panel).getByText("New chat in Claude Code").closest("span")?.querySelector("[data-mark]")).not.toBeNull();
    expect(within(panel).getByLabelText("Full prompt").textContent).toContain("Follow CLAUDE.md");
    expect(panel.textContent).toContain("99 words");
    expect(within(panel).getByText("Before you send it")).toBeTruthy();
    expect(within(panel).getByText("Then")).toBeTruthy();

    const copy = within(panel).getByRole("button", { name: "Copy" });
    expect(copy.querySelector("svg")).toBeNull();
    await act(async () => {
      fireEvent.click(copy);
    });
    expect(onCopy).toHaveBeenCalledWith(expect.stringContaining("Follow CLAUDE.md"));
    expect(announce).toHaveBeenCalledWith("Copied");
  });

  it("dims what the step does not touch with the filter, never an opacity, and marks the selected box", () => {
    mount();
    fireEvent.click(box(/^Prompt 4, /));
    const selected = box(/^Prompt 4, /);
    expect(selected.getAttribute("aria-pressed")).toBe("true");
    // Out of Dusk the selected box is ringed (jsdom keeps the shadow, not the var() border shorthand).
    expect(selected.style.boxShadow).toBe("var(--selected-ring)");
    const dimmed = box(/^Prompt 1, /);
    expect(dimmed.style.filter).toBe("var(--dim-filter)");
    expect(dimmed.style.opacity).toBe("");
    expect(screen.getByText("Step 4 open · what it doesn't touch is dimmed")).toBeTruthy();
  });

  it("Next moves on, a paste-in's link goes back, the close button and Esc clear", async () => {
    mount();
    fireEvent.click(box(/^Prompt 4, /));
    const panel = screen.getByTestId("reading-panel");
    fireEvent.click(within(panel).getByRole("button", { name: "Next: step 5" }));
    expect(panel.textContent).toContain("Step 5 of 5");

    fireEvent.click(box(/^Prompt 4, /));
    fireEvent.click(within(panel).getByRole("button", { name: "Go to step 2" }));
    expect(panel.textContent).toContain("Step 2 of 5");

    fireEvent.click(within(panel).getByRole("button", { name: "Close the reading panel" }));
    expect(panel.textContent).toContain("Click a box to read its full prompt.");

    fireEvent.click(box(/^Prompt 3, /));
    fireEvent.keyDown(screen.getByTestId("build-map"), { key: "Escape" });
    await waitFor(() => expect(panel.textContent).toContain("Click a box to read its full prompt."));
  });

  it("double-click opens the full prompt window", () => {
    const { onRead } = mount();
    fireEvent.doubleClick(box(/^Prompt 2, /));
    expect(onRead).toHaveBeenCalledWith("p2");
  });

  it("is what RefinedStepsList shows when Map is chosen", async () => {
    /* 1024 and up: two tracks, the panel 380 wide. */
    window.matchMedia = ((query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
    render(
      <MemoryRouter initialEntries={[REFINED]}>
        <RefinedStepsList view={view()} phone={false} announce={() => undefined} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Map" }));
    expect(await screen.findByTestId("reader-map")).toBeTruthy();
    expect(screen.getByText("click a box to read it · Esc clears")).toBeTruthy();
    expect(screen.getByTestId("reading-panel").style.width).toBe("380px");
  });
});
