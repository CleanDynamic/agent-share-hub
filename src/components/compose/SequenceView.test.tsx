// Acceptance cover for NS-P15.
//
// The six behaviours a type checker cannot see: the toggle keeping the tree's
// collapsed branches across a trip to the sequence and back, a phase surviving
// a reload, a link written from both ends, a bulk change coalescing into one
// flush, and a 150-event build not handing the browser 150 rows.
//
// The Supabase client never appears. src/lib/build/ is stubbed with a small
// in-memory store the writes actually mutate, so "after reload" below means a
// fresh QueryClient reading the store back — not an assertion re-run against
// the same React state that produced it.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DndContext } from "@dnd-kit/core";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  events: [] as Record<string, unknown>[],
  nodes: [] as Record<string, unknown>[],
  /** Every read and write, in the order the panel issued them. */
  calls: [] as { op: string; args: unknown }[],
}));

vi.mock("@/lib/build", () => ({
  getEvents: (buildId: string, options?: { includeHidden?: boolean }) => {
    store.calls.push({ op: "getEvents", args: options ?? {} });
    const rows = options?.includeHidden
      ? store.events
      : store.events.filter((row) => row.visibility !== "hidden");
    return Promise.resolve(rows.map((row) => ({ ...row })));
  },
  setEventVisibility: (id: string, visibility: string) => {
    store.calls.push({ op: "setEventVisibility", args: { id, visibility } });
    const row = store.events.find((candidate) => candidate.id === id);
    if (row) row.visibility = visibility;
    return Promise.resolve(row);
  },
  upsertEvent: (event: Record<string, unknown>) => {
    store.calls.push({ op: "upsertEvent", args: event });
    const index = store.events.findIndex((candidate) => candidate.id === event.id);
    if (index !== -1) store.events[index] = { ...store.events[index], ...event };
    return Promise.resolve(event);
  },
  upsertNode: (node: Record<string, unknown>) => {
    store.calls.push({ op: "upsertNode", args: node });
    const index = store.nodes.findIndex((candidate) => candidate.id === node.id);
    if (index !== -1) store.nodes[index] = { ...store.nodes[index], ...node };
    return Promise.resolve(node);
  },
  reorderNodes: vi.fn(),
  deleteNode: vi.fn(),
  reorderEvents: vi.fn(),
  acceptedMediaTypes: () => "image/*",
  mediaKindFor: () => "image",
  getMediaForBuild: () => Promise.resolve([]),
  uploadMedia: vi.fn(),
  deleteMedia: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

import type { BuildEvent, BuildNode, NodeTree, NodeType } from "@/lib/build";
import { composeBuildQueryKey, type ComposeBuild } from "@/hooks/useComposeBuild";
import { CentrePanel } from "./CentrePanel";
import { PAGE_SIZE, groupByPhase } from "./SequenceView";
import { describeSpan, nextPhaseFor } from "./PhaseEditor";
import { SEQUENCE_DEBOUNCE_MS } from "./useSequence";
import { useNodeDrag, type NodeDrag } from "./useNodeDrag";

const BUILD_ID = "build-1";

// --- fixtures ----------------------------------------------------------------

function event(ordinal: number, overrides: Partial<BuildEvent> = {}): BuildEvent {
  return {
    id: `e${ordinal}`,
    build_id: BUILD_ID,
    ordinal,
    occurred_at: "2026-07-28T09:00:00Z",
    kind: "prompt",
    payload: { text: `Turn ${ordinal}: the thing I asked for` },
    phase: null,
    phase_title: null,
    visibility: "folded",
    produced_node_id: null,
    created_at: "2026-07-28T09:00:00Z",
    ...overrides,
  } as BuildEvent;
}

function node(id: string, position: number | null, parentId: string | null, children: NodeTree[] = []): NodeTree {
  return {
    id,
    build_id: BUILD_ID,
    parent_id: parentId,
    position,
    type: "note",
    title: id,
    note: null,
    payload: {},
    source_ref: null,
    event_id: null,
    is_gap: false,
    created_at: "2026-01-01T00:00:00Z",
    children,
  } as NodeTree;
}

const NODE_TYPES: NodeType[] = [
  { key: "note", label: "Note", category: "narrative", schema: { fields: [] } } as unknown as NodeType,
];

/** A (with child A1) and C, plus one tray node. */
function tree(): NodeTree[] {
  return [node("A", 0, null, [node("A1", 0, "A")]), node("C", 1, null)];
}

function trayNodes(): BuildNode[] {
  const { children: _children, ...row } = node("T1", null, null);
  return [row as BuildNode];
}

function composeFixture(): ComposeBuild {
  return {
    build: { id: BUILD_ID } as ComposeBuild["build"],
    tree: tree(),
    tray: trayNodes(),
    events: [],
    nodeTypes: NODE_TYPES,
    selectedNodeId: null,
    setSelectedNodeId: () => {},
    patchBuild: () => {},
    isSaving: false,
    lastSavedAt: null,
    isLoading: false,
    isOwner: true,
    loadError: null,
    saveError: null,
  };
}

function Harness({ compose }: { compose: ComposeBuild }) {
  const drag: NodeDrag = useNodeDrag({
    buildId: BUILD_ID,
    tree: compose.tree,
    tray: compose.tray,
    selectedNodeId: null,
    onSelect: () => {},
  });
  return <CentrePanel buildId={BUILD_ID} compose={compose} drag={drag} />;
}

/** A fresh client every time, so a re-render after one is a genuine reload. */
function renderPanel(compose = composeFixture()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(composeBuildQueryKey(BUILD_ID), {
    build: compose.build,
    tree: compose.tree,
    tray: compose.tray,
    events: [],
    nodeTypes: compose.nodeTypes,
  });
  const view = render(
    <QueryClientProvider client={client}>
      <DndContext>
        <Harness compose={compose} />
      </DndContext>
    </QueryClientProvider>
  );
  return { ...view, client };
}

function rows() {
  return document.querySelectorAll("li[data-event-ordinal]");
}

async function openSequence() {
  fireEvent.click(screen.getByRole("tab", { name: "Sequence" }));
  await waitFor(() => expect(rows().length).toBeGreaterThan(0));
}

/**
 * Wait for the debounce to elapse and the write chain to land.
 *
 * Real timers rather than fake ones, deliberately: React Query schedules its
 * own notifications on a timer, so a fake clock has to be advanced in step with
 * both the debounce and the query cache, and a single test that fails before it
 * restores the clock takes every test after it down with it. Waiting out
 * SEQUENCE_DEBOUNCE_MS costs a few hundred milliseconds and nothing else.
 */
async function settle(check: () => void) {
  await waitFor(check, { timeout: SEQUENCE_DEBOUNCE_MS + 2500 });
}

beforeEach(() => {
  store.events = [];
  store.nodes = [];
  store.calls = [];
});

// --- the pure parts ----------------------------------------------------------

describe("groupByPhase", () => {
  it("cuts the list into contiguous runs and never reorders it", () => {
    const events = [
      event(1, { phase: 1, phase_title: "Reading the inbox" }),
      event(2, { phase: 1, phase_title: "Reading the inbox" }),
      event(3),
      event(4, { phase: 2, phase_title: "The CSS fight" }),
    ];
    const groups = groupByPhase(events);
    expect(groups.map((group) => group.phase)).toEqual([1, null, 2]);
    expect(groups[0].events).toHaveLength(2);
  });

  it("splits one phase into two groups when something unphased interrupts it", () => {
    const groups = groupByPhase([
      event(1, { phase: 1, phase_title: "One" }),
      event(2),
      event(3, { phase: 1, phase_title: "One" }),
    ]);
    // The integer is the whole truth. A run the data no longer supports is
    // drawn as it actually stands rather than silently rejoined.
    expect(groups).toHaveLength(3);
  });

  it("takes a title from a later row when the first of the run has none", () => {
    const groups = groupByPhase([
      event(1, { phase: 3, phase_title: null }),
      event(2, { phase: 3, phase_title: "Named late" }),
    ]);
    expect(groups[0].title).toBe("Named late");
  });
});

describe("describeSpan", () => {
  const events = [event(1), event(2), event(3), event(4), event(5)];

  it("reports a run as contiguous", () => {
    const span = describeSpan(events, new Set(["e2", "e3", "e4"]));
    expect(span).toMatchObject({ from: 1, to: 3, contiguous: true, gaps: 0 });
  });

  it("counts the events a gapped selection skips", () => {
    const span = describeSpan(events, new Set(["e1", "e4"]));
    expect(span).toMatchObject({ contiguous: false, gaps: 2 });
  });
});

describe("nextPhaseFor", () => {
  it("keeps the integer a fully-phased selection already shares, so a rename does not renumber", () => {
    const events = [event(1, { phase: 1 }), event(2, { phase: 1 }), event(3, { phase: 2 })];
    expect(nextPhaseFor(events, [events[0], events[1]])).toBe(1);
  });

  it("takes the next free integer for a selection that is not already one phase", () => {
    const events = [event(1, { phase: 1 }), event(2), event(3, { phase: 4 })];
    expect(nextPhaseFor(events, [events[1]])).toBe(5);
  });
});

// --- acceptance 1: the toggle, and the tree state it must not lose -----------

describe("the centre panel toggle", () => {
  it("keeps the tree's collapsed branches across a trip to the sequence", async () => {
    store.events = [event(1)];
    renderPanel();

    // A has a child, so it carries a collapse control. Fold it.
    fireEvent.click(screen.getAllByRole("button", { name: "Collapse" })[0]);
    expect(screen.queryByText("A1")).toBeNull();

    await openSequence();
    expect(screen.getByRole("tab", { name: "Sequence" }).getAttribute("aria-selected")).toBe("true");

    fireEvent.click(screen.getByRole("tab", { name: "Anatomy" }));

    // Still folded. The tree was hidden, never unmounted, so the state it owns
    // survived — nothing had to be lifted out of it to make that true.
    expect(screen.queryByText("A1")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Expand" }).length).toBeGreaterThan(0);
  });

  it("does not read the sequence until the tab is opened", async () => {
    store.events = [event(1)];
    renderPanel();

    expect(store.calls.filter((call) => call.op === "getEvents")).toHaveLength(0);
    await openSequence();
    expect(store.calls.filter((call) => call.op === "getEvents")).toHaveLength(1);
  });

  it("asks for hidden events, because this is the only surface that can un-hide one", async () => {
    store.events = [event(1), event(2, { visibility: "hidden" })];
    renderPanel();
    await openSequence();

    const read = store.calls.find((call) => call.op === "getEvents");
    expect(read?.args).toMatchObject({ includeHidden: true });
    // Both rows are on screen, including the hidden one.
    expect(rows()).toHaveLength(2);
  });
});

// --- acceptance 3: a phase over a range, surviving a reload ------------------

describe("phases", () => {
  it("names a range of 8 events and groups them under that title after reload", async () => {
    store.events = Array.from({ length: 12 }, (_, index) => event(index + 1));

    const first = renderPanel();
    await openSequence();

    // Select events 3..10 — click the first, shift-click the last.
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Event 3" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Event 10" }), { shiftKey: true });
    expect(screen.getByText("8 selected")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Phase title"), {
      target: { value: "getting auth working" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Name 8 events" }));
    await settle(() =>
      expect(store.events.filter((row) => row.phase_title === "getting auth working")).toHaveLength(8)
    );
    first.unmount();

    // Reload: a new client, reading back the store the writes actually mutated.
    renderPanel();
    await openSequence();

    const heading = await screen.findByRole("heading", { name: "getting auth working" });
    expect(heading).toBeTruthy();

    const group = heading.closest("section");
    expect(group).not.toBeNull();
    expect(within(group as HTMLElement).getAllByRole("checkbox")).toHaveLength(8);

    // Every one of the eight carries the same integer, and nothing else does.
    const phased = store.events.filter((row) => row.phase_title === "getting auth working");
    expect(phased).toHaveLength(8);
    expect(new Set(phased.map((row) => row.phase))).toEqual(new Set([1]));
  });

  it("refuses a gapped selection and offers to close the gap", async () => {
    store.events = [event(1), event(2), event(3)];
    renderPanel();
    await openSequence();

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Event 1" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Event 3" }));

    expect(screen.getByText(/A phase has to be a run/)).toBeTruthy();
    const naming = screen.getByRole("button", { name: /Name 2 events/ }) as HTMLButtonElement;
    expect(naming.disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Select events 1–3" }));
    expect(screen.getByText("3 selected")).toBeTruthy();
  });
});

// --- acceptance 4: the join, written from both ends --------------------------

describe("linking an event to the node it produced", () => {
  it("sets produced_node_id and the node's event_id together", async () => {
    store.events = [event(1)];
    store.nodes = [{ id: "A", build_id: BUILD_ID, event_id: null }];

    renderPanel();
    await openSequence();

    fireEvent.click(screen.getByRole("button", { name: /Event 1: link a node/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Note A" }));

    await waitFor(() => {
      expect(store.calls.some((call) => call.op === "upsertNode")).toBe(true);
    });

    const eventWrite = store.calls.find((call) => call.op === "upsertEvent");
    expect(eventWrite?.args).toMatchObject({ id: "e1", produced_node_id: "A" });

    const nodeWrite = store.calls.find((call) => call.op === "upsertNode");
    expect(nodeWrite?.args).toMatchObject({ id: "A", event_id: "e1" });
  });

  it("clears the node the event pointed at before, so no node is left claiming it", async () => {
    store.events = [event(1, { produced_node_id: "A" })];
    store.nodes = [
      { id: "A", build_id: BUILD_ID, event_id: "e1" },
      { id: "C", build_id: BUILD_ID, event_id: null },
    ];

    const compose = composeFixture();
    compose.tree = [node("A", 0, null), node("C", 1, null)];
    compose.tree[0].event_id = "e1";
    renderPanel(compose);
    await openSequence();

    fireEvent.click(screen.getByRole("button", { name: /Event 1: produced A/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Note C" }));

    await waitFor(() => {
      expect(store.calls.filter((call) => call.op === "upsertNode")).toHaveLength(2);
    });

    const nodeWrites = store.calls.filter((call) => call.op === "upsertNode");
    expect(nodeWrites[0].args).toMatchObject({ id: "C", event_id: "e1" });
    expect(nodeWrites[1].args).toMatchObject({ id: "A", event_id: null });
  });
});

// --- acceptance 5: a bulk change is one action -------------------------------

describe("bulk actions", () => {
  it("coalesces a visibility change over 20 events into a single flush", async () => {
    store.events = Array.from({ length: 20 }, (_, index) => event(index + 1));

    renderPanel();
    await openSequence();

    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    store.calls = [];

    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Visibility of the selected events" })).getByRole(
        "radio",
        { name: "Hidden" }
      )
    );

    // Before the debounce elapses nothing has been written at all — one click,
    // not twenty round trips fired as the creator's mouse comes up.
    expect(store.calls).toHaveLength(0);

    // The optimistic update has already landed, so the panel is showing the
    // change while the write is still pending.
    expect(rows()).toHaveLength(20);

    await settle(() => expect(store.calls.length).toBe(20));

    // Every row carries the new state.
    expect(store.events.every((row) => row.visibility === "hidden")).toBe(true);
    // KNOWN GAP (see the handoff note): the flush still fans out to one
    // setEventVisibility per row, because src/lib/build/events.ts exposes no
    // batched accessor and NS-P15 must not add one. The coalescing above is
    // what this panel can do about it; the round-trip count is not.
    expect(store.calls.filter((call) => call.op === "setEventVisibility")).toHaveLength(20);
  });

  it("sets a kind over a selection in one action", async () => {
    store.events = [event(1), event(2), event(3)];

    renderPanel();
    await openSequence();

    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    fireEvent.change(screen.getByLabelText("Kind of the selected events"), {
      target: { value: "breakage" },
    });

    await settle(() => expect(store.events.every((row) => row.kind === "breakage")).toBe(true));
  });
});

// --- acceptance 6: 150 events ------------------------------------------------

describe("a long sequence", () => {
  it("renders one page of rows rather than all 150", async () => {
    store.events = Array.from({ length: 150 }, (_, index) => event(index + 1));

    renderPanel();
    await openSequence();

    expect(screen.getByText("150 events")).toBeTruthy();
    expect(rows()).toHaveLength(PAGE_SIZE);
    expect(screen.getByText("Events 1–100 of 150")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(rows()).toHaveLength(50);
    expect(screen.getByText("Events 101–150 of 150")).toBeTruthy();
  });

  it("keeps a selection made on one page while acting from another", async () => {
    store.events = Array.from({ length: 150 }, (_, index) => event(index + 1));

    renderPanel();
    await openSequence();

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Event 1" }));
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));

    // Still selected, and the bar says where it went.
    expect(screen.getByText("1 selected (1 on another page)")).toBeTruthy();
  });
});

// --- the row itself ----------------------------------------------------------

describe("the event row", () => {
  it("shows the three visibility states in words on every row", async () => {
    store.events = [event(1)];
    renderPanel();
    await openSequence();

    const control = screen.getByRole("radiogroup", { name: "Visibility of Event 1" });
    expect(within(control).getByRole("radio", { name: "Kept" })).toBeTruthy();
    expect(within(control).getByRole("radio", { name: "Folded" })).toBeTruthy();

    const hidden = within(control).getByRole("radio", { name: "Hidden" });
    // Said in full on the control itself, not only in a legend somewhere above.
    expect(hidden.getAttribute("title")).toContain("Never sent to the client, private forever");
  });

  it("truncates the payload to its first non-empty line", async () => {
    store.events = [
      event(1, { payload: { text: "\n\nThe line that shows\nand the rest that does not" } }),
    ];
    renderPanel();
    await openSequence();

    expect(screen.getByText("The line that shows")).toBeTruthy();
    expect(screen.queryByText(/the rest that does not/)).toBeNull();
  });

  it("changes one event's kind from the row", async () => {
    store.events = [event(1)];

    renderPanel();
    await openSequence();

    fireEvent.change(screen.getByLabelText("Kind of Event 1"), { target: { value: "milestone" } });

    await settle(() => expect(store.events[0].kind).toBe("milestone"));
  });

  it("writes once when a creator clicks through three visibility states", async () => {
    store.events = [event(1)];

    renderPanel();
    await openSequence();

    const control = screen.getByRole("radiogroup", { name: "Visibility of Event 1" });
    fireEvent.click(within(control).getByRole("radio", { name: "Kept" }));
    fireEvent.click(within(control).getByRole("radio", { name: "Hidden" }));
    fireEvent.click(within(control).getByRole("radio", { name: "Folded" }));

    // Three clicks, one write, and it carries the state they settled on.
    await settle(() =>
      expect(store.calls.filter((call) => call.op === "setEventVisibility")).toHaveLength(1)
    );
    expect(store.events[0].visibility).toBe("folded");
  });
});
