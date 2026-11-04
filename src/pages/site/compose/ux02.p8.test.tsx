// UX-02 P8: Sources is one list in two groups: In this build (its sessions, then its files) and Available to add (the library, capped
// at GROUP_ROWS, with a filter once it holds more). Long session names wrap to two lines before they are cut. The dashed box is gone:
// Add files opens the picker, one line says a file can be dropped on the build, and the panel still takes a drop.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxSourcesProps } from "@/dev/fixtures/sandbox";

import { GROUP_ROWS, SourcesPanel, type SourcesPanelProps } from "./SourcesPanel";
import type { SourceLibraryItem } from "./sourcesModel";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const library = (n: number): SourceLibraryItem[] =>
  Array.from({ length: n }, (_, at) => ({ id: `l${at}`, label: "Claude", line: `${at + 1} Mar · 2 prompts`, adding: false, inThisDraft: false, alsoIn: null, firstPrompt: at === 2 ? "Plan the bakery's spring menu with seasonal fruit and a price list for every day of the week" : `Session ${at}`, date: "1 Mar", promptCount: 2, app: "Claude", appKnown: true, model: null, createdAt: "2026-03-01T10:00:00Z", draftCount: 0 }));

function panel(over: Partial<SourcesPanelProps> = {}) {
  const props: SourcesPanelProps = { ...sandboxSourcesProps("bakery"), onSelect: vi.fn(), onAddSession: vi.fn(), onDropFiles: vi.fn(), onPick: vi.fn(), ...over };
  render(
    <MemoryRouter>
      <SourcesPanel {...props} />
    </MemoryRouter>,
  );
  return props;
}

describe("UX-02 P8 · Sources in two groups", () => {
  it("has two group heads: In this build, then Available to add", () => {
    panel();
    expect(screen.getAllByRole("heading", { level: 3 }).map((head) => head.textContent)).toEqual(["In this build", "Available to add"]);
  });

  it("In this build holds the build's sessions, then its files", () => {
    panel({ files: [{ id: "f1", name: "menu.pdf", note: "added by you" }] });
    const group = screen.getByRole("region", { name: "In this build" });
    const sessionAt = within(group).getAllByText(/^Session \d+ · /)[0];
    const file = within(group).getByText("menu.pdf");
    expect(sessionAt.compareDocumentPosition(file) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("wraps a long session name to two lines before the ellipsis, with the full name to hover", () => {
    // jsdom's style parser drops the line clamp, so the name is read as React writes it.
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <SourcesPanel {...sandboxSourcesProps("bakery")} library={library(3)} onSelect={vi.fn()} onAddSession={vi.fn()} onDropFiles={vi.fn()} onPick={vi.fn()} />
      </MemoryRouter>,
    );
    const name = html.match(/<span title="Plan the bakery[^"]*"[^>]*>/)?.[0] ?? "";
    expect(name).toContain("-webkit-line-clamp:2");
    expect(name).not.toContain("white-space:nowrap");
    // The build's own sessions wrap the same way.
    expect(html.match(/<span title="Session 1 · [^"]*"[^>]*>/)?.[0] ?? "").toContain("-webkit-line-clamp:2");
  });

  it("filters Available to add once it holds more than a group's rows", () => {
    cleanup();
    panel({ library: library(GROUP_ROWS) });
    expect(screen.queryByRole("searchbox", { name: "Filter sessions" })).toBeNull();
    cleanup();
    panel({ library: library(GROUP_ROWS + 3) });
    const group = screen.getByRole("region", { name: "Available to add" });
    const field = within(group).getByRole("searchbox", { name: "Filter sessions" });
    fireEvent.change(field, { target: { value: "spring menu" } });
    expect(within(group).getAllByRole("button", { name: "Add session" })).toHaveLength(1);
    fireEvent.change(field, { target: { value: "8 Mar" } });
    expect(within(group).getAllByRole("button", { name: "Add session" })).toHaveLength(1);
    fireEvent.change(field, { target: { value: "nothing like it" } });
    expect(within(group).getByText("No session matches.")).toBeTruthy();
  });

  it("has Add files at its foot, which opens the picker, and the line about dropping", () => {
    const props = panel();
    fireEvent.click(screen.getByRole("button", { name: "Add files" }));
    expect(props.onPick).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Or drop files anywhere on the build.")).toBeTruthy();
    expect(screen.queryByTestId("sources-drop")).toBeNull();
  });
});
