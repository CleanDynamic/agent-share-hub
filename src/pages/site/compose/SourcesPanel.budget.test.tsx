// The composer's Sources panel: its choice budgets, counted in the rendered
// panel ⟦hicks-law › Enforcing It in the Code⟧.
//
// Six rows in any group, then one "Show {n} more" in place. There is one route
// to each thing (a session joins with its +, a file by dropping it or the
// picker), and the panel has no filled button: Publish is the page's one.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sourcesPanelProps } from "@/dev/fixtures/sandbox";

import { SourcesPanel, type SourcesPanelProps } from "./SourcesPanel";
import type { SourcesFile, SourcesLibraryRow, SourcesSession } from "./sourcesModel";

function stubViewport({ phone = false, fine = true }: { phone?: boolean; fine?: boolean } = {}) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("max-width") ? phone : query.includes("hover: hover") ? fine : false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

beforeEach(() => stubViewport());
afterEach(cleanup);

const many = <T,>(n: number, make: (at: number) => T): T[] => Array.from({ length: n }, (_, at) => make(at));

const sessionsOf = (n: number, prompts = 1): SourcesSession[] =>
  many(n, (at) => ({
    key: `s${at + 1}`,
    sessionId: `s${at + 1}`,
    number: at + 1,
    tool: "Claude",
    model: "Opus 5.5",
    date: "4 Oct",
    prompts: many(prompts, (p) => ({ id: `s${at + 1}-p${p + 1}`, number: `${at * prompts + p + 1}`, title: `Prompt ${at * prompts + p + 1}`, isDefault: true })),
  }));
const filesOf = (n: number): SourcesFile[] => many(n, (at) => ({ id: `f${at}`, name: `file-${at}.md`, origin: "added by you" }));
const libraryOf = (n: number): SourcesLibraryRow[] => many(n, (at) => ({ id: `l${at}`, source: "Claude", line: "5 Oct · 3 prompts" }));

function panel(over: Partial<SourcesPanelProps> = {}) {
  const props: SourcesPanelProps = {
    ...sourcesPanelProps("bakery"),
    onSelect: vi.fn(),
    onAttachSession: vi.fn(),
    onFiles: vi.fn(),
    onPickFiles: vi.fn(),
    ...over,
  };
  render(
    <MemoryRouter>
      <SourcesPanel {...props} />
    </MemoryRouter>,
  );
  return props;
}

const showMore = (scope: HTMLElement) => within(scope).queryAllByRole("button", { name: /^Show \d+ more$/ });

describe("Sources' choice budgets", () => {
  it.each([false, true])("shows at most six rows in each group, then one Show more (phone: %s)", (phone) => {
    stubViewport({ phone, fine: !phone });
    panel({ sessions: sessionsOf(9), files: filesOf(8), library: libraryOf(7) });

    const groups: [string, string, number][] = [
      ["Sessions in this build", "source-session", 9],
      ["Files in this build", "source-file", 8],
      ["Not in a build", "source-library", 7],
    ];
    for (const [name, rowId, total] of groups) {
      const group = screen.getByRole("region", { name });
      expect(within(group).getAllByTestId(rowId)).toHaveLength(6);
      // Counted at the group, so a session's own prompts do not add to it.
      expect(within(group).getAllByRole("button", { name: `Show ${total - 6} more` })).toHaveLength(1);
    }
  });

  it("opens a group in place, and shows it fewer again", () => {
    panel({ sessions: sessionsOf(8), files: [], library: [] });
    const group = screen.getByRole("region", { name: "Sessions in this build" });
    fireEvent.click(within(group).getByRole("button", { name: "Show 2 more" }));
    expect(within(group).getAllByTestId("source-session")).toHaveLength(8);
    fireEvent.click(within(group).getByRole("button", { name: "Show fewer" }));
    expect(within(group).getAllByTestId("source-session")).toHaveLength(6);
  });

  it("caps the prompts under one session at six too", () => {
    panel({ sessions: sessionsOf(1, 9), files: [], library: [] });
    const [session] = screen.getAllByTestId("source-session");
    expect(within(session).getAllByTestId("source-prompt")).toHaveLength(6);
    expect(showMore(session)).toHaveLength(1);
  });

  it("shows no Show more when a group has six or fewer", () => {
    panel({ sessions: sessionsOf(6), files: filesOf(2), library: libraryOf(1) });
    expect(showMore(screen.getByTestId("sources-panel"))).toHaveLength(0);
  });

  it("leaves a group with nothing in it out", () => {
    panel({ sessions: sessionsOf(2), files: [], library: [] });
    expect(screen.queryByRole("region", { name: "Files in this build" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Not in a build" })).toBeNull();
    expect(screen.getByRole("region", { name: "Sessions in this build" })).toBeTruthy();
  });

  it("has one route to add a session, and one to add a file", () => {
    const props = panel({ library: libraryOf(2) });
    const adds = screen.getAllByRole("button", { name: "Add session" });
    expect(adds).toHaveLength(2);
    fireEvent.click(adds[0]);
    expect(props.onAttachSession).toHaveBeenCalledWith("l0");
    // The drop zone is the one place to put a file here: not a second button on desktop.
    expect(screen.getByTestId("sources-drop").tagName).toBe("DIV");
    expect(screen.queryByRole("button", { name: /add (a )?file/i })).toBeNull();
  });

  it("has no filled button", () => {
    panel();
    expect(document.querySelectorAll('[data-visual-slot="btn-primary"], [data-variant="primary"]')).toHaveLength(0);
  });
});

describe("Sources' rows", () => {
  it("heads the panel 'Sources' with how many are in the build", () => {
    panel();
    expect(screen.getByRole("heading", { level: 2, name: "Sources" })).toBeTruthy();
    expect(screen.getByTestId("sources-count").textContent).toBe("5 in build");
  });

  it("draws the three groups of V2-List with their counts", () => {
    panel();
    for (const name of ["Sessions in this build", "Files in this build", "Not in a build"]) {
      expect(screen.getByRole("region", { name })).toBeTruthy();
    }
    expect(screen.getAllByTestId("source-session")).toHaveLength(4);
    expect(screen.getByText("CLAUDE.md")).toBeTruthy();
    expect(screen.getByText("opened in session 4")).toBeTruthy();
  });

  it("opens and closes a session's prompts with its chevron, and selects with its row", () => {
    const props = panel();
    const session = screen.getAllByTestId("source-session")[3];
    expect(within(session).getAllByTestId("source-prompt")).toHaveLength(2);
    fireEvent.click(within(session).getByRole("button", { name: "Prompts of session 4" }));
    expect(within(session).queryAllByTestId("source-prompt")).toHaveLength(0);

    fireEvent.click(within(session).getByRole("button", { name: /^Session 4 · Claude Code/ }));
    expect(props.onSelect).toHaveBeenCalledWith({ kind: "session", key: "s4" });
  });

  it("selects a step from its prompt row, and marks the selected one", () => {
    const props = panel();
    const row = screen.getByRole("button", { name: "Prompt 5: Prompt 5" });
    fireEvent.click(row);
    expect(props.onSelect).toHaveBeenCalledWith({ kind: "prompt", id: "p5" });
    expect(screen.getByRole("button", { name: "Prompt 4: Build the homepage" }).getAttribute("aria-current")).toBe("true");
  });

  it("selects a file from its row", () => {
    const props = panel();
    fireEvent.click(screen.getByRole("button", { name: /CLAUDE\.md/ }));
    expect(props.onSelect).toHaveBeenCalledWith({ kind: "file", id: "f1" });
  });

  it("shows the empty lines, and Connect a tool, when the build has nothing", () => {
    panel({ sessions: [], files: [], library: [], selected: null });
    expect(screen.getByText(/No sessions yet\./)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Connect a tool" }).getAttribute("href")).toBe("/connect");
    expect(screen.getByText("No files yet.")).toBeTruthy();
    expect(screen.getByTestId("sources-count").textContent).toBe("0 in build");
  });
});

describe("Sources' drop zone", () => {
  it("passes dropped files on, with a mouse", () => {
    const props = panel();
    const file = new File(["# brief"], "brief.md", { type: "text/markdown" });
    fireEvent.drop(screen.getByTestId("sources-drop"), { dataTransfer: { files: [file] } });
    expect(props.onFiles).toHaveBeenCalledWith([file]);
  });

  it("is a button that opens the file picker without a fine pointer, and on a phone", () => {
    for (const viewport of [{ fine: false }, { phone: true, fine: false }]) {
      cleanup();
      stubViewport(viewport);
      const props = panel();
      const zone = screen.getByTestId("sources-drop");
      expect(zone.tagName).toBe("BUTTON");
      expect(zone.textContent).toBe("Drop sessions or files");
      fireEvent.click(zone);
      expect(props.onPickFiles).toHaveBeenCalledTimes(1);
    }
  });

  it("says where a session export is read", () => {
    panel({ intakeNote: true });
    const note = screen.getByTestId("sources-intake-note");
    expect(within(note).getByRole("link", { name: "Read it in the intake" }).getAttribute("href")).toBe("/compose/start");
  });
});

describe("Sources on a phone", () => {
  beforeEach(() => stubViewport({ phone: true, fine: false }));

  it("leaves the title to the sheet and keeps the count", () => {
    panel();
    expect(screen.queryByRole("heading", { level: 2, name: "Sources" })).toBeNull();
    expect(screen.getByTestId("sources-count").textContent).toBe("5 in build");
  });

  it("gives every row at least 44px", () => {
    panel({ library: libraryOf(1) });
    const rows = [
      ...screen.getAllByTestId("source-prompt").map((row) => row.querySelector("button") as HTMLElement),
      screen.getByRole("button", { name: "Add session" }),
    ];
    for (const row of rows) {
      const height = Number.parseFloat(row.style.minHeight || row.style.height);
      expect(height).toBeGreaterThanOrEqual(44);
    }
  });
});
