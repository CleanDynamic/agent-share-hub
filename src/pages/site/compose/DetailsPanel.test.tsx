// CA-18 P3: the Details panel, read only. It shows the selected tile with the same sections, names and order as the tile's
// window, and nothing in it can be typed into; every change is made in the window, which Edit opens.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildFacts, tileView } from "@/dev/fixtures/detailsKinds";
import { TILE_KINDS } from "@/lib/build/tileSections";

import { DETAILS_COPY, DetailsPanel, type DetailsPanelProps } from "./DetailsPanel";

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
      for (const name of [/^Remove/, /^Rename/, /^Add /, /^Colour for/, /^Save/, /^Use as cover/, /Take the goal off/]) expect(screen.queryByRole("button", { name }), `${kind} ${String(name)}`).toBeNull();
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
    expect(screen.getByTestId("details-line").textContent).toBe("Session 2 · Claude Code · Sonnet 5.5 · 4 Mar · prompt 3 of 4");
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
    expect(sections.map((section) => section.querySelector("h4")?.textContent)).toEqual(["Prompt", "Response", "Model", "Uses", "Makes", "Goes into", "Model settings", "Variables"]);
    expect(within(sections[0]).getByTestId("details-count").textContent).toBe("19 words");
    expect(within(sections[3]).getByTestId("details-count").textContent).toBe("2 tiles");
    expect(within(sections[7]).getByTestId("details-count").textContent).toBe("1 word a copier replaces");
  });

  it("do not draw the empty ones, and the last line names them once", () => {
    panel({ view: tileView("agent", "empty") });
    const drawn = screen.getAllByTestId("details-section").map((section) => section.querySelector("h4")?.textContent);
    const line = screen.getByTestId("details-not-set").textContent ?? "";
    expect(line.startsWith("Not set: ")).toBe(true);
    expect(line.endsWith(". Edit to add them.")).toBe(true);
    for (const label of drawn) expect(line).not.toContain(label ?? "?");
    expect(screen.getAllByTestId("details-not-set")).toHaveLength(1);
  });

  it("have no line at the foot when nothing is empty", () => {
    panel({ view: tileView("file", "full") });
    expect(screen.queryByTestId("details-not-set")).toBeNull();
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
    const goes = screen.getByRole("region", { name: "Goes into" });
    expect(within(goes).getAllByRole("listitem")).toHaveLength(2);
    expect(within(goes).getAllByTestId("details-link")).toHaveLength(1);
  });

  it("Copy puts the prose on the clipboard, and says so", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    panel();
    fireEvent.click(within(screen.getAllByTestId("details-section")[0]).getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("The menu grid overflows on a phone."));
    expect(await screen.findByText("Copied")).toBeTruthy();
  });

  it("Copy is on prose that can be copied, and nowhere else", () => {
    panel({ view: tileView("tool", "full") });
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
  });
});

describe("nothing selected", () => {
  it("says to select a tile or a session", () => {
    panel({ view: null });
    expect(screen.getByText("Select a tile or session to see it here.")).toBeTruthy();
    expect(DETAILS_COPY.empty).toBe("Select a tile or session to see it here.");
  });
});
