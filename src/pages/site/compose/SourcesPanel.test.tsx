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
const libraryRows = (n: number): SourceLibraryItem[] => many(n, (at) => ({ id: `l${at}`, label: "Claude", line: "1 Mar · 2 prompts", adding: false, inThisDraft: false, alsoIn: null, firstPrompt: "Claude", date: "1 Mar", promptCount: 2, app: "Claude", appKnown: true, model: null, createdAt: "2026-03-01T10:00:00Z", draftCount: 0 }));

describe("Sources' choice budgets", () => {
  it.each([
    // UX-02 P8: two groups: In this build (its sessions, then its files) and Available to add.
    ["In this build", { sessions: sessionRows(9) }, 9],
    ["In this build", { files: fileRows(8) }, 8],
    ["Available to add", { library: libraryRows(10) }, 10],
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
    panel({ sessions: [], files: [], reminders: [], library: [] });
    expect(screen.queryByRole("region", { name: "In this build" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Available to add" })).toBeNull();
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
    // UX-02 P8: the dashed box is gone; Add files opens the picker.
    fireEvent.click(screen.getByRole("button", { name: "Add files" }));
    expect(props.onPick).toHaveBeenCalled();
  });

  it("hands dropped files up on a fine pointer", () => {
    const props = panel();
    const file = new File(["x"], "menu.pdf", { type: "application/pdf" });
    fireEvent.drop(screen.getByTestId("sources-panel"), { dataTransfer: { types: ["Files"], files: [file] } });
    expect(props.onDropFiles).toHaveBeenCalledWith([file]);
  });
});

describe("the setup-file reminder", () => {
  const reminder = (toolId: string, name: string, file: string) => ({ toolId, line: `${name} reads ${file}`, file });

  it("sits under In this build, and Add opens the file picker", () => {
    const props = panel({ files: fileRows(1), reminders: [reminder("claude-code", "Claude Code", "CLAUDE.md")] });
    const files = screen.getByRole("region", { name: "In this build" });
    expect(within(files).getByText("Claude Code reads CLAUDE.md")).toBeTruthy();
    fireEvent.click(within(files).getByRole("button", { name: "Add CLAUDE.md" }));
    expect(props.onPick).toHaveBeenCalledTimes(1);
  });

  it("SV-05 P6: wraps its words rather than cutting the file name, and Add never wraps or shrinks", () => {
    panel({ files: [], reminders: [reminder("claude-code", "Claude Code", "CLAUDE.md")] });
    const line = screen.getByTestId("reminder-line");
    expect(line.textContent).toBe("Claude Code reads CLAUDE.md");
    expect(line.style.whiteSpace).toBe("normal");
    expect(line.style.textOverflow).toBe("");
    expect(line.style.overflowWrap).toBe("normal");
    const add = screen.getByRole("button", { name: "Add CLAUDE.md" });
    expect(add.textContent).toBe("Add");
    expect(add.style.whiteSpace).toBe("nowrap");
    expect(add.style.flexShrink).toBe("0");
  });

  it("shows even when the build has no file yet, and caps at two rows", () => {
    panel({
      files: [],
      reminders: [reminder("claude-code", "Claude Code", "CLAUDE.md"), reminder("codex", "Codex", "AGENTS.md"), reminder("cursor", "Cursor", ".cursor/rules/")],
    });
    const files = screen.getByRole("region", { name: "In this build" });
    expect(within(files).getAllByRole("button", { name: /^Add / })).toHaveLength(2);
    expect(within(files).queryByText("Cursor reads .cursor/rules/")).toBeNull();
  });

  it("goes when there are none", () => {
    panel({ sessions: [], files: [], reminders: [] });
    expect(screen.queryByRole("region", { name: "In this build" })).toBeNull();
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

  it("lists the two groups in order, each session with its tool's real mark and a toggle", () => {
    panel();
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["In this build", "Available to add"]);
    const sessions = screen.getByRole("region", { name: "In this build" });
    expect(within(sessions).getAllByRole("button", { name: /^Open session/ })).toHaveLength(3);
    expect(sessions.querySelectorAll("[data-mark]")).toHaveLength(3);
  });

  it("has a 6px square per group (hollow for Available to add), a boxed 26 Add session, and no dashed drop zone (UX-02 P8)", () => {
    panel();
    const add = screen.getAllByRole("button", { name: "Add session" })[0];
    expect(add.getAttribute("style")).toMatch(/width:\s*32px/); // S6
    const html = markup();
    expect(html).toContain("width:6px;height:6px;box-sizing:border-box;border-radius:1px;background:transparent;border:1px solid var(--text2)");
    expect(html).not.toContain("dashed");
    expect(html).toContain("Or drop files anywhere on the build.");
  });
});

describe("a file a step makes (TF-08)", () => {
  it("is noted as made in step 2 in In this build", () => {
    panel({ files: [{ id: "bg", name: "brand-guide.md", note: "made in step 2" }, { id: "f1", name: "menu.pdf", note: "added by you" }] });
    const group = screen.getByRole("region", { name: "In this build" });
    expect(within(group).getByText("brand-guide.md")).toBeTruthy();
    expect(within(group).getByText("made in step 2")).toBeTruthy();
    expect(within(group).getByText("added by you")).toBeTruthy();
  });
});

describe("CA-24 P3 · Sources failing to load", () => {
  it("says Sources didn't load, with Retry, which asks again", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const props = panel({ status: "error", error: new Error("boom"), onRetry: vi.fn() });
    expect(screen.getByText("Sources didn't load")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("sources-panel")).toBeNull();
  });
});

describe("CA-24 P1 · Sources loading more", () => {
  it("shows building blocks where 'Show more sessions' was, while the next page is read", () => {
    panel({ library: libraryRows(3), libraryHasMore: true, libraryLoadingMore: true });
    expect(screen.queryByRole("button", { name: "Show more sessions" })).toBeNull();
    expect(within(screen.getByTestId("library-more-loading")).getByTestId("loading-blocks")).toBeTruthy();
    expect(screen.getByText("Loading more sessions")).toBeTruthy();
  });
});

describe("F51, F52, F53: every row ends the same way", () => {
  it("F51: one trailing slot on every row: + to add, a tick named In this build, a file's menu", () => {
    panel({ onRemoveFile: vi.fn() } as Partial<SourcesPanelProps>);
    const sources = document.body;
    const trails = within(sources).getAllByTestId("source-trail");
    expect(new Set(trails.map((trail) => trail.style.width))).toEqual(new Set(["30px"]));
    expect(within(sources).getAllByRole("img", { name: "In this build" }).length).toBeGreaterThan(0);
    expect(within(sources).queryByText("In this draft")).toBeNull();
  });

  it("F53: a nested prompt shows its number and the start of its words", () => {
    panel();
    fireEvent.click(screen.getByRole("button", { name: "Open session 1" }));
    expect(screen.getByText("Step 1")).toBeTruthy();
  });
});
