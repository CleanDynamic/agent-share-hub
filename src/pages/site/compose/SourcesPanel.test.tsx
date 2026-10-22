// UI-P93 — the current view's own suite, run against the refined fork under `?look=refined` (same names, handlers and
// behaviour), then a block for what the refined board draws. Styles are read through SSR markup.

// The Sources panel's choice budgets, counted in the rendered panel (CONCEPT §7).
// At most six rows in a group, then one "Show N more"; no second add route
// inside the panel; no filled button.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxSourcesProps } from "@/dev/fixtures/sandbox";

import { SourcesPanel as SourcesPanel } from "./SourcesPanel";
import type { SourcesPanelProps } from "./SourcesPanel";
import type { SourceFile, SourceLibraryItem, SourceSession } from "./sourcesModel";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(cleanup);

const many = <T,>(n: number, make: (at: number) => T): T[] => Array.from({ length: n }, (_, at) => make(at + 1));

function panel(over: Partial<SourcesPanelProps> = {}) {
  const props: SourcesPanelProps = { ...sandboxSourcesProps("bakery"), onSelect: vi.fn(), onAddSession: vi.fn(), onDropFiles: vi.fn(), onPick: vi.fn(), ...over };
  render(
    <MemoryRouter initialEntries={["/dev/kit/pages/sandbox"]}>
      <SourcesPanel {...props} />
    </MemoryRouter>,
  );
  return props;
}

const sessionRows = (n: number): SourceSession[] => many(n, (at) => ({ key: `s${at}`, number: at, tool: "Claude", detail: "Opus 5.5 · 3 Mar", prompts: [] }));
const fileRows = (n: number): SourceFile[] => many(n, (at) => ({ id: `f${at}`, name: `file-${at}.pdf`, note: "added by you" }));
const libraryRows = (n: number): SourceLibraryItem[] => many(n, (at) => ({ id: `l${at}`, label: "Claude", line: "1 Mar · 2 prompts", adding: false, inThisDraft: false, alsoIn: null, firstPrompt: null, date: "1 Mar", promptCount: 2, app: "Claude", appKnown: true, model: null, createdAt: "2026-03-01T10:00:00Z", draftCount: 0 }));

describe("Sources' choice budgets", () => {
  it.each([
    ["Sessions in this build", { sessions: sessionRows(9) }, 9],
    ["Files in this build", { files: fileRows(8) }, 8],
    ["Your sessions", { library: libraryRows(10) }, 10],
  ] as const)("shows at most six rows in %s, then one Show more", (name, over, total) => {
    panel({ sessions: [], files: [], library: [], ...over });
    const group = screen.getByRole("region", { name });
    // Count by the rows' own text: each row names itself once.
    const shown = () => within(group).queryAllByText(/^(Session \d+ · Claude|file-\d+\.pdf|Claude)$/).length;
    expect(shown()).toBe(6);
    expect(within(group).getAllByRole("button", { name: `Show ${total - 6} more` })).toHaveLength(1);
    fireEvent.click(within(group).getByRole("button", { name: `Show ${total - 6} more` }));
    expect(shown()).toBe(total);
    expect(within(group).queryByRole("button", { name: /Show \d+ more/ })).toBeNull();
  });

  it("leaves out a group with nothing in it", () => {
    panel({ files: [], library: [] });
    expect(screen.queryByRole("region", { name: "Files in this build" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Your sessions" })).toBeNull();
  });

  it("has no filled button and one add route per library session", () => {
    panel();
    expect(document.querySelectorAll('[data-variant="primary"]').length).toBe(0);
    expect(screen.getAllByRole("button", { name: "Add session" })).toHaveLength(2);
  });
});

describe("Sources' rows", () => {
  it("numbers sessions as given and nests their prompts once opened", () => {
    const props = panel();
    expect(screen.getByText("Session 2 · Claude Code")).toBeTruthy();
    expect(screen.getByText("Sonnet 5.5 · 4 Mar")).toBeTruthy();
    expect(screen.queryByText("Write the homepage copy")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open session 1" }));
    fireEvent.click(screen.getByText("Write the homepage copy"));
    expect(props.onSelect).toHaveBeenCalledWith("p1");
  });

  it("selects a session, and Add session calls through", () => {
    const props = panel();
    fireEvent.click(screen.getByText("Session 1 · Claude"));
    expect(props.onSelect).toHaveBeenCalledWith("s1");
    fireEvent.click(screen.getAllByRole("button", { name: "Add session" })[0]);
    expect(props.onAddSession).toHaveBeenCalledWith("l1");
  });

  it("shows the empty lines for an empty build", () => {
    panel({ sessions: [], files: [], library: [] });
    expect(screen.getByText("No sessions yet.")).toBeTruthy();
    expect(screen.getByText("No files yet.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Connect a tool" }).getAttribute("href")).toBe("/connect");
  });

  it("is a button that opens the picker without a fine pointer", () => {
    const props = panel({ fine: false });
    fireEvent.click(screen.getByRole("button", { name: "Drop sessions or files" }));
    expect(props.onPick).toHaveBeenCalled();
  });

  it("hands dropped files up on a fine pointer", () => {
    const props = panel();
    const file = new File(["x"], "menu.pdf", { type: "application/pdf" });
    fireEvent.drop(screen.getByTestId("sources-drop"), { dataTransfer: { types: ["Files"], files: [file] } });
    expect(props.onDropFiles).toHaveBeenCalledWith([file]);
  });
});

describe("the setup-file reminder", () => {
  const reminder = (toolId: string, name: string, file: string) => ({ toolId, line: `${name} reads ${file}`, file });

  it("sits under Files in this build, and Add it opens the file picker", () => {
    const props = panel({ files: fileRows(1), reminders: [reminder("claude-code", "Claude Code", "CLAUDE.md")] });
    const files = screen.getByRole("region", { name: "Files in this build" });
    expect(within(files).getByText("Claude Code reads CLAUDE.md")).toBeTruthy();
    fireEvent.click(within(files).getByRole("button", { name: "Add CLAUDE.md" }));
    expect(props.onPick).toHaveBeenCalledTimes(1);
  });

  it("shows even when the build has no file yet, and caps at two rows", () => {
    panel({
      files: [],
      reminders: [reminder("claude-code", "Claude Code", "CLAUDE.md"), reminder("codex", "Codex", "AGENTS.md"), reminder("cursor", "Cursor", ".cursor/rules/")],
    });
    const files = screen.getByRole("region", { name: "Files in this build" });
    expect(within(files).getAllByRole("button", { name: /^Add / })).toHaveLength(2);
    expect(within(files).queryByText("Cursor reads .cursor/rules/")).toBeNull();
  });

  it("goes when there are none", () => {
    panel({ files: [], reminders: [] });
    expect(screen.queryByRole("region", { name: "Files in this build" })).toBeNull();
    expect(screen.queryByText(/ reads /)).toBeNull();
  });
});

describe("the refined look (UI-P93)", () => {
  const markup = () =>
    renderToStaticMarkup(
      <MemoryRouter initialEntries={["/dev/kit/pages/sandbox"]}>
        <SourcesPanel {...sandboxSourcesProps("bakery")} />
      </MemoryRouter>,
    );

  it("lists the three groups in order, each session with its tool's real mark and a toggle", () => {
    panel();
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Sessions in this build", "Files in this build", "Your sessions"]);
    const sessions = screen.getByRole("region", { name: "Sessions in this build" });
    expect(within(sessions).getAllByRole("button", { name: /^Open session/ })).toHaveLength(3);
    expect(sessions.querySelectorAll("[data-mark]")).toHaveLength(3);
  });

  it("has a 6px square per group (hollow for Your sessions), a boxed 26 Add session and a 56-high dashed drop zone", () => {
    panel();
    const add = screen.getAllByRole("button", { name: "Add session" })[0];
    expect(add.getAttribute("style")).toMatch(/width:\s*26px/);
    const html = markup();
    expect(html).toContain("width:6px;height:6px;box-sizing:border-box;border-radius:1px;background:transparent;border:1px solid var(--text2)");
    expect(html).toMatch(/data-testid="sources-drop" style="[^"]*min-height:56px[^"]*border:1px dashed var\(--line\)/);
  });
});

describe("a file a step makes (TF-08)", () => {
  it("is noted as made in step 2 in Files in this build", () => {
    panel({ files: [{ id: "bg", name: "brand-guide.md", note: "made in step 2" }, { id: "f1", name: "menu.pdf", note: "added by you" }] });
    const group = screen.getByRole("region", { name: "Files in this build" });
    expect(within(group).getByText("brand-guide.md")).toBeTruthy();
    expect(within(group).getByText("made in step 2")).toBeTruthy();
    expect(within(group).getByText("added by you")).toBeTruthy();
  });
});
