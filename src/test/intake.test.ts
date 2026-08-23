// Acceptance cover for transcript intake (NS-P14).
//
// The Supabase client is replaced with a stub that records what was written, so
// these assertions are about what src/lib/build/intake.ts actually does: the
// order it writes in, what it puts on each row, what it leaves alone, and what
// a second submission of the same proposal does — which is the one behaviour
// that cannot be checked by looking at a single run.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Row {
  id: string;
  [key: string]: unknown;
}

const state = vi.hoisted(() => ({
  events: [] as Row[],
  nodes: [] as Row[],
  builds: [] as Row[],
  eventInserts: [] as Record<string, unknown>[][],
  nodeInserts: [] as Record<string, unknown>[][],
  buildUpdates: [] as Record<string, unknown>[],
  eventInsertError: null as { message: string } | null,
  nodeInsertError: null as { message: string } | null,
  invoke: null as { data: unknown; error: unknown } | null,
  invokeCalls: [] as { name: string; body: unknown }[],
  seq: 0,
}));

vi.mock("@/integrations/supabase/client", () => {
  const nextId = (prefix: string) => `${prefix}-${++state.seq}`;

  const tableRows = (table: string): Row[] =>
    table === "build_events" ? state.events : table === "build_nodes" ? state.nodes : state.builds;

  const from = (table: string) => {
    let op: "select" | "insert" | "update" = "select";
    let written: unknown = null;
    const filters: [string, unknown][] = [];

    const run = () => {
      const matches = () =>
        tableRows(table).filter((row) => filters.every(([col, val]) => row[col] === val));

      if (op === "insert") {
        const rows = (Array.isArray(written) ? written : [written]) as Record<string, unknown>[];
        if (table === "build_events" && state.eventInsertError) {
          return { data: null, error: state.eventInsertError };
        }
        if (table === "build_nodes" && state.nodeInsertError) {
          return { data: null, error: state.nodeInsertError };
        }
        const created = rows.map((row) => ({ ...row, id: nextId(table) }) as Row);
        tableRows(table).push(...created);
        if (table === "build_events") state.eventInserts.push(rows);
        if (table === "build_nodes") state.nodeInserts.push(rows);
        return { data: created, error: null };
      }

      if (op === "update") {
        const patch = written as Record<string, unknown>;
        state.buildUpdates.push(patch);
        const hit = matches();
        for (const row of hit) Object.assign(row, patch);
        return { data: hit[0] ?? null, error: null };
      }

      return { data: matches(), error: null };
    };

    const builder = {
      select: () => builder,
      insert: (rows: unknown) => {
        op = "insert";
        written = rows;
        return builder;
      },
      update: (patch: unknown) => {
        op = "update";
        written = patch;
        return builder;
      },
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      },
      single: () => ({
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
          const out = run();
          const data = Array.isArray(out.data) ? out.data[0] ?? null : out.data;
          return Promise.resolve({ ...out, data }).then(resolve, reject);
        },
      }),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(resolve, reject),
    };

    return builder;
  };

  return {
    supabase: {
      from,
      functions: {
        invoke: async (name: string, options: { body: unknown }) => {
          state.invokeCalls.push({ name, body: options.body });
          return state.invoke ?? { data: null, error: null };
        },
      },
    },
  };
});

const { materialiseProposal, requestProposal } = await import("@/lib/build/intake");
import type { TranscriptProposal } from "@/lib/build/intake";

const BUILD_ID = "11111111-1111-4111-8111-111111111111";
const SESSION = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

/**
 * A transcript of `exchanges` user turns. Turns run 1..N across both speakers,
 * so the user opens on 1, 3, 5 … and each event's source_ref.index is that odd
 * turn, exactly as the parser numbers them.
 */
function proposalOf(exchanges: number, nodes: TranscriptProposal["nodes"] = []): TranscriptProposal {
  return {
    events: Array.from({ length: exchanges }, (_, i) => ({
      ordinal: i + 1,
      kind: "prompt",
      visibility: "folded",
      occurred_at: null,
      payload: { text: `turn ${i * 2 + 1}`, response_summary: `reply ${i * 2 + 2}` },
      source_ref: { source: "transcript", session_id: SESSION, index: i * 2 + 1 },
      inferred: false,
      inferred_reason: null,
    })),
    nodes,
    summary: {
      session_id: SESSION,
      source_hint: null,
      detected_format: "labelled_colon",
      detected_labels: { user: ["You"], assistant: ["ChatGPT"] },
      turn_count: exchanges * 2,
      user_turn_count: exchanges,
      assistant_turn_count: exchanges,
      event_count: exchanges,
      node_count: nodes.length,
      character_count: 100,
      line_count: 10,
      proposed_title: {
        value: "Photo renamer",
        source_ref: { source: "transcript", session_id: SESSION, index: 1 },
        inferred: true,
        inferred_reason: "Taken from the opening line of the first prompt.",
      },
      proposed_outcome: {
        value: "Renames photos by exif date",
        source_ref: { source: "transcript", session_id: SESSION, index: 1 },
        inferred: true,
        inferred_reason: "Read from the closing turn.",
      },
    },
    warnings: [],
  };
}

function codeNode(localId: string, turn: number): TranscriptProposal["nodes"][number] {
  return {
    local_id: localId,
    type: "code",
    title: `${localId}.ts`,
    note: null,
    payload: { language: "ts", source: "const x = 1" },
    source_ref: { source: "transcript", session_id: SESSION, index: turn },
    inferred: false,
    inferred_reason: null,
  };
}

function keepEverything(proposal: TranscriptProposal) {
  return {
    eventOrdinals: proposal.events.map((e) => e.ordinal),
    nodeLocalIds: proposal.nodes.map((n) => n.local_id),
    title: true,
    outcome: true,
  };
}

beforeEach(() => {
  state.events = [];
  state.nodes = [];
  state.builds = [{ id: BUILD_ID, title: "Untitled build", outcome: null }];
  state.eventInserts = [];
  state.nodeInserts = [];
  state.buildUpdates = [];
  state.eventInsertError = null;
  state.nodeInsertError = null;
  state.invoke = null;
  state.invokeCalls = [];
  state.seq = 0;
});

describe("materialiseProposal", () => {
  it("writes one event per user turn and puts every node in the tray", async () => {
    // Acceptance 1: a 20-turn transcript produces 20 events and its nodes in
    // the tray, all with position null.
    const proposal = proposalOf(20, [codeNode("node-1", 4), codeNode("node-2", 12)]);

    const counts = await materialiseProposal(BUILD_ID, proposal, keepEverything(proposal));

    expect(counts.events).toBe(20);
    expect(counts.nodes).toBe(2);
    expect(state.events).toHaveLength(20);
    expect(state.nodes).toHaveLength(2);
    expect(state.nodes.every((node) => node.position === null)).toBe(true);
  });

  it("writes events before nodes, each in one batched statement", async () => {
    const proposal = proposalOf(3, [codeNode("node-1", 2)]);
    await materialiseProposal(BUILD_ID, proposal, keepEverything(proposal));

    // One insert call per table, not one per row.
    expect(state.eventInserts).toHaveLength(1);
    expect(state.nodeInserts).toHaveLength(1);
    expect(state.eventInserts[0]).toHaveLength(3);
    expect(state.nodeInserts[0]).toHaveLength(1);
  });

  it("numbers event ordinals densely from 1 on a fresh build", async () => {
    const proposal = proposalOf(4);
    await materialiseProposal(BUILD_ID, proposal, keepEverything(proposal));

    expect(state.events.map((e) => e.ordinal)).toEqual([1, 2, 3, 4]);
  });

  it("gives every materialised node a source_ref naming its turn", async () => {
    // Acceptance 2.
    const proposal = proposalOf(6, [codeNode("node-1", 4), codeNode("node-2", 8)]);
    await materialiseProposal(BUILD_ID, proposal, keepEverything(proposal));

    expect(state.nodes.map((n) => n.source_ref)).toEqual([
      { source: "transcript", session_id: SESSION, index: 4, local_id: "node-1" },
      { source: "transcript", session_id: SESSION, index: 8, local_id: "node-2" },
    ]);
  });

  it("folds the event's source_ref into payload, which has no column for it", async () => {
    const proposal = proposalOf(2);
    await materialiseProposal(BUILD_ID, proposal, keepEverything(proposal));

    expect(state.events[0].payload).toEqual({
      text: "turn 1",
      response_summary: "reply 2",
      source_ref: { source: "transcript", session_id: SESSION, index: 1 },
    });
  });

  it("links a node to the event whose exchange it came out of", async () => {
    // Turn 4 is the assistant's reply inside the exchange the user opened on
    // turn 3, so the covering event is the second one.
    const proposal = proposalOf(3, [codeNode("node-1", 4)]);
    await materialiseProposal(BUILD_ID, proposal, keepEverything(proposal));

    const second = state.events.find((e) => e.ordinal === 2);
    expect(state.nodes[0].event_id).toBe(second?.id);
  });

  it("leaves event_id null when the covering event was discarded", async () => {
    const proposal = proposalOf(3, [codeNode("node-1", 4)]);
    await materialiseProposal(BUILD_ID, proposal, {
      eventOrdinals: [],
      nodeLocalIds: ["node-1"],
      title: false,
      outcome: false,
    });

    expect(state.events).toHaveLength(0);
    expect(state.nodes[0].event_id).toBeNull();
  });

  it("applies a kept title and outcome to the build", async () => {
    const proposal = proposalOf(2);
    const counts = await materialiseProposal(BUILD_ID, proposal, keepEverything(proposal));

    expect(counts.titleApplied).toBe(true);
    expect(state.buildUpdates).toEqual([
      { title: "Photo renamer", outcome: "Renames photos by exif date" },
    ]);
  });

  it("leaves the build Untitled when the title is discarded", async () => {
    // Acceptance 3.
    const proposal = proposalOf(2);
    const counts = await materialiseProposal(BUILD_ID, proposal, {
      eventOrdinals: proposal.events.map((e) => e.ordinal),
      nodeLocalIds: [],
      title: false,
      outcome: false,
    });

    expect(counts.titleApplied).toBe(false);
    expect(state.buildUpdates).toEqual([]);
    expect(state.builds[0].title).toBe("Untitled build");
  });

  it("does not double the rows when the same proposal is submitted twice", async () => {
    // Acceptance 4.
    const proposal = proposalOf(20, [codeNode("node-1", 4), codeNode("node-2", 12)]);
    const selections = keepEverything(proposal);

    const first = await materialiseProposal(BUILD_ID, proposal, selections);
    const second = await materialiseProposal(BUILD_ID, proposal, selections);

    expect(first.alreadyMaterialised).toBe(false);
    expect(second.alreadyMaterialised).toBe(true);
    expect(second.events).toBe(0);
    expect(second.nodes).toBe(0);
    expect(state.events).toHaveLength(20);
    expect(state.nodes).toHaveLength(2);
    // The header was settled on the first pass and may have been edited since.
    expect(state.buildUpdates).toHaveLength(1);
  });

  it("finishes a run that failed after the events were written", async () => {
    const proposal = proposalOf(3, [codeNode("node-1", 4)]);
    const selections = keepEverything(proposal);

    state.nodeInsertError = { message: "connection reset" };
    await expect(materialiseProposal(BUILD_ID, proposal, selections)).rejects.toThrow(
      /connection reset/
    );
    expect(state.events).toHaveLength(3);
    expect(state.nodes).toHaveLength(0);

    state.nodeInsertError = null;
    const retry = await materialiseProposal(BUILD_ID, proposal, selections);

    // The events were already there, so only the missing node is written.
    expect(retry.events).toBe(0);
    expect(retry.nodes).toBe(1);
    expect(state.events).toHaveLength(3);
    expect(state.nodes).toHaveLength(1);
  });

  it("continues the ordinal sequence when the build already holds events", async () => {
    // A long transcript is split and accepted into the same build in parts.
    state.events = [
      { id: "prior-1", build_id: BUILD_ID, ordinal: 1, payload: {} },
      { id: "prior-2", build_id: BUILD_ID, ordinal: 2, payload: {} },
    ];

    const proposal = proposalOf(3);
    await materialiseProposal(BUILD_ID, proposal, keepEverything(proposal));

    const written = state.events.filter((e) => e.id.startsWith("build_events"));
    expect(written.map((e) => e.ordinal)).toEqual([3, 4, 5]);
  });

  it("writes only the events and nodes the creator kept", async () => {
    const proposal = proposalOf(4, [codeNode("node-1", 2), codeNode("node-2", 6)]);

    const counts = await materialiseProposal(BUILD_ID, proposal, {
      eventOrdinals: [2, 4],
      nodeLocalIds: ["node-2"],
      title: false,
      outcome: true,
    });

    expect(counts.events).toBe(2);
    expect(counts.nodes).toBe(1);
    expect(state.nodes[0].title).toBe("node-2.ts");
    expect(state.buildUpdates).toEqual([{ outcome: "Renames photos by exif date" }]);
  });

  it("refuses a proposal that carries no id", async () => {
    const proposal = proposalOf(1);
    proposal.summary.session_id = "";

    await expect(
      materialiseProposal(BUILD_ID, proposal, keepEverything(proposal))
    ).rejects.toThrow(/carries no id/);
  });
});

describe("requestProposal", () => {
  it("sends raw_text and build_id to the function", async () => {
    state.invoke = { data: proposalOf(1), error: null };
    await requestProposal(BUILD_ID, "You: hi", "chatgpt");

    expect(state.invokeCalls[0]).toEqual({
      name: "parse-transcript",
      body: { raw_text: "You: hi", build_id: BUILD_ID, source_hint: "chatgpt" },
    });
  });

  it("surfaces the function's own message rather than the generic non-2xx one", async () => {
    // The function distinguishes 401 from 403 from 413 deliberately; supabase-js
    // collapses all of them to one string unless the body is read.
    state.invoke = {
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: {
          json: async () => ({ error: "raw_text is 500,000 characters, over the limit." }),
        },
      },
    };

    await expect(requestProposal(BUILD_ID, "x")).rejects.toThrow(/over the limit/);
  });

  it("rejects a response it does not understand", async () => {
    state.invoke = { data: { nonsense: true }, error: null };
    await expect(requestProposal(BUILD_ID, "x")).rejects.toThrow(/does not understand/);
  });
});
