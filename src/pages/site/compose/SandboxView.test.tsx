import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxViewProps } from "@/dev/fixtures/sandbox";

import { ADD_ITEMS, countsLine, SandboxView, type SandboxViewProps } from "./SandboxView";

function stubWidth(px: number) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = min ? px >= Number(min[1]) : max ? px <= Number(max[1]) : false;
    return { matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined };
  });
}

function view(over: Partial<SandboxViewProps> = {}) {
  const props = { ...sandboxViewProps("bakery"), onPublish: vi.fn(), onLens: vi.fn(), ...over };
  render(
    <MemoryRouter>
      <SandboxView {...props} />
    </MemoryRouter>,
  );
  return props;
}

beforeEach(() => stubWidth(1440));
afterEach(cleanup);

describe("countsLine", () => {
  it("leaves out any zero", () => {
    expect(countsLine({ sessions: 3, prompts: 12, files: 2 })).toBe("3 sessions · 12 prompts · 2 files");
    expect(countsLine({ sessions: 1, prompts: 1, files: 0 })).toBe("1 session · 1 prompt");
    expect(countsLine({ sessions: 0, prompts: 0, files: 0 })).toBe("");
  });
});

describe("SandboxView frame", () => {
  it("draws Sources, Build and Details, and one primary button", () => {
    view();
    for (const name of ["Sources", "Build", "Details"]) expect(screen.getByRole("region", { name })).toBeTruthy();
    expect(screen.getByText("Select a prompt, session or file to see it here.")).toBeTruthy();
    expect(document.querySelectorAll('[data-variant="primary"]').length).toBe(1);
    expect(screen.getByTestId("sandbox-counts").textContent).toBe("3 sessions · 12 prompts · 2 files");
  });

  it("names what is missing and opens the Card at that field", () => {
    view({ missing: [{ key: "title", label: "a title" }] });
    expect(screen.getByTestId("sandbox-status").textContent).toContain("Missing: a title");
    fireEvent.click(screen.getByRole("button", { name: "a title" }));
    const card = screen.getByTestId("sandbox-card");
    expect(within(card).getByLabelText("Title")).toBe(document.activeElement);
  });

  it("shows the List and Map switch only when Map is available, with the one-time line", () => {
    view();
    expect(screen.getByRole("group", { name: "Build view" })).toBeTruthy();
    expect(screen.getByText("Map is now available")).toBeTruthy();
    cleanup();
    view({ mapAvailable: false, mapHint: false });
    expect(screen.queryByRole("group", { name: "Build view" })).toBeNull();
  });

  it("lists the seven Add items in order; Prompt, Session and File are live so far (UI-P64, UI-P65)", () => {
    expect(ADD_ITEMS.map((item) => item.name)).toEqual(["Prompt", "Session", "Agent or team", "File", "Tool", "Manual step", "Result"]);
    expect(ADD_ITEMS.filter((item) => item.ready).map((item) => item.key)).toEqual(["prompt", "session", "file"]);
  });

  it("opens the Card from its button with the six sections' fields", () => {
    view();
    fireEvent.click(screen.getByRole("button", { name: "Card" }));
    const card = screen.getByTestId("sandbox-card");
    for (const label of ["Title", "One-line summary", "Who it's for"]) expect(within(card).getByLabelText(label)).toBeTruthy();
    expect(within(card).getByText("Cover")).toBeTruthy();
  });
});

describe("SandboxView on a phone", () => {
  it("is one column with Sources and Details behind buttons, and never Map", () => {
    stubWidth(390);
    view({ lens: "map" });
    expect(screen.queryByRole("group", { name: "Build view" })).toBeNull();
    expect(screen.getByRole("button", { name: "Sources" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Details" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Publish" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Details" })).toBeNull();
  });
});
