// Acceptance cover for the breakage view (NS-P16).
//
// The fixture holds the two shapes the view has to merge into one list: the
// seeded breakage, written up as a node with a span and a count of attempts
// and linked to the event it happened at, and a second breakage recorded only
// as an event in the sequence.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Build, BuildEvent, NodeTree, NodeType } from "@/lib/build";
import { BreakageView, collectBreakages, spanLabel } from "./BreakageView";

const nodeTypes = [
  {
    key: "breakage", label: "Breakage", category: "narrative", colour: "#EF4444",
    icon: "TriangleAlert", renderer: "breakage", copyable: false, is_active: true, sort: 3,
    schema: {
      fields: [
        { key: "symptom", label: "Symptom", type: "text", required: true },
        { key: "cause", label: "Cause", type: "text" },
        { key: "resolution", label: "Resolution", type: "text" },
        { key: "attempts", label: "Attempts", type: "number" },
        { key: "event_start", label: "First event", type: "number" },
        { key: "event_end", label: "Last event", type: "number" },
      ],
    },
  },
  {
    key: "prompt", label: "Prompt", category: "instruction", colour: "#E8571A",
    icon: "MessageSquare", renderer: "prompt", copyable: true, is_active: true, sort: 1,
    schema: { fields: [{ key: "text", label: "Prompt text", type: "text", required: true }] },
  },
] as unknown as NodeType[];

const build = { id: "b1", title: "Inbox triage agent" } as unknown as Build;

function tree(): NodeTree[] {
  return [
    {
      id: "n-breakage", build_id: "b1", parent_id: null, position: 4, type: "breakage",
      title: "Long threads were all being archived", note: null, event_id: "e6",
      is_gap: false, source_ref: null, created_at: "2026-07-29T00:00:00Z", children: [],
      payload: {
        symptom: "Any thread past roughly forty messages came back archive.",
        cause: "The full thread was pasted in newest-last.",
        resolution: "A generated summary plus the last three messages.",
        attempts: 6,
        event_start: 6,
        event_end: 9,
      },
    },
    {
      id: "n-prompt", build_id: "b1", parent_id: null, position: 0, type: "prompt",
      title: "Per-email classify call", note: null, event_id: "e4", is_gap: false,
      source_ref: null, created_at: "2026-07-28T00:00:00Z", children: [],
      payload: { text: "Classify this email." },
    },
  ] as unknown as NodeTree[];
}

const events = [
  { id: "e4", ordinal: 4, kind: "prompt", payload: { text: "Classify." } },
  {
    id: "e6", ordinal: 6, kind: "breakage",
    payload: {
      symptom: "Every thread longer than forty messages came back as archive.",
      cause: "The newest message ended up buried.",
      resolution: "Summary plus the last three messages.",
    },
  },
  {
    id: "e11", ordinal: 11, kind: "breakage",
    payload: {
      symptom: "Three drafts promised a delivery date that existed nowhere in the thread. One was to a client.",
      cause: "Voice matching retrieved my own replies, which are full of dates.",
      resolution: "The retrieved replies are labelled as style samples.",
    },
  },
  { id: "e18", ordinal: 18, kind: "deploy", payload: { text: "Deployed." } },
].map((spec) => ({
  build_id: "b1",
  occurred_at: "2026-07-29T11:02:00Z",
  phase: 1,
  phase_title: "Reading the inbox",
  visibility: "kept",
  produced_node_id: null,
  created_at: "2026-07-28T00:00:00Z",
  ...spec,
})) as unknown as BuildEvent[];

function renderView(props: Partial<React.ComponentProps<typeof BreakageView>> = {}) {
  return render(
    <BreakageView
      build={build}
      events={events}
      tree={tree()}
      nodeTypes={nodeTypes}
      resolveNode={() => undefined}
      resolveMedia={() => null}
      {...props}
    />
  );
}

describe("collectBreakages", () => {
  it("merges a node with the breakage event it links, rather than listing both", () => {
    const entries = collectBreakages(tree(), events, nodeTypes);
    expect(entries).toHaveLength(2);
    expect(entries[0].key).toBe("node-n-breakage");
    expect(entries[0].event?.id).toBe("e6");
    expect(entries[1].key).toBe("event-e11");
  });

  it("orders by the step it broke at", () => {
    expect(collectBreakages(tree(), events, nodeTypes).map((entry) => entry.start)).toEqual([6, 11]);
  });

  it("takes the span from the node's payload, over the linked event's ordinal", () => {
    const [first] = collectBreakages(tree(), events, nodeTypes);
    expect(first.start).toBe(6);
    expect(first.end).toBe(9);
    expect(spanLabel(first)).toBe("steps 6–9");
  });

  it("gives an event-only breakage its own ordinal as the whole span", () => {
    const [, second] = collectBreakages(tree(), events, nodeTypes);
    expect(spanLabel(second)).toBe("step 11");
  });

  it("finds breakage nodes through the registry, not through the type string", () => {
    const recoloured = nodeTypes.map((type) =>
      type.key === "breakage" ? ({ ...type, renderer: "narrative" } as NodeType) : type
    );
    // The type no longer claims the breakage renderer, so the node is no longer
    // a breakage — and its event is no longer claimed, so it lists on its own.
    const entries = collectBreakages(tree(), events, recoloured);
    expect(entries.map((entry) => entry.key)).toEqual(["event-e6", "event-e11"]);
  });

  it("sorts a breakage with no recorded step to the end", () => {
    const unplaced = tree();
    (unplaced[0] as { event_id: string | null }).event_id = null;
    (unplaced[0] as { payload: Record<string, unknown> }).payload = { symptom: "No idea when." };
    const entries = collectBreakages(unplaced, events, nodeTypes);
    expect(entries[entries.length - 1].key).toBe("node-n-breakage");
    expect(spanLabel(entries[entries.length - 1])).toBeNull();
  });
});

describe("BreakageView", () => {
  it("lists the seeded breakage with its span, through the breakage renderer", () => {
    const { container } = renderView();
    const first = container.querySelector('[data-breakage-start="6"]') as HTMLElement;
    expect(first.getAttribute("data-breakage-end")).toBe("9");
    expect(within(first).getByText("Long threads were all being archived")).toBeTruthy();
    expect(within(first).getByText(/Any thread past roughly forty messages/)).toBeTruthy();
    expect(within(first).getByText(/Resolved after 6 attempts/)).toBeTruthy();
    // The same renderer the anatomy would have used.
    expect(first.querySelector('[data-visual-slot="renderer-breakage"]')).toBeTruthy();
  });

  it("shows an event-only breakage with symptom, cause and resolution", () => {
    const { container } = renderView();
    const second = container.querySelector('[data-breakage-start="11"]') as HTMLElement;
    expect(within(second).getByText("Breakage at step 11")).toBeTruthy();
    expect(within(second).getByText(/Three drafts promised a delivery date/)).toBeTruthy();
    expect(within(second).getByText("Cause")).toBeTruthy();
    expect(within(second).getByText("Resolution")).toBeTruthy();
  });

  it("prints each breakage once, not once per source", () => {
    renderView();
    // The node and the event it links describe one failure. The heading comes
    // from the node's card; the header strip does not repeat it.
    expect(screen.getAllByText("Long threads were all being archived")).toHaveLength(1);
    expect(
      screen.getAllByText(/Three drafts promised a delivery date/)
    ).toHaveLength(1);
  });

  it("links into the replay at the step it broke", () => {
    const onOpenReplay = vi.fn();
    renderView({ onOpenReplay });
    fireEvent.click(screen.getByRole("button", { name: "steps 6–9 — watch it" }));
    expect(onOpenReplay).toHaveBeenCalledWith(6);

    fireEvent.click(screen.getByRole("button", { name: "step 11 — watch it" }));
    expect(onOpenReplay).toHaveBeenCalledWith(11);
  });

  it("says no breakages were recorded rather than rendering nothing", () => {
    render(
      <BreakageView
        build={build}
        events={[events[0], events[3]]}
        tree={[tree()[1]]}
        nodeTypes={nodeTypes}
        resolveNode={() => undefined}
        resolveMedia={() => null}
      />
    );
    expect(screen.getByText("No breakages recorded")).toBeTruthy();
    expect(screen.getByText(/Either nothing broke, or nothing was written down/)).toBeTruthy();
  });
});
