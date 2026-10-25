// CA-18 P1, P3: the modal and Details are the same sections. For every kind, a tile's window (in edit mode) and its Details are
// rendered for the same tile, and the section labels Details draws appear in the window, in the same order. Details leaves the
// empty ones out, so it can draw fewer; it never draws one the window lacks, and never in another order.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildFacts, tileView } from "@/dev/fixtures/detailsKinds";
import { TILE_KINDS, readSections, sectionsOf, type TileKind } from "@/lib/build/tileSections";

import { DetailsPanel, type DetailsHandlers } from "./DetailsPanel";
import { TileEditDialog } from "./TileEditDialog";
import { FullPromptWindow } from "@/components/build/FullPromptWindow";
import { sandboxListProps } from "@/dev/fixtures/sandbox";
import type { PromptView } from "./DetailsPanel";
import { openOptional } from "./optionalKit";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const handlers = () => ({ onRename: vi.fn(), onModel: vi.fn(), onAddUse: vi.fn(), onRemoveUse: vi.fn(), onRuns: vi.fn(), onRemoveInside: vi.fn(), onToggleSessionPrompt: vi.fn(), onDownload: vi.fn(), onFields: vi.fn(), onAddPicture: vi.fn(), onUseAsCover: vi.fn(), onExtras: vi.fn(), onRuntime: vi.fn(), onRunsWhen: vi.fn(), onAgentSetup: vi.fn(), onAgentNotes: vi.fn(), onModelRun: vi.fn(), onCheckRuns: vi.fn(), onCheckCases: vi.fn(), onToolConnection: vi.fn(), onManual: vi.fn(), onInstructions: vi.fn(), onSessionExtras: vi.fn(), onSessionGoal: vi.fn(), onSessionMeta: vi.fn(), onSessionTogether: vi.fn(), onNotShared: vi.fn(), onAddToSetup: vi.fn(), onAddMade: vi.fn(), onRemoveMade: vi.fn(), onAttach: vi.fn(), onTrainedOn: vi.fn() }) as unknown as DetailsHandlers;

/** Where each label first appears as an element's own words (a choice among options is not a heading): its place in the document. */
function positions(root: HTMLElement, labels: readonly string[]): (number | null)[] {
  const all = [...root.querySelectorAll("*")];
  const choice = 'button[aria-pressed], [role="radio"], [role="menuitem"], [role="menuitemradio"], [role="option"], option';
  const own = (element: Element) =>
    Array.from(element.childNodes)
      .filter((node) => node.nodeType === 3)
      .map((node) => node.textContent ?? "")
      .join("")
      .trim();
  return labels.map((label) => {
    const at = all.findIndex((element) => own(element) === label && !element.closest(choice));
    return at < 0 ? null : at;
  });
}

/** The labels Details draws, from the DOM. */
const detailsLabels = (): string[] => screen.getAllByTestId("details-section").map((section) => section.querySelector("h4")?.textContent ?? "");

/** Details' section, and the window field that holds it. */
const SESSION_EXTRAS_AS: Record<string, string> = { "Cost and tokens": "What it cost", "At the same time as": "Ran alongside" };

const WINDOW_KINDS: readonly TileKind[] = TILE_KINDS.filter((kind) => !["prompt", "file"].includes(kind));

describe("a tile's window and its Details share their sections (CA-18)", () => {
  it.each(WINDOW_KINDS)("%s: every section Details draws is in the window, in the same order", (kind) => {
    const view = tileView(kind, "full");
    render(<DetailsPanel phone={false} view={view} build={buildFacts} {...handlers()} />);
    const drawn = detailsLabels();
    expect(drawn.length, `${kind} draws sections`).toBeGreaterThan(0);
    cleanup();
    render(<TileEditDialog view={view} handlers={handlers()} inBuild={[]} onClose={vi.fn()} />);
    openOptional();
    // CA-28: a session's extras are the window's own Optional fields, one each, in the window's words.
    const inWindow = drawn.map((label) => SESSION_EXTRAS_AS[label] ?? label);
    const at = positions(screen.getByRole("dialog"), inWindow);
    const missing = drawn.filter((_, i) => at[i] === null);
    expect(missing, `${kind}: in Details but not in its window`).toEqual([]);
    const found = at.filter((position): position is number => position !== null);
    expect(found, `${kind}: the order differs`).toEqual([...found].sort((a, b) => a - b));
  });

  it("a prompt: the prompt window has the sections Details draws, in order", () => {
    const view = tileView("prompt", "full") as PromptView;
    render(<DetailsPanel phone={false} view={view} build={buildFacts} {...handlers()} />);
    const drawn = detailsLabels();
    cleanup();
    const base = sandboxListProps("bakery");
    render(<FullPromptWindow steps={base.steps} openId="p3" mode="maker" onClose={vi.fn()} onTitle={vi.fn()} onReply={vi.fn()} onExtras={vi.fn()} onText={vi.fn()} details={() => ({ ...view, id: "p3" })} handlers={handlers() as never} />);
    // CA-28: a session's extras are the window's own Optional fields, one each, in the window's words.
    const inWindow = drawn.map((label) => SESSION_EXTRAS_AS[label] ?? label);
    const at = positions(screen.getByRole("dialog"), inWindow);
    expect(drawn.filter((_, i) => at[i] === null)).toEqual([]);
    const found = at.filter((position): position is number => position !== null);
    expect(found).toEqual([...found].sort((a, b) => a - b));
  });

  it("every kind's list names the same sections whether Details draws them or leaves them empty", () => {
    for (const kind of TILE_KINDS) {
      const { sections, notSet } = readSections(tileView(kind, "full"), buildFacts);
      expect([...sections.map((s) => s.label), ...notSet].sort(), kind).toEqual(sectionsOf(kind).map((s) => s.label).sort());
    }
  });
});
