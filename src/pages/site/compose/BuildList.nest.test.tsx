// CA-04 P2 — tiles inside tiles in the List, the Map and on the build page.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildSteps, type Step } from "@/lib/build/graph";
import { layoutMap, MAP_SIZES } from "@/lib/build/mapLayout";
import { buildCounts, readerMap, readerResults, readerSteps, stepsMarkdown, whatYouNeed } from "@/lib/build/readerSteps";
import type { NodeTree } from "@/lib/build/types";
import type { BuildStepsView } from "@/pages/site/build/buildModel";
import { StepsList } from "@/pages/site/build/BuildSteps";

import { BuildList, NEST_LIST_COPY, type BuildListProps } from "./BuildList";
import { BuildMap } from "./BuildMap";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const node = (id: string, type: string, payload: Record<string, unknown>, position: number, parent: string | null = null, children: NodeTree[] = [], source_ref: unknown = null): NodeTree =>
  ({ id, build_id: "b", parent_id: parent, position, type, title: null, note: null, payload, source_ref, event_id: null, is_gap: false, created_at: "", children }) as NodeTree;

/** Prompt 1; prompt 2 holding order-form.tsx, which holds menu.pdf. */
function tree(): NodeTree[] {
  const file = node("f1", "document", { title: "menu.pdf" }, 1, "c1");
  const code = node("c1", "code", { source: "export const Form = () => null;", language: "tsx", filename: "order-form.tsx" }, 1, "p2", [file]);
  return [node("p1", "prompt", { text: "Plan the order page." }, 1), node("p2", "prompt", { text: "Build the form from this." }, 2, null, [code])];
}

function list(steps: readonly Step[], over: Partial<BuildListProps> = {}) {
  const props: BuildListProps = {
    phone: false,
    steps,
    dividers: new Map(),
    names: {},
    suggestions: [],
    intoResult: new Set(),
    results: [],
    selectedId: null,
    onSelect: vi.fn(),
    onRename: vi.fn(),
    onMove: vi.fn(),
    onRemove: vi.fn(),
    onAccept: vi.fn(),
    onDismiss: vi.fn(),
    onAddPrompt: vi.fn(() => Promise.resolve(true)),
    
    onAddAgentPrompt: vi.fn(() => Promise.resolve(true)),
    onAddAgentTo: vi.fn(),
    onNest: vi.fn(() => Promise.resolve(true)),
    canNest: () => true,
    ...over,
  };
  render(
    <MemoryRouter>
      <BuildList {...props} />
    </MemoryRouter>,
  );
  return props;
}

describe("the List (CA-04 P2)", () => {
  it("draws a tile inside a step with its eyebrow and no number, and a tile inside that", () => {
    list(buildSteps(tree()));
    const tiles = screen.getAllByTestId("sent-with-tile");
    expect(tiles.map((tile) => tile.getAttribute("data-kind"))).toEqual(["code", "file"]);
    expect(within(tiles[0]).getAllByText("Sent with prompt 2")).toHaveLength(1);
    expect(within(tiles[1]).getByText("Sent with order-form.tsx")).toBeTruthy();
    expect(within(tiles[0]).queryByText("1")).toBeNull();
  });

  it("gives each tile a grip handle at its left, the only drag start", () => {
    list(buildSteps(tree()));
    expect(screen.getAllByTestId("drag-handle").map((handle) => handle.getAttribute("aria-label"))).toEqual(["Move prompt 1", "Move prompt 2", "Move order-form.tsx", "Move menu.pdf"]);
  });

  it("moves without a pointer: Send with the step above, and Make it its own step, then says what happened", async () => {
    const props = list(buildSteps(tree()));
    const second = screen.getByRole("group", { name: /^Prompt 2/ });
    fireEvent.click(within(second).getAllByRole("button", { name: NEST_LIST_COPY.sendWithAbove })[0]);
    expect(props.onNest).toHaveBeenCalledWith("p2", "p1", Number.MAX_SAFE_INTEGER);
    await waitFor(() => expect(screen.getByTestId("nest-said").textContent).toBe("prompt 2 is now sent with prompt 1."));
    const [code] = screen.getAllByTestId("sent-with-tile");
    fireEvent.click(within(code).getAllByRole("button", { name: NEST_LIST_COPY.ownStep }).at(-1) as HTMLElement);
    expect(props.onNest).toHaveBeenLastCalledWith("c1", null, 2);
    await waitFor(() => expect(screen.getByTestId("nest-said").textContent).toBe("order-form.tsx is now its own step."));
    expect(screen.getByTestId("nest-said").getAttribute("aria-live")).toBe("polite");
    expect(within(screen.getByRole("group", { name: /^Prompt 1/ })).queryByRole("button", { name: NEST_LIST_COPY.sendWithAbove })).toBeNull();
  });

  it("offers nothing to move in a one-step build", () => {
    list(buildSteps([node("p1", "prompt", { text: "Only one." }, 1)]));
    expect(screen.queryByTestId("drag-handle")).toBeNull();
    expect(screen.queryByTestId("nest-said")).toBeNull();
  });

  it("offers code sent with an imported prompt as a dashed suggestion: Accept puts it inside, Ignore leaves it", () => {
    const ref = { source: "transcript", session_id: "e", index: 0, import_session_id: "imp" };
    const steps = buildSteps([node("p1", "prompt", { text: "Use this:\n```tsx order-form.tsx\nexport const A = 1;\n```" }, 1, null, [], ref), node("p2", "prompt", { text: "Next." }, 2)]);
    const onKeepSentWith = vi.fn();
    const onIgnoreSentWith = vi.fn();
    list(steps, { onKeepSentWith, onIgnoreSentWith });
    const offer = screen.getByTestId("sent-with-suggestion");
    expect(offer.textContent).toContain("Sent with this prompt in the chat. Keep it inside?");
    expect(offer.textContent).toContain("Code · order-form.tsx · 1 line");
    fireEvent.click(within(offer).getByRole("button", { name: "Accept" }));
    expect(onKeepSentWith).toHaveBeenCalledWith({ key: "sent:0", stepId: "p1", source: "export const A = 1;", language: "tsx", filename: "order-form.tsx" });
    fireEvent.click(within(offer).getByRole("button", { name: "Ignore" }));
    expect(onIgnoreSentWith).toHaveBeenCalledWith("p1", "sent:0");
  });
});

describe("the Map (CA-04 P2)", () => {
  it("draws tiles inside a step as small rows in its box, not as boxes, and grows the box to hold them", () => {
    const steps = buildSteps(tree());
    const layout = layoutMap(steps, [], [], [], []);
    const [first, second] = layout.boxes;
    expect(layout.boxes.map((box) => box.id)).toEqual(["p1", "p2"]);
    expect(second.sentWith).toEqual([
      { id: "c1", kind: "Code", name: "order-form.tsx" },
      { id: "f1", kind: "File", name: "menu.pdf" },
    ]);
    expect(second.h - first.h).toBe(2 * MAP_SIZES.sentRow);
    const html = renderToStaticMarkup(<BuildMap steps={steps} groups={[]} files={[]} tools={[]} results={[]} suggestions={[]} selectedId={null} onSelect={() => undefined} onClear={() => undefined} onConnect={() => undefined} />);
    expect(html).toContain("Code · order-form.tsx");
    expect(html).toContain("File · menu.pdf");
    expect(html).toContain("font-size:12px");
    expect(html).not.toContain('data-testid="map-box-c1"');
  });
});

describe("the build page (CA-04 P2)", () => {
  function view(): BuildStepsView {
    const t = tree();
    const steps = readerSteps(t, null);
    return { steps, results: readerResults(t), need: whatYouNeed(steps, t, null), counts: buildCounts(steps), map: readerMap(t, null), mapAvailable: false, onCopy: vi.fn(async () => true), resolveMedia: () => undefined, otherBody: () => null, focus: null };
  }

  it("shows what a step sends with it indented 36 under its text, recursively", () => {
    render(
      <MemoryRouter>
        <StepsList view={view()} phone={false} announce={() => undefined} />
      </MemoryRouter>,
    );
    const card = screen.getAllByTestId("step-card")[1];
    const blocks = within(card).getAllByTestId("sent-with");
    expect(blocks).toHaveLength(2);
    expect(blocks.map((block) => block.style.marginLeft)).toEqual(["36px", "36px"]);
    expect(within(blocks[0]).getAllByText("Sent with prompt 2")).toHaveLength(1);
    expect(within(blocks[1]).getByText("menu.pdf")).toBeTruthy();
  });

  it("copies a step together, and Copy for AI writes the step as one message", async () => {
    const steps = view();
    render(
      <MemoryRouter>
        <StepsList view={steps} phone={false} announce={() => undefined} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy step 2" }));
    await waitFor(() => expect(steps.onCopy).toHaveBeenCalledWith("Build the form from this.\n\n```tsx order-form.tsx\nexport const Form = () => null;\n```\n\nAttach menu.pdf"));
    const md = stepsMarkdown({ title: "T" }, steps.steps);
    expect(md).toContain("````\nBuild the form from this.\n\n```tsx order-form.tsx\nexport const Form = () => null;\n```\n\nAttach menu.pdf\n````");
  });
});

describe("Details (CA-04 P2)", () => {
  it("opens a tile inside a step, its eyebrow saying what it is sent with", async () => {
    const { resolveView } = await import("./detailsView");
    const t = tree();
    const steps = buildSteps(t);
    const ctx = { steps, groups: [], tree: t, sources: [], sourceFiles: [], promptsState: () => ({ prompts: [], error: false }), intoResult: new Set<string>(), media: () => undefined };
    expect(resolveView({ ...ctx, selectedId: "c1" })).toMatchObject({ kind: "code", id: "c1", sentWithLine: "Sent with prompt 2", filename: "order-form.tsx" });
    expect(resolveView({ ...ctx, selectedId: "f1" })).toMatchObject({ kind: "file", id: "f1", name: "menu.pdf", sentWithLine: "Sent with order-form.tsx" });
  });
});
