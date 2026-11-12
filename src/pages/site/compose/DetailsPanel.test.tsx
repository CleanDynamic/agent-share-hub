// CA-18 P3: the Details panel, read only. It shows the selected tile with the same sections, names and order as the tile's
// window, and nothing in it can be typed into; every change is made in the window, which Edit opens.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildFacts, tileView } from "@/dev/fixtures/detailsKinds";
import { TILE_KINDS } from "@/lib/build/tileSections";
import type { Step } from "@/lib/build/graph";
import { typeLineOf } from "@/lib/build/tileLines";
import type { NodeTree } from "@/lib/build/types";
import { fileSize } from "./detailsModel";
import { resolveView } from "./detailsView";

import { BuildAnnouncer } from "./BuildAnnouncer";
import { DETAILS_COPY, DetailsPanel, type DetailsPanelProps, type DetailsView } from "./DetailsPanel";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const EDITABLE = "input, textarea, select, [contenteditable], [role=combobox], [role=checkbox], [role=radio], [role=switch]";

const baseProps = (): DetailsPanelProps => ({
    phone: false,
    view: tileView("prompt", "full"),
    build: buildFacts,
    onRename: vi.fn(),
    onModel: vi.fn(),
    onAddUse: vi.fn(),
    onRemoveUse: vi.fn(),
    onRuns: vi.fn(),
    onRemoveInside: vi.fn(),
    onToggleSessionPrompt: vi.fn(),
    onDownload: vi.fn(),
    onFields: vi.fn(),
    onAddPicture: vi.fn(),
    onUseAsCover: vi.fn(),
    onSelect: vi.fn(),
    onEdit: vi.fn(),
});

function panel(over: Partial<DetailsPanelProps> = {}) {
  const props: DetailsPanelProps = { ...baseProps(), ...over };
  render(<DetailsPanel {...props} />);
  return props;
}

describe("nothing to type into", () => {
  it.each(TILE_KINDS)("%s: no input, text area, select, checkbox, radio, switch, combobox or editable text, full or empty", (kind) => {
    for (const fill of ["full", "empty"] as const) {
      cleanup();
      panel({ view: tileView(kind, fill) });
      expect(document.querySelectorAll(EDITABLE).length, `${kind} ${fill}`).toBe(0);
      expect(screen.queryByRole("textbox"), `${kind} ${fill}`).toBeNull();
    }
  });

  it("has no remove, rename, add or colour button either: it reads and moves, it does not change", () => {
    for (const kind of TILE_KINDS) {
      cleanup();
      panel({ view: tileView(kind, "full") });
      // UX-02 P9: Add details opens the same window as Edit; it changes nothing itself.
      for (const name of [/^Remove/, /^Rename/, /^Add (?!details$)/, /^Colour for/, /^Save/, /^Use as cover/, /Take the goal off/]) expect(screen.queryByRole("button", { name }), `${kind} ${String(name)}`).toBeNull();
    }
  });
});

describe("Edit", () => {
  it("is in the head, and opens the window for what is shown", () => {
    const props = panel();
    const head = screen.getByTestId("details-head");
    fireEvent.click(within(head).getByRole("button", { name: "Edit" }));
    expect(props.onEdit).toHaveBeenCalledTimes(1);
  });

  it("is left out where there is no window to open (a file), and where nothing can open one", () => {
    panel({ view: tileView("file", "full") });
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    cleanup();
    panel({ onEdit: undefined });
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });
});

describe("the head", () => {
  it("is the title and the window's own line, with the tool's mark", () => {
    panel();
    const head = screen.getByTestId("details-head");
    expect(within(head).getByRole("heading", { name: "Fix the mobile layout" })).toBeTruthy();
    expect(screen.getByTestId("details-line").textContent).toBe("Step 3 · Session 2 · Claude Code · Sonnet 5.5 · 4 Mar");
  });

  it("draws a default title quiet, marked", () => {
    panel({ view: { ...tileView("prompt", "empty") } });
    const title = screen.getByRole("heading", { name: "Prompt 3" });
    expect(title.getAttribute("data-default-title")).toBe("true");
  });

  it("puts an 8 dot before the line when the tile has a colour", () => {
    panel({ colour: { what: "Prompt 3", colour: "#C9A86B", onPick: vi.fn() } });
    const dot = screen.getByTestId("details-line").querySelector("[data-colour-dot]") as HTMLElement;
    expect(dot.style.width).toBe("8px");
  });

  it("says a session by its number, with its app, model and day", () => {
    panel({ view: tileView("session", "full") });
    expect(screen.getByRole("heading", { name: "Session 2" })).toBeTruthy();
    expect(screen.getByTestId("details-line").textContent).toBe("Claude Code · Sonnet 5.5 · 8 Oct 2026");
  });
});

describe("the sections", () => {
  it("are the tile's, in the window's order, each a label with its count under it", () => {
    panel();
    const sections = screen.getAllByTestId("details-section");
    expect(sections.map((section) => section.querySelector("h4")?.textContent)).toEqual(["Prompt", "Response", "Model", "Uses", "Makes", "Used by", "Model settings", "Variables"]);
    expect(within(sections[0]).getByTestId("details-count").textContent).toBe("19 words");
    expect(within(sections[3]).getByTestId("details-count").textContent).toBe("2 steps");
    expect(within(sections[7]).getByTestId("details-count").textContent).toBe("1 word a copier replaces");
  });

  // UX-02 P9: in place of "Not set: … Edit to add them.", one Add details control that opens the window Edit opens.
  it("do not draw the empty ones, and end with one Add details, which opens the editor", () => {
    const props = panel({ view: tileView("agent", "empty") });
    expect(screen.queryByText(/^Not set: /)).toBeNull();
    expect(screen.getAllByTestId("details-add")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Add details" }));
    expect(props.onEdit).toHaveBeenCalledTimes(1);
  });

  it("have no Add details when nothing is empty", () => {
    panel({ view: tileView("file", "full") });
    expect(screen.queryByTestId("details-add")).toBeNull();
  });

  it("show prose in full, a response in the quiet colour", () => {
    panel();
    const prose = screen.getAllByTestId("details-prose");
    expect(prose[0].textContent).toContain("The menu grid overflows on a phone.");
    expect(prose[0].style.lineHeight).toBe("21px");
    expect(prose[1].textContent).toBe("Done. The grid is one column below 600px.");
  });

  it("show rows 38 tall with a rule above each, the label at the left and the value at the right", () => {
    panel({ view: tileView("tool", "full") });
    const rows = screen.getAllByTestId("details-row");
    expect(rows.length).toBeGreaterThan(2);
    for (const row of rows) expect(row.style.minHeight).toBe("38px");
    // jsdom drops a custom property from a shorthand; the markup says it.
    const html = renderToStaticMarkup(<DetailsPanel {...baseProps()} view={tileView("tool", "full")} />);
    expect(html.match(/data-testid="details-row"[^>]*style="[^"]*border-top:1px solid var\(--hairline\)/g)?.length).toBeGreaterThan(2);
  });

  it("show a list as rows 27 tall, a badge with the tile's number, the name, its kind and its session", () => {
    panel();
    const link = screen.getAllByTestId("details-link")[0];
    expect(link.style.minHeight).toBe("27px");
    expect(within(link).getByTestId("details-badge").textContent).toBe("2");
    expect((within(link).getByTestId("details-badge") as HTMLElement).style.borderRadius).toBe("3px");
    expect(link.textContent).toBe("2Write the menu· PromptSession 1");
  });

  it("separate a section from the one before: 22, a 1px rule, 22; the first has none", () => {
    panel();
    const [first, second] = screen.getAllByTestId("details-section");
    expect(first.style.marginTop).toBe("");
    expect(second.style.marginTop).toBe("22px");
    expect(second.style.paddingTop).toBe("22px");
    const html = renderToStaticMarkup(<DetailsPanel {...baseProps()} view={tileView("prompt", "full")} />);
    const sections = html.match(/<section[^>]*data-testid="details-section"[^>]*>/g) ?? [];
    expect(sections[0]).not.toContain("border-top");
    expect(sections[1]).toContain("border-top:1px solid var(--hairline)");
  });
});

describe("what it keeps: it reads or moves, it does not change", () => {
  it("a links row selects its tile", () => {
    const props = panel();
    fireEvent.click(screen.getAllByTestId("details-link")[0]);
    expect(props.onSelect).toHaveBeenCalledWith("p2");
  });

  it("a row with no tile behind it (Result) is plain", () => {
    panel();
    const goes = screen.getByRole("region", { name: "Used by" });
    expect(within(goes).getAllByRole("listitem")).toHaveLength(2);
    expect(within(goes).getAllByTestId("details-link")).toHaveLength(1);
  });

  it("Copy puts the prose on the clipboard, and says so", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const props: DetailsPanelProps = baseProps();
    render(
      <BuildAnnouncer>
        <DetailsPanel {...props} />
      </BuildAnnouncer>,
    );
    fireEvent.click(within(screen.getAllByTestId("details-section")[0]).getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("The menu grid overflows on a phone."));
    // The page's one announcer says it; the panel has no live region of its own.
    await waitFor(() => expect(screen.getByTestId("build-announcer").textContent).toBe("Copied"));
    expect(document.querySelectorAll("[aria-live]")).toHaveLength(1);
  });

  it("Copy is on prose that can be copied, and nowhere else", () => {
    panel({ view: tileView("tool", "full") });
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
  });
});

describe("nothing selected", () => {
  it("says one line, to select a step", () => {
    panel({ view: null });
    expect(screen.getByText("Select a step to see its details")).toBeTruthy();
    expect(DETAILS_COPY.empty).toBe("Select a step to see its details");
  });

  it("shows tile B's title after tile A's, and the line again when the selection is cleared (F14)", () => {
    const a = { ...tileView("prompt", "full"), id: "a", title: "Tile A", defaultTitle: "Prompt 1" } as DetailsView;
    const b = { ...tileView("prompt", "full"), id: "b", title: "Tile B", defaultTitle: "Prompt 2" } as DetailsView;
    const props = baseProps();
    const view = render(<DetailsPanel {...props} view={a} />);
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Tile A");
    view.rerender(<DetailsPanel {...props} view={b} />);
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Tile B");
    view.rerender(<DetailsPanel {...props} view={null} />);
    expect(screen.getByText(DETAILS_COPY.empty)).toBeTruthy();
  });
});

describe("F45 to F47: a file in the right panel", () => {
  it("F47: one action in the head's place: Open for a file, Edit for a prompt", () => {
    const onEdit = vi.fn();
    panel({ view: tileView("file", "full"), onEdit });
    const open = screen.getByTestId("details-action");
    expect(open.textContent).toBe("Open");
    fireEvent.click(open);
    expect(onEdit).toHaveBeenCalledTimes(1);
    cleanup();
    panel({ view: tileView("prompt", "full"), onEdit });
    expect(screen.getByTestId("details-action").textContent).toBe("Edit");
  });

  it("F46: one section headed File, with Type, Size and Added by", () => {
    panel({ view: { ...tileView("file", "full"), type: "PDF", size: "212 KB", from: "added by you" } as DetailsView });
    const file = screen.getAllByTestId("details-section").find((section) => section.querySelector("h4")?.textContent === "File") as HTMLElement;
    expect(within(file).getByText("Type")).toBeTruthy();
    expect(within(file).getByText("Size")).toBeTruthy();
    expect(within(file).getByText("Added by")).toBeTruthy();
    expect(screen.getAllByTestId("details-section").map((section) => section.querySelector("h4")?.textContent)).not.toContain("From");
  });

  it("F45: the same byte count reads the same on the tile and in the panel", () => {
    for (const bytes of [12, 1500, 217_088, 3_400_000]) {
      const step = { kind: "file", fileFacts: { kind: "pdf", name: "menu.pdf", size: bytes, preview: [], mediaId: null } } as unknown as Step;
      const size = fileSize(bytes) as string;
      expect(typeLineOf(step).endsWith(` · ${size}`)).toBe(true);
      const node = { id: "f1", parent_id: null, type: "document", title: "menu.pdf", payload: { title: "menu.pdf", media_id: "m1" }, children: [] } as unknown as NodeTree;
      const view = resolveView({ steps: [], groups: [], tree: [node], sources: [], sourceFiles: [], promptsState: () => ({ prompts: [], error: false }), intoResult: new Set<string>(), media: () => ({ bytes }), selectedId: "f1" } as unknown as Parameters<typeof resolveView>[0]);
      expect(view).toMatchObject({ kind: "file", size });
    }
  });
});
