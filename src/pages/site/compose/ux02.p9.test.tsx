// UX-02 P9: Details shows what the List does not. A selected session's head already says its harness, model and date, so Details does
// not repeat them; where something is empty, an Add details control opens the editor Edit opens (in place of "Not set: …"). A selected
// File step tile says its type, its place in the List, and where it stands on the published page.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildFacts, tileView } from "@/dev/fixtures/detailsKinds";

import { DetailsPanel, type DetailsPanelProps, type DetailsView } from "./DetailsPanel";
import { fileTypeOf } from "./detailsView";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function panel(view: DetailsView) {
  const onEdit = vi.fn();
  const props = { phone: false, view, build: buildFacts, onSelect: vi.fn(), onEdit } as unknown as DetailsPanelProps;
  render(<DetailsPanel {...props} />);
  return onEdit;
}

const sectionNames = () => screen.queryAllByTestId("details-section").map((section) => section.querySelector("h4")?.textContent);

describe("UX-02 P9 · a selected session", () => {
  it("does not repeat its head: no Harness and model, no Date", () => {
    panel(tileView("session", "full"));
    expect(sectionNames()).not.toContain("Harness and model");
    expect(sectionNames()).not.toContain("Date");
    // Its head still says them.
    expect(screen.getByTestId("details-head")).toBeTruthy();
  });

  it("has Add details, which opens the editor Edit opens, in place of the Not set sentence", () => {
    const onEdit = panel(tileView("session", "empty"));
    expect(screen.queryByText(/^Not set: /)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add details" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

describe("UX-02 P9 · a selected File step tile", () => {
  it("says its type, its place in the List and on the published page", () => {
    const view = { ...tileView("file", "full"), type: "MD", place: { session: 2, at: 3, step: "5" } } as DetailsView;
    panel(view);
    // F46: one section headed File: Type, Size and Added by.
    const file = screen.getAllByTestId("details-section").find((section) => section.querySelector("h4")?.textContent === "File") as HTMLElement;
    expect(within(file).getByText("MD")).toBeTruthy();
    const place = screen.getAllByTestId("details-section").find((section) => section.querySelector("h4")?.textContent === "In the build") as HTMLElement;
    expect(within(place).getByText("Session 2")).toBeTruthy();
    expect(within(place).getByText("Step 5 · File")).toBeTruthy();
  });

  it("a source file (not a step tile) has no place, and nothing asks for one", () => {
    panel({ ...tileView("file", "full"), type: "PDF", place: null } as DetailsView);
    expect(sectionNames()).not.toContain("In the build");
    expect(screen.queryByRole("button", { name: "Add details" })).toBeNull();
  });

  it("reads a file's type from its name, else its media type", () => {
    expect(fileTypeOf("brief.md", "text/markdown")).toBe("MD");
    expect(fileTypeOf("notes", "text/plain")).toBe("text/plain");
    expect(fileTypeOf("notes", null)).toBeNull();
  });
});
