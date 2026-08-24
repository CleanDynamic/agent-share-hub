// Acceptance cover for forking from a moment (NS-P16, acceptance 4 and 6).
//
// This one runs against an in-memory stand-in for PostgREST rather than
// against a stubbed return value, because the thing worth testing is what
// forkBuild WRITES: which nodes it took, which events, what the ordinals came
// out as, and where the three lineage columns ended up pointing. A mock that
// only records calls would let a fork that writes the wrong parent_id pass.
//
// The fake enforces nothing the database enforces — no RLS, no foreign keys —
// so it proves the copy rules, not the constraints. The circular-FK ordering
// the real write depends on is asserted separately, as the order the three
// passes ran in.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Row extends Record<string, unknown> {
  id: string;
}

const state = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  writes: [] as { table: string; op: string; rows: Row[] }[],
  userId: "forker-1" as string | null,
}));

vi.mock("@/integrations/supabase/client", () => {
  type Predicate = (row: Row) => boolean;

  class Query implements PromiseLike<{ data: unknown; error: unknown }> {
    private op: "select" | "insert" | "upsert" | "update" | "delete" = "select";
    private staged: Row[] = [];
    private patch: Record<string, unknown> = {};
    private predicates: Predicate[] = [];
    private one: "single" | "maybeSingle" | null = null;

    constructor(private table: string) {}

    private get rows(): Row[] {
      return (state.tables[this.table] ??= []);
    }

    select() {
      return this;
    }
    insert(rows: Row | Row[]) {
      this.op = "insert";
      this.staged = Array.isArray(rows) ? rows : [rows];
      return this;
    }
    upsert(rows: Row | Row[]) {
      this.op = "upsert";
      this.staged = Array.isArray(rows) ? rows : [rows];
      return this;
    }
    update(patch: Record<string, unknown>) {
      this.op = "update";
      this.patch = patch;
      return this;
    }
    delete() {
      this.op = "delete";
      return this;
    }
    eq(column: string, value: unknown) {
      this.predicates.push((row) => row[column] === value);
      return this;
    }
    neq(column: string, value: unknown) {
      this.predicates.push((row) => row[column] !== value);
      return this;
    }
    is(column: string, value: unknown) {
      this.predicates.push((row) => row[column] === value);
      return this;
    }
    not(column: string, _operator: string, value: unknown) {
      this.predicates.push((row) => row[column] !== value);
      return this;
    }
    in(column: string, values: unknown[]) {
      this.predicates.push((row) => values.includes(row[column]));
      return this;
    }
    order() {
      return this;
    }
    limit() {
      return this;
    }
    range() {
      return this;
    }
    single() {
      this.one = "single";
      return this;
    }
    maybeSingle() {
      this.one = "maybeSingle";
      return this;
    }

    private matches(row: Row) {
      return this.predicates.every((predicate) => predicate(row));
    }

    private run(): { data: unknown; error: unknown } {
      let result: Row[] = [];

      if (this.op === "insert") {
        // Ids arrive from the caller here, as forkBuild mints them itself.
        const rows = this.staged.map((row) => ({
          ...row,
          id: (row.id as string) ?? `${this.table}-${this.rows.length + 1}`,
        }));
        this.rows.push(...rows);
        state.writes.push({ table: this.table, op: "insert", rows });
        result = rows;
      } else if (this.op === "upsert") {
        for (const row of this.staged) {
          const index = this.rows.findIndex((existing) => existing.id === row.id);
          if (index >= 0) this.rows[index] = { ...this.rows[index], ...row };
          else this.rows.push(row);
        }
        state.writes.push({ table: this.table, op: "upsert", rows: this.staged });
        result = this.staged;
      } else if (this.op === "update") {
        result = this.rows.filter((row) => this.matches(row));
        for (const row of result) Object.assign(row, this.patch);
        state.writes.push({ table: this.table, op: "update", rows: result });
      } else if (this.op === "delete") {
        result = this.rows.filter((row) => this.matches(row));
        state.tables[this.table] = this.rows.filter((row) => !this.matches(row));
        state.writes.push({ table: this.table, op: "delete", rows: result });
      } else {
        result = this.rows.filter((row) => this.matches(row));
      }

      if (this.one === "single") {
        return result.length === 1
          ? { data: result[0], error: null }
          : { data: null, error: { message: `expected one row, got ${result.length}` } };
      }
      if (this.one === "maybeSingle") {
        return { data: result[0] ?? null, error: null };
      }
      return { data: result, error: null };
    }

    then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
      resolve?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
      reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): PromiseLike<TResult1 | TResult2> {
      try {
        return Promise.resolve(this.run()).then(resolve, reject);
      } catch (error) {
        return Promise.reject(error).then(resolve, reject);
      }
    }
  }

  return {
    supabase: {
      from: (table: string) => new Query(table),
      auth: {
        getSession: async () => ({
          data: { session: state.userId ? { user: { id: state.userId } } : null },
          error: null,
        }),
      },
    },
  };
});

import { clearNodeTypeCache } from "@/lib/build/nodeTypes";
import { forkBuild, getForkOrigin, nodesToCopy, rewritePayload } from "@/lib/build/fork";
import type { BuildEvent, BuildNode, NodeType } from "@/lib/build";

// --- the fixture -------------------------------------------------------------
//
// The seeded build, reduced to the parts the copy rules turn on: a three-level
// tree, nodes linked to events at four different ordinals, a node linked to
// nothing, and payload references pointing both at a node that gets copied and
// at one that does not.

const SOURCE = "build-source";
const OWNER = "creator-1";

const nodeTypes = [
  {
    key: "agent_config", label: "Agent configuration", category: "configuration",
    colour: "#7C3AED", icon: "Bot", renderer: "agent_config", copyable: true,
    is_active: true, sort: 2,
    schema: {
      fields: [
        { key: "model", label: "Model", type: "string" },
        {
          key: "tools", label: "Tools", type: "list",
          of: [{ key: "tool_ref", label: "Tool", type: "string", format: "node_id" }],
        },
      ],
    },
  },
  {
    key: "system_prompt", label: "System prompt", category: "instruction",
    colour: "#E8571A", icon: "ScrollText", renderer: "instruction", copyable: true,
    is_active: true, sort: 2,
    schema: { fields: [{ key: "text", label: "Text", type: "text" }] },
  },
  {
    key: "prompt", label: "Prompt", category: "instruction", colour: "#E8571A",
    icon: "MessageSquare", renderer: "prompt", copyable: true, is_active: true, sort: 1,
    schema: {
      fields: [
        { key: "text", label: "Text", type: "text" },
        { key: "output_ref", label: "Output", type: "string", format: "node_id" },
      ],
    },
  },
  {
    key: "tool_definition", label: "Tool definition", category: "configuration",
    colour: "#22C55E", icon: "Wrench", renderer: "configuration", copyable: true,
    is_active: true, sort: 3,
    schema: { fields: [{ key: "name", label: "Name", type: "string" }] },
  },
  {
    key: "result", label: "Result", category: "evidence", colour: "#2EC4B6",
    icon: "BarChart3", renderer: "evidence", copyable: false, is_active: true, sort: 1,
    schema: { fields: [{ key: "summary", label: "Summary", type: "text" }] },
  },
] as unknown as NodeType[];

/** ordinals 1-9, one of them hidden, three of them producing a node. */
const events = [
  { id: "ev1", ordinal: 1, kind: "note", visibility: "kept", produced_node_id: null },
  { id: "ev2", ordinal: 2, kind: "prompt", visibility: "folded", produced_node_id: null },
  { id: "ev4", ordinal: 4, kind: "prompt", visibility: "kept", produced_node_id: "n-prompt" },
  { id: "ev6", ordinal: 6, kind: "breakage", visibility: "kept", produced_node_id: "n-tool" },
  { id: "ev7", ordinal: 7, kind: "note", visibility: "hidden", produced_node_id: null },
  { id: "ev9", ordinal: 9, kind: "milestone", visibility: "kept", produced_node_id: "n-result" },
].map((spec) => ({
  build_id: SOURCE,
  occurred_at: "2026-07-28T09:00:00Z",
  phase: 1,
  phase_title: "Reading the inbox",
  payload: { text: `event ${spec.ordinal}` },
  created_at: "2026-07-28T00:00:00Z",
  ...spec,
}));

const nodes = [
  // Level 1. Linked to nothing: it comes along at any ordinal only as an ancestor.
  { id: "n-agent", parent_id: null, position: 0, type: "agent_config", event_id: null,
    payload: { model: "claude-opus-4-5", tools: [{ tool_ref: "n-tool" }] } },
  // Level 2, under the agent, linked at ordinal 6.
  { id: "n-tool", parent_id: "n-agent", position: 0, type: "tool_definition", event_id: "ev6",
    payload: { name: "fetch_thread_context" } },
  // Level 2, under the agent, linked to nothing.
  { id: "n-system", parent_id: "n-agent", position: 1, type: "system_prompt", event_id: null,
    payload: { text: "You triage a professional inbox." } },
  // Level 3, under the system prompt, linked at ordinal 4, and pointing at a
  // node that is only copied above ordinal 9.
  { id: "n-prompt", parent_id: "n-system", position: 0, type: "prompt", event_id: "ev4",
    payload: { text: "Classify.", output_ref: "n-result" } },
  // Level 1, linked at ordinal 9.
  { id: "n-result", parent_id: null, position: 1, type: "result", event_id: "ev9",
    payload: { summary: "Ninety minutes down to four." } },
];

function seed({ rootBuildId = null }: { rootBuildId?: string | null } = {}) {
  state.tables = {
    builds: [
      {
        id: SOURCE, creator_id: OWNER, slug: "inbox-triage-agent-demo",
        title: "Inbox triage agent", outcome: "Sorts a full inbox.", shape: "app",
        status: "published", made_for: ["founder"], made_with: ["Claude Opus 4.5"],
        live_url: "https://inbox.test", repo_url: "https://github.test/repo",
        hero_node_id: "n-agent", cost_setup: 0, cost_monthly: 18.4, currency: "GBP",
        time_to_first_result: 35, completeness: 86, reproduction_count: 12,
        last_confirmed_at: "2026-08-14T09:12:00Z", parent_build_id: null,
        root_build_id: rootBuildId, forked_from_event_id: null,
        monetisation_type: "free", price_gbp: null, donation_enabled: false,
        created_at: "2026-07-28T08:40:00Z", updated_at: "2026-08-15T17:05:00Z",
        published_at: "2026-08-15T17:05:00Z",
      },
    ],
    build_nodes: nodes.map((node) => ({
      build_id: SOURCE, title: node.id, note: null, source_ref: null, is_gap: false,
      created_at: "2026-07-28T00:00:00Z", ...node,
    })) as Row[],
    // Copied, not referenced: inserts push into these arrays, and a fixture
    // shared by reference would carry one test's fork into the next.
    build_events: events.map((event) => ({ ...event })) as unknown as Row[],
    node_types: nodeTypes.map((type) => ({ ...type })) as unknown as Row[],
  };
  state.writes = [];
}

function forked() {
  return state.tables.builds.find((build) => build.id !== SOURCE) as Row;
}

function forkedNodes() {
  return state.tables.build_nodes.filter((node) => node.build_id === forked().id);
}

function forkedEvents() {
  return state.tables.build_events.filter((event) => event.build_id === forked().id);
}

beforeEach(() => {
  state.userId = "forker-1";
  clearNodeTypeCache();
  seed();
});

describe("forkBuild at an ordinal", () => {
  it("copies the events up to and including it, ordinals preserved", async () => {
    await forkBuild({ sourceBuildId: SOURCE, atEventOrdinal: 6 });

    // Six ordinals exist at or below 6 in the source; ordinals 3 and 5 were
    // never used, and the fork keeps the numbers rather than renumbering.
    expect(forkedEvents().map((event) => event.ordinal)).toEqual([1, 2, 4, 6]);
    expect(forkedEvents().map((event) => event.payload)).toEqual([
      { text: "event 1" }, { text: "event 2" }, { text: "event 4" }, { text: "event 6" },
    ]);
  });

  it("copies only the nodes linked at or below it, plus their ancestors", async () => {
    await forkBuild({ sourceBuildId: SOURCE, atEventOrdinal: 6 });

    const titles = forkedNodes().map((node) => node.title).sort();
    // n-tool (ordinal 6) and n-prompt (ordinal 4) are linked at or below.
    // n-agent and n-system come along as ancestors, linked to nothing at all.
    // n-result is linked at ordinal 9 and stays behind.
    expect(titles).toEqual(["n-agent", "n-prompt", "n-system", "n-tool"]);
  });

  it("sets the three lineage columns", async () => {
    const fork = await forkBuild({ sourceBuildId: SOURCE, atEventOrdinal: 6 });

    expect(fork.parent_build_id).toBe(SOURCE);
    expect(fork.root_build_id).toBe(SOURCE);
    // The SOURCE's event, not the copy: the moment being credited is a moment
    // in the source's sequence.
    expect(fork.forked_from_event_id).toBe("ev6");
    expect(fork.status).toBe("draft");
    expect(fork.creator_id).toBe("forker-1");
    expect(fork.slug).not.toBe("inbox-triage-agent-demo");
  });

  it("rewrites the tree onto new ids and keeps it connected", async () => {
    const fork = await forkBuild({ sourceBuildId: SOURCE, atEventOrdinal: 6 });
    const copied = forkedNodes();
    const byTitle = new Map(copied.map((node) => [node.title as string, node]));

    for (const node of copied) {
      expect(node.id).not.toBe(node.title);
      expect(node.build_id).toBe(fork.id);
    }
    expect(byTitle.get("n-agent")?.parent_id).toBeNull();
    expect(byTitle.get("n-tool")?.parent_id).toBe(byTitle.get("n-agent")?.id);
    expect(byTitle.get("n-system")?.parent_id).toBe(byTitle.get("n-agent")?.id);
    expect(byTitle.get("n-prompt")?.parent_id).toBe(byTitle.get("n-system")?.id);
    // Positions survive, so the tree comes out in the order it went in.
    expect(byTitle.get("n-tool")?.position).toBe(0);
    expect(byTitle.get("n-system")?.position).toBe(1);
  });

  it("repoints node references that came along and clears those that did not", async () => {
    await forkBuild({ sourceBuildId: SOURCE, atEventOrdinal: 6 });
    const byTitle = new Map(forkedNodes().map((node) => [node.title as string, node]));

    // A reference inside a list, declared node_id by the registry: n-tool came
    // along, so it points at the copy.
    const tools = (byTitle.get("n-agent")?.payload as { tools: { tool_ref: string }[] }).tools;
    expect(tools[0].tool_ref).toBe(byTitle.get("n-tool")?.id);

    // n-result was left behind, so the reference to it is cleared rather than
    // left dangling into someone else's build.
    const prompt = byTitle.get("n-prompt")?.payload as { output_ref: string | null; text: string };
    expect(prompt.output_ref).toBeNull();
    expect(prompt.text).toBe("Classify.");
  });

  it("relinks produced_node_id and event_id across the copy", async () => {
    await forkBuild({ sourceBuildId: SOURCE, atEventOrdinal: 6 });
    const byTitle = new Map(forkedNodes().map((node) => [node.title as string, node]));
    const byOrdinal = new Map(forkedEvents().map((event) => [event.ordinal as number, event]));

    expect(byOrdinal.get(4)?.produced_node_id).toBe(byTitle.get("n-prompt")?.id);
    expect(byOrdinal.get(6)?.produced_node_id).toBe(byTitle.get("n-tool")?.id);
    expect(byTitle.get("n-prompt")?.event_id).toBe(byOrdinal.get(4)?.id);
    expect(byTitle.get("n-tool")?.event_id).toBe(byOrdinal.get(6)?.id);
    // An ancestor that was never linked stays unlinked.
    expect(byTitle.get("n-agent")?.event_id).toBeNull();
  });

  it("writes the nodes before the events, because the keys point both ways", async () => {
    await forkBuild({ sourceBuildId: SOURCE, atEventOrdinal: 6 });

    const order = state.writes
      .filter((write) => write.table !== "builds")
      .map((write) => `${write.table}:${write.op}`);
    expect(order).toEqual([
      "build_nodes:insert",
      "build_events:insert",
      "build_nodes:upsert",
    ]);
  });

  it("moves the hero when its node came along", async () => {
    const fork = await forkBuild({ sourceBuildId: SOURCE, atEventOrdinal: 6 });
    const agent = forkedNodes().find((node) => node.title === "n-agent");
    expect(fork.hero_node_id).toBe(agent?.id);
  });

  it("leaves the source untouched", async () => {
    await forkBuild({ sourceBuildId: SOURCE, atEventOrdinal: 6 });

    const source = state.tables.builds.find((build) => build.id === SOURCE) as Row;
    expect(source.hero_node_id).toBe("n-agent");
    expect(state.tables.build_nodes.filter((node) => node.build_id === SOURCE)).toHaveLength(5);
    expect(state.tables.build_events.filter((event) => event.build_id === SOURCE)).toHaveLength(6);
  });
});

describe("forkBuild with no ordinal", () => {
  it("takes every placed node and the whole visible sequence", async () => {
    const fork = await forkBuild({ sourceBuildId: SOURCE });

    expect(forkedNodes()).toHaveLength(5);
    expect(forkedEvents().map((event) => event.ordinal)).toEqual([1, 2, 4, 6, 9]);
    expect(fork.forked_from_event_id).toBeNull();
    expect(fork.parent_build_id).toBe(SOURCE);
  });

  it("resolves every reference, because everything came along", async () => {
    await forkBuild({ sourceBuildId: SOURCE });
    const byTitle = new Map(forkedNodes().map((node) => [node.title as string, node]));
    const prompt = byTitle.get("n-prompt")?.payload as { output_ref: string };
    expect(prompt.output_ref).toBe(byTitle.get("n-result")?.id);
  });
});

describe("forkBuild and what it refuses to take", () => {
  it("never copies a hidden event from someone else's build", async () => {
    await forkBuild({ sourceBuildId: SOURCE });
    // ordinal 7 is hidden. getEvents excluded it in the query, so it is not
    // merely unrendered here — it was never read.
    expect(forkedEvents().map((event) => event.ordinal)).not.toContain(7);
  });

  it("keeps a hidden event when the forker owns the build already", async () => {
    state.userId = OWNER;
    await forkBuild({ sourceBuildId: SOURCE });
    expect(forkedEvents().map((event) => event.ordinal)).toContain(7);
  });

  it("never copies a tray node", async () => {
    state.tables.build_nodes.push({
      id: "n-tray", build_id: SOURCE, parent_id: null, position: null, type: "prompt",
      title: "n-tray", note: null, payload: {}, source_ref: null, event_id: "ev4",
      is_gap: false, created_at: "2026-07-28T00:00:00Z",
    });

    await forkBuild({ sourceBuildId: SOURCE });
    expect(forkedNodes().map((node) => node.title)).not.toContain("n-tray");
  });

  it("never copies media rows", async () => {
    state.tables.build_media = [{ id: "m1", build_id: SOURCE, path: "a/b.png" }];
    await forkBuild({ sourceBuildId: SOURCE });
    expect(state.tables.build_media).toHaveLength(1);
    expect(state.tables.build_media[0].build_id).toBe(SOURCE);
  });

  it("does not inherit the source's earned numbers or its deployment", async () => {
    const fork = await forkBuild({ sourceBuildId: SOURCE });

    expect(fork.reproduction_count).not.toBe(12);
    expect(fork.last_confirmed_at).toBeFalsy();
    expect(fork.live_url).toBeFalsy();
    expect(fork.repo_url).toBeFalsy();
    expect(fork.published_at).toBeFalsy();
    // What it does keep is the description of what the build is.
    expect(fork.title).toBe("Inbox triage agent");
    expect(fork.outcome).toBe("Sorts a full inbox.");
    expect(fork.made_with).toEqual(["Claude Opus 4.5"]);
  });
});

describe("forkBuild against a dense sequence", () => {
  // The fixture above has gaps in its ordinals on purpose, to prove the fork
  // preserves numbers rather than renumbering. The seeded build has none, and
  // acceptance 4 is stated against that: fork at 6, get six events.
  beforeEach(() => {
    seed();
    state.tables.build_events = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((ordinal) => ({
      id: `d${ordinal}`,
      build_id: SOURCE,
      ordinal,
      occurred_at: "2026-07-28T09:00:00Z",
      kind: "note",
      payload: { text: `event ${ordinal}` },
      phase: 1,
      phase_title: "Reading the inbox",
      visibility: "kept",
      produced_node_id: null,
      created_at: "2026-07-28T00:00:00Z",
    })) as Row[];
    // n-prompt at 4, n-tool at 6, n-result at 9, on the dense numbering.
    for (const node of state.tables.build_nodes) {
      if (node.id === "n-prompt") node.event_id = "d4";
      if (node.id === "n-tool") node.event_id = "d6";
      if (node.id === "n-result") node.event_id = "d9";
    }
  });

  it("forking at ordinal 6 gives six events, ordinals 1 to 6", async () => {
    const fork = await forkBuild({ sourceBuildId: SOURCE, atEventOrdinal: 6 });

    expect(forkedEvents()).toHaveLength(6);
    expect(forkedEvents().map((event) => event.ordinal)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(fork.forked_from_event_id).toBe("d6");
    expect(forkedNodes().map((node) => node.title).sort()).toEqual([
      "n-agent", "n-prompt", "n-system", "n-tool",
    ]);
  });
});

describe("forkBuild and the root of a line", () => {
  it("points a fork of a fork at the original, not the intermediate", async () => {
    // The source is itself a fork of "build-original".
    seed({ rootBuildId: "build-original" });

    const fork = await forkBuild({ sourceBuildId: SOURCE, atEventOrdinal: 4 });
    expect(fork.parent_build_id).toBe(SOURCE);
    expect(fork.root_build_id).toBe("build-original");
  });
});

describe("forkBuild failure handling", () => {
  it("refuses without a signed-in user", async () => {
    state.userId = null;
    await expect(forkBuild({ sourceBuildId: SOURCE })).rejects.toThrow(/no signed-in user/);
  });

  it("refuses on a build that is not there", async () => {
    await expect(forkBuild({ sourceBuildId: "nope" })).rejects.toThrow(/no build nope/);
  });
});

describe("getForkOrigin", () => {
  it("names the source and the step", async () => {
    const fork = await forkBuild({ sourceBuildId: SOURCE, atEventOrdinal: 6 });
    const origin = await getForkOrigin(fork);

    expect(origin?.build.title).toBe("Inbox triage agent");
    expect(origin?.build.slug).toBe("inbox-triage-agent-demo");
    expect(origin?.ordinal).toBe(6);
  });

  it("gives the source with no step for a whole-build fork", async () => {
    const fork = await forkBuild({ sourceBuildId: SOURCE });
    const origin = await getForkOrigin(fork);
    expect(origin?.build.id).toBe(SOURCE);
    expect(origin?.ordinal).toBeNull();
  });

  it("is null for a build that is not a fork", async () => {
    const origin = await getForkOrigin({ parent_build_id: null, forked_from_event_id: null });
    expect(origin).toBeNull();
  });

  it("is null when the source is no longer readable", async () => {
    const origin = await getForkOrigin({
      parent_build_id: "gone",
      forked_from_event_id: "ev6",
    });
    expect(origin).toBeNull();
  });
});

// --- the copy rules, without the write ---------------------------------------

describe("nodesToCopy", () => {
  const tree = nodes as unknown as BuildNode[];
  const sequence = events as unknown as BuildEvent[];

  it("takes everything when no ordinal is given", () => {
    expect(nodesToCopy(tree, sequence)).toHaveLength(5);
  });

  it("takes nothing below the first linked ordinal", () => {
    expect(nodesToCopy(tree, sequence, 3).map((node) => node.id)).toEqual([]);
  });

  it("pulls ancestors in even when they are linked to nothing", () => {
    expect(nodesToCopy(tree, sequence, 4).map((node) => node.id)).toEqual([
      "n-agent",
      "n-system",
      "n-prompt",
    ]);
  });

  it("returns nodes in their original order, parents before children", () => {
    const copied = nodesToCopy(tree, sequence, 9).map((node) => node.id);
    expect(copied.indexOf("n-agent")).toBeLessThan(copied.indexOf("n-tool"));
    expect(copied.indexOf("n-system")).toBeLessThan(copied.indexOf("n-prompt"));
  });

  it("survives a parent_id cycle rather than spinning on it", () => {
    const cyclic = [
      { id: "a", parent_id: "b", event_id: "ev4" },
      { id: "b", parent_id: "a", event_id: null },
    ] as unknown as BuildNode[];
    expect(nodesToCopy(cyclic, sequence, 4).map((node) => node.id)).toEqual(["a", "b"]);
  });
});

describe("rewritePayload", () => {
  const promptType = nodeTypes.find((type) => type.key === "prompt") as NodeType;
  const map = new Map([["old-node", "new-node"]]);

  it("leaves a payload alone when it holds no references", () => {
    expect(rewritePayload({ text: "Classify." }, promptType, map)).toEqual({ text: "Classify." });
  });

  it("clears a declared reference whose target was not copied", () => {
    expect(rewritePayload({ output_ref: "missing" }, promptType, map)).toEqual({
      output_ref: null,
    });
  });

  it("rewrites an undeclared reference but never clears one", () => {
    // No schema at all: a known id is still repointed, and an unknown string is
    // left exactly as it was rather than being guessed at.
    expect(rewritePayload({ a: "old-node", b: "something else" }, undefined, map)).toEqual({
      a: "new-node",
      b: "something else",
    });
  });

  it("handles a null payload without throwing", () => {
    expect(rewritePayload(null, promptType, map)).toEqual({});
  });
});
