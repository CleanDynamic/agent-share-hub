// Acceptance cover for the replay (NS-P16).
//
// The fixture is the seeded build's shape after NS-P16 extended it: eighteen
// ordinals across four phases with two of them hidden, several events pointing
// at the node they produced, and a breakage in the middle.
//
// The hidden pair matters here. getEvents strips them in the query, so this
// component is handed sixteen rows and must render sixteen — the test asserts
// that nothing in the fixture's hidden text ever appears, which is the DOM
// half of the guarantee. The query half is asserted in events.test.ts.

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Build, BuildEvent, BuildNode, NodeType, RebuildSummary } from "@/lib/build";
import { Replay, producedAt, phaseRuns } from "./Replay";

const nodeTypes = [
  {
    key: "prompt", label: "Prompt", category: "instruction", colour: "#E8571A",
    icon: "MessageSquare", renderer: "prompt", copyable: true, is_active: true, sort: 1,
    schema: { fields: [{ key: "text", label: "Prompt text", type: "text", required: true }] },
  },
  {
    key: "code", label: "Code", category: "artefact", colour: "#F59E0B",
    icon: "Code2", renderer: "artefact", copyable: true, is_active: true, sort: 1,
    schema: { fields: [{ key: "source", label: "Source", type: "text", required: true }] },
  },
  {
    key: "live_app", label: "Live app", category: "artefact", colour: "#F59E0B",
    icon: "Globe", renderer: "artefact", copyable: false, is_active: true, sort: 2,
    schema: { fields: [{ key: "url", label: "URL", type: "string", format: "url" }] },
  },
] as unknown as NodeType[];

const build = { id: "b1", title: "Inbox triage agent", shape: "app" } as unknown as Build;

const nodes: Record<string, BuildNode> = {
  "n-prompt": {
    id: "n-prompt", build_id: "b1", type: "prompt", title: "Per-email classify call",
    payload: { text: "Classify this email." }, parent_id: null, position: 0,
    note: null, source_ref: null, event_id: "e4", is_gap: false, created_at: "2026-07-28T00:00:00Z",
  } as unknown as BuildNode,
  "n-code": {
    id: "n-code", build_id: "b1", type: "code", title: "fetch_thread_context implementation",
    payload: { source: "export async function fetchThreadContext() {}" }, parent_id: null,
    position: 1, note: null, source_ref: null, event_id: null, is_gap: false,
    created_at: "2026-07-29T00:00:00Z",
  } as unknown as BuildNode,
  "n-app": {
    id: "n-app", build_id: "b1", type: "live_app", title: "The running agent",
    payload: { url: "https://inbox.test" }, parent_id: null, position: 2, note: null,
    source_ref: null, event_id: "e18", is_gap: false, created_at: "2026-08-15T00:00:00Z",
  } as unknown as BuildNode,
};

const resolveNode = (id: string) => nodes[id];
const resolveMedia = () => null;

/** The whole sequence, hidden rows included, as the database holds it. */
const allEvents: BuildEvent[] = [
  { ordinal: 1, kind: "note", phase: 1, phase_title: "Reading the inbox", visibility: "kept", payload: { text: "Started from the actual problem." } },
  { ordinal: 2, kind: "note", phase: 1, phase_title: "Reading the inbox", visibility: "folded", payload: { text: "Labelled sixty emails by hand." } },
  { ordinal: 3, kind: "prompt", phase: 1, phase_title: "Reading the inbox", visibility: "folded", payload: { text: "Five categories, unusable." } },
  { ordinal: 4, kind: "prompt", phase: 1, phase_title: "Reading the inbox", visibility: "kept", payload: { text: "Classify into exactly one of three." }, produced_node_id: "n-prompt" },
  { ordinal: 5, kind: "note", phase: 1, phase_title: "Reading the inbox", visibility: "folded", payload: { text: "41 of 60 as the baseline." } },
  { ordinal: 6, kind: "breakage", phase: 1, phase_title: "Reading the inbox", visibility: "kept", payload: { symptom: "Long threads all archived.", cause: "Newest message buried.", resolution: "Summary plus last three." }, produced_node_id: "n-code" },
  { ordinal: 7, kind: "note", phase: 2, phase_title: "Making it read the newest message", visibility: "folded", payload: { text: "A bigger window made it worse." } },
  { ordinal: 8, kind: "prompt", phase: 2, phase_title: "Making it read the newest message", visibility: "kept", payload: { text: "Summary first, newest three after." } },
  { ordinal: 9, kind: "milestone", phase: 2, phase_title: "Making it read the newest message", visibility: "kept", payload: { text: "91% after the thread-window fix." } },
  { ordinal: 15, kind: "note", phase: 4, phase_title: "Putting it in front of a real inbox", visibility: "hidden", payload: { text: "SECRET OAUTH ACCOUNT DETAILS" } },
  { ordinal: 16, kind: "note", phase: 4, phase_title: "Putting it in front of a real inbox", visibility: "folded", payload: { text: "Two weeks alongside manual triage." } },
  { ordinal: 17, kind: "note", phase: 4, phase_title: "Putting it in front of a real inbox", visibility: "hidden", payload: { text: "SECRET ROUTING SPREADSHEET" } },
  { ordinal: 18, kind: "deploy", phase: 4, phase_title: "Putting it in front of a real inbox", visibility: "kept", payload: { text: "Deployed behind Google sign-in." }, produced_node_id: "n-app" },
].map((spec, index) => ({
  id: `e${spec.ordinal}`,
  build_id: "b1",
  occurred_at: `2026-07-2${(index % 9) + 1}T09:00:00Z`,
  produced_node_id: null,
  created_at: "2026-07-28T00:00:00Z",
  ...spec,
})) as unknown as BuildEvent[];

/** What getEvents hands the page: hidden rows excluded in the query. */
const events = allEvents.filter((event) => event.visibility !== "hidden");

function renderReplay(props: Partial<React.ComponentProps<typeof Replay>> = {}) {
  return render(
    <Replay
      build={build}
      events={events}
      nodeTypes={nodeTypes}
      resolveNode={resolveNode}
      resolveMedia={resolveMedia}
      {...props}
    />
  );
}

describe("Replay", () => {
  it("renders one scrubber tick per visible event, and none for the hidden ones", () => {
    const { container } = renderReplay();
    const ticks = container.querySelectorAll("[data-tick-ordinal]");
    expect(ticks).toHaveLength(events.length);
    expect([...ticks].map((tick) => tick.getAttribute("data-tick-ordinal"))).not.toContain("15");
    expect([...ticks].map((tick) => tick.getAttribute("data-tick-ordinal"))).not.toContain("17");
  });

  it("never renders a hidden event's text", () => {
    renderReplay();
    expect(screen.queryByText(/SECRET OAUTH/)).toBeNull();
    expect(screen.queryByText(/SECRET ROUTING/)).toBeNull();
    expect(document.body.textContent).not.toContain("SECRET");
  });

  it("renders phase titles as headings along the sequence", () => {
    renderReplay();
    expect(screen.getAllByText("Reading the inbox").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Making it read the newest message").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Putting it in front of a real inbox").length).toBeGreaterThan(0);
  });

  it("steps to ordinal 8 and renders the node produced at or before it", () => {
    const { container } = renderReplay();
    fireEvent.click(container.querySelector('[data-tick-ordinal="8"]') as Element);

    expect(screen.getByText("What existed at step 8")).toBeTruthy();
    // Nothing produced at 7 or 8, so the artefact is still ordinal 6's node —
    // rendered through the artefact renderer the anatomy would have used.
    const slot = container.querySelector("[data-produced-by-ordinal]") as HTMLElement;
    expect(slot.getAttribute("data-produced-by-ordinal")).toBe("6");
    expect(within(slot).getByText("fetch_thread_context implementation")).toBeTruthy();
    expect(slot.querySelector('[data-renderer-slot="artefact"]')).toBeTruthy();
  });

  it("steps with the arrow keys and plays with space", () => {
    vi.useFakeTimers();
    try {
      const { container } = render(
        <Replay
          build={build}
          events={events}
          nodeTypes={nodeTypes}
          resolveNode={resolveNode}
          resolveMedia={resolveMedia}
        />
      );
      const bar = screen.getByRole("toolbar");

      fireEvent.keyDown(bar, { key: "ArrowRight" });
      expect(screen.getByText("step 2 of 18")).toBeTruthy();
      fireEvent.keyDown(bar, { key: "ArrowRight" });
      expect(screen.getByText("step 3 of 18")).toBeTruthy();
      fireEvent.keyDown(bar, { key: "ArrowLeft" });
      expect(screen.getByText("step 2 of 18")).toBeTruthy();

      fireEvent.keyDown(bar, { key: " " });
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(screen.getByText("step 3 of 18")).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(screen.getByText("step 4 of 18")).toBeTruthy();

      // Space again pauses, and time stops moving the position.
      fireEvent.keyDown(bar, { key: " " });
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      expect(screen.getByText("step 4 of 18")).toBeTruthy();
      expect(container).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("collapses a folded event to one line and reveals it on request", () => {
    const { container } = renderReplay();
    const folded = container.querySelector('[data-event-ordinal="2"]') as HTMLElement;
    expect(folded.getAttribute("data-visibility")).toBe("folded");

    const reveal = within(folded).getByRole("button", { name: "reveal" });
    expect(reveal.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(reveal);
    expect(within(folded).getByRole("button", { name: "fold" }).getAttribute("aria-expanded")).toBe("true");

    // A kept event has no reveal at all: it arrives open.
    const kept = container.querySelector('[data-event-ordinal="1"]') as HTMLElement;
    expect(within(kept).queryByRole("button", { name: "reveal" })).toBeNull();
  });

  it("jumps to a focus ordinal handed in from another tab", () => {
    const { rerender } = renderReplay();
    rerender(
      <Replay
        build={build}
        events={events}
        nodeTypes={nodeTypes}
        resolveNode={resolveNode}
        resolveMedia={resolveMedia}
        focusOrdinal={6}
      />
    );
    expect(screen.getByText("step 6 of 18")).toBeTruthy();
  });

  it("offers a fork at the position the reader is on", () => {
    const onFork = vi.fn();
    const { container } = renderReplay({ onFork });
    fireEvent.click(container.querySelector('[data-tick-ordinal="6"]') as Element);
    fireEvent.click(screen.getByRole("button", { name: "Rebuild from here" }));
    expect(onFork).toHaveBeenCalledWith(6);
  });

  it("says so rather than blanking when no sequence was recorded", () => {
    render(
      <Replay
        build={build}
        events={[]}
        nodeTypes={nodeTypes}
        resolveNode={resolveNode}
        resolveMedia={resolveMedia}
      />
    );
    expect(screen.getByText("No sequence was recorded for this build.")).toBeTruthy();
  });
});

describe("phaseRuns", () => {
  it("cuts the sequence into contiguous runs, carrying a later title forward", () => {
    const runs = phaseRuns(events);
    expect(runs.map((run) => run.title)).toEqual([
      "Reading the inbox",
      "Making it read the newest message",
      "Putting it in front of a real inbox",
    ]);
    expect(runs[0]).toMatchObject({ from: 0, to: 5 });
    expect(runs[1]).toMatchObject({ from: 6, to: 8 });
  });

  it("splits a phase that is no longer contiguous rather than claiming it", () => {
    const shuffled = [events[0], events[6], events[1]];
    expect(phaseRuns(shuffled)).toHaveLength(3);
  });
});

describe("Replay divergence markers (NS-P40)", () => {
  const rebuild = (over: Record<string, unknown> = {}) =>
    ({
      id: "r1",
      slug: "sams-rebuild",
      title: "Sam's rebuild",
      creator: { id: "u2", username: "sam", display_name: "Sam", avatar_url: null },
      rebuild_note: null,
      created_at: "2026-08-20T09:00:00Z",
      forked_from_event_id: events[3].id,
      reproduction_count: 0,
      ...over,
    }) as RebuildSummary;

  it("marks the step a rebuild was taken at, and nothing else", () => {
    const { container } = renderReplay({ divergences: [rebuild()] });

    const marks = container.querySelectorAll("[data-testid='divergence-marker']");
    expect(marks).toHaveLength(1);
    expect(marks[0].getAttribute("data-divergence-ordinal")).toBe(String(events[3].ordinal));
    // The row is cell-per-event, so the dot lines up with its own tick.
    const row = container.querySelector("[data-visual-slot='build-replay-divergences']");
    expect(row?.children).toHaveLength(events.length);
  });

  it("renders nothing at all for a build nobody has rebuilt from", () => {
    const { container } = renderReplay({ divergences: [] });
    expect(container.querySelector("[data-visual-slot='build-replay-divergences']")).toBeNull();
    expect(screen.queryByTestId("divergence-names")).toBeNull();
  });

  it("ignores a rebuild that names no moment, or one this sequence does not hold", () => {
    const { container } = renderReplay({
      divergences: [
        rebuild({ id: "whole", forked_from_event_id: null }),
        // Hidden events never reach this component, so a rebuild taken at one
        // has no tick to sit over.
        rebuild({ id: "hidden", forked_from_event_id: "e15" }),
      ],
    });
    expect(container.querySelectorAll("[data-testid='divergence-marker']")).toHaveLength(0);
  });

  it("names who rebuilt from a step when the marker is pointed at", () => {
    renderReplay({ divergences: [rebuild()] });

    // Before anything is pointed at, the line counts them.
    expect(screen.getByTestId("divergence-names").textContent).toBe(
      "1 rebuild started from a step in this sequence"
    );

    fireEvent.mouseEnter(screen.getByTestId("divergence-marker"));
    expect(screen.getByTestId("divergence-names").textContent).toBe("@sam rebuilt from here");

    fireEvent.mouseLeave(screen.getByTestId("divergence-marker"));
    expect(screen.getByTestId("divergence-names").textContent).toContain("1 rebuild started");
  });

  it("opens the rebuild on a click, and leaves the scrubber where it was", () => {
    const onOpenRebuild = vi.fn();
    renderReplay({ divergences: [rebuild()], onOpenRebuild });

    fireEvent.click(screen.getByTestId("divergence-marker"));

    expect(onOpenRebuild).toHaveBeenCalledWith(expect.objectContaining({ slug: "sams-rebuild" }));
    // The marker is not a tick: pressing it moves nobody's position.
    expect(screen.getByText(`step ${events[0].ordinal} of ${events[events.length - 1].ordinal}`))
      .toBeTruthy();
  });

  it("names both when two rebuilds left from the same step, and opens neither", () => {
    const onOpenRebuild = vi.fn();
    renderReplay({
      divergences: [
        rebuild(),
        rebuild({ id: "r2", slug: "ninas-rebuild", creator: { id: "u3", username: "nina", display_name: "Nina", avatar_url: null } }),
      ],
      onOpenRebuild,
    });

    const marker = screen.getByTestId("divergence-marker");
    expect(marker.getAttribute("data-divergence-count")).toBe("2");
    expect(marker.getAttribute("aria-label")).toBe("2 people rebuilt from here");

    fireEvent.click(marker);
    // Picking one of two for the reader would be picking wrong half the time.
    expect(onOpenRebuild).not.toHaveBeenCalled();

    const names = screen.getByTestId("divergence-names");
    expect(within(names).getByRole("button", { name: "@sam rebuilt from here" })).toBeTruthy();
    fireEvent.click(within(names).getByRole("button", { name: "@nina rebuilt from here" }));
    expect(onOpenRebuild).toHaveBeenCalledWith(expect.objectContaining({ slug: "ninas-rebuild" }));
  });
});

describe("producedAt", () => {
  it("inherits the last artefact when the position produced nothing itself", () => {
    expect(producedAt(events, 7, resolveNode)?.event.ordinal).toBe(6);
  });

  it("skips an event pointing at a node that is not in the placed tree", () => {
    const dangling = [
      { ...events[0], produced_node_id: "n-gone" },
      { ...events[1] },
    ] as BuildEvent[];
    expect(producedAt(dangling, 1, resolveNode)).toBeNull();
  });

  it("is null before anything has been produced", () => {
    expect(producedAt(events, 0, resolveNode)).toBeNull();
  });
});
