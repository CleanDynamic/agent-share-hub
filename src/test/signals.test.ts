// Acceptance cover for the trust signal computations (NS-P17).
//
// The two database acceptances — a second user's reproduction moving the
// header, and the creator's own attempt being refused by the policy — are
// assertions about Postgres and are proven by supabase/tests/ns-p17-
// reproductions.sql. What is covered here is everything that runs in the
// browser: the shape-relative rule table, the freshness sentence, and the two
// calls that read and write build_reproductions.
//
// The node registry fixture carries the real 26 keys and their real
// categories, because computeCompleteness classifies nodes THROUGH the
// registry — a fixture that invented categories would prove nothing.

import { beforeEach, describe, expect, it, vi } from "vitest";
// The file's own text, imported rather than read off disk, so the vocabulary
// check below runs through the same resolver as everything else here.
import signalsSource from "@/lib/build/signals.ts?raw";

interface Row extends Record<string, unknown> {
  id: string;
}

const state = vi.hoisted(() => ({
  rows: [] as Row[],
  upserts: [] as { row: Record<string, unknown>; onConflict?: string }[],
  reads: [] as { column: string; value: unknown; ascending?: boolean; limit?: number }[],
  userId: "reader-1" as string | null,
  error: null as { message: string } | null,
}));

vi.mock("@/integrations/supabase/client", () => {
  class Query implements PromiseLike<{ data: unknown; error: unknown }> {
    private staged: Record<string, unknown>[] = [];
    private op: "select" | "upsert" = "select";
    private filters: { column: string; value: unknown }[] = [];
    private ascending = true;
    private max = Infinity;
    private one = false;

    select() {
      return this;
    }
    upsert(row: Record<string, unknown>, options?: { onConflict?: string }) {
      this.op = "upsert";
      this.staged = [row];
      state.upserts.push({ row, onConflict: options?.onConflict });
      return this;
    }
    eq(column: string, value: unknown) {
      this.filters.push({ column, value });
      return this;
    }
    order(_column: string, options?: { ascending?: boolean }) {
      this.ascending = options?.ascending ?? true;
      return this;
    }
    limit(count: number) {
      this.max = count;
      return this;
    }
    single() {
      this.one = true;
      return this;
    }

    private run(): { data: unknown; error: unknown } {
      if (state.error) return { data: null, error: state.error };

      if (this.op === "upsert") {
        const row = { id: "repro-new", ...this.staged[0] } as Row;
        return { data: this.one ? row : [row], error: null };
      }

      const matched = state.rows
        .filter((row) => this.filters.every((f) => row[f.column] === f.value))
        .sort((a, b) => {
          const left = String(a.confirmed_at ?? "");
          const right = String(b.confirmed_at ?? "");
          return this.ascending ? left.localeCompare(right) : right.localeCompare(left);
        })
        .slice(0, this.max);

      state.reads.push({
        column: this.filters[0]?.column ?? "",
        value: this.filters[0]?.value,
        ascending: this.ascending,
        limit: this.max,
      });

      return { data: this.one ? (matched[0] ?? null) : matched, error: null };
    }

    then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
      onfulfilled?:
        | ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): PromiseLike<TResult1 | TResult2> {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected);
    }
  }

  return {
    supabase: {
      from: () => new Query(),
      auth: {
        getSession: async () => ({
          data: { session: state.userId ? { user: { id: state.userId } } : null },
          error: null,
        }),
      },
    },
  };
});

import {
  MINIMUM_PUBLISHABLE_SCORE,
  SHAPE_RULES,
  STALE_AFTER_DAYS,
  computeCompleteness,
  freshnessLabel,
  getReproductions,
  isStale,
  recordReproduction,
  type CompletenessSource,
} from "@/lib/build/signals";
import type { BuildShape, NodeTree, NodeType } from "@/lib/build/types";

// --- fixtures ----------------------------------------------------------------

/** The registry as NS-P02 seeds it: key -> category, all 26 rows. */
const REGISTRY_CATEGORIES: Record<string, string> = {
  prompt: "instruction",
  system_prompt: "instruction",
  model_params: "configuration",
  agent_config: "configuration",
  tool_definition: "configuration",
  integration: "configuration",
  stack: "configuration",
  dataset: "data",
  retrieval_config: "data",
  data_schema: "data",
  test_set: "data",
  code: "artefact",
  live_app: "artefact",
  repo: "artefact",
  generated_media: "artefact",
  document: "artefact",
  result: "evidence",
  comparison_table: "evidence",
  eval_run: "evidence",
  screenshot: "evidence",
  recording: "evidence",
  note: "narrative",
  decision: "narrative",
  breakage: "narrative",
  prerequisite: "narrative",
  gap: "narrative",
};

const NODE_TYPES = Object.entries(REGISTRY_CATEGORIES).map(
  ([key, category]) =>
    ({
      key,
      label: key,
      category,
      colour: "#000000",
      icon: null,
      schema: { fields: [] },
      renderer: category,
      copyable: false,
      is_active: true,
      sort: 0,
    }) as unknown as NodeType
);

const ALL_SHAPES: BuildShape[] = [
  "app",
  "agent",
  "workflow",
  "prompt",
  "dataset",
  "study",
  "media",
  "technique",
  "other",
];

let nodeSeq = 0;

function node(type: string, children: NodeTree[] = [], isGap = false): NodeTree {
  nodeSeq += 1;
  return {
    id: `node-${nodeSeq}`,
    build_id: "build-1",
    parent_id: null,
    position: 0,
    type,
    title: null,
    note: null,
    payload: {},
    source_ref: null,
    event_id: null,
    is_gap: isGap,
    created_at: "2026-08-01T00:00:00Z",
    children,
  } as unknown as NodeTree;
}

const EMPTY_BUILD: CompletenessSource = {
  shape: "other",
  outcome: null,
  made_for: [],
  made_with: [],
  cost_setup: null,
  cost_monthly: null,
  time_to_first_result: null,
  live_url: null,
  repo_url: null,
};

/** The seeded app build's header and placed tree, as ns-demo-build.sql has it. */
const SEEDED_APP: CompletenessSource = {
  shape: "app",
  outcome:
    "Sorts a full inbox into reply / delegate / archive and drafts the replies.",
  made_for: ["founder", "operations manager", "solo consultant"],
  made_with: ["Claude Opus 4.5", "Gmail API", "Supabase", "Vercel"],
  cost_setup: 0,
  cost_monthly: 18.4,
  time_to_first_result: 35,
  live_url: "https://inbox-triage.demo.neoscaleai.com",
  repo_url: "https://github.com/neoscale-demo/inbox-triage-agent",
};

const SEEDED_APP_TREE: NodeTree[] = [
  node("prompt", [node("system_prompt"), node("model_params")]),
  node("agent_config", [node("tool_definition")]),
  node("dataset", [node("retrieval_config")]),
  node("result", [node("eval_run")]),
  node("breakage"),
  node("gap"),
  node("live_app"),
  node("code"),
];

// --- acceptance 4 ------------------------------------------------------------

describe("computeCompleteness — the minimum publishable record", () => {
  // An outcome line, one instruction or artefact node, one evidence node.
  const MINIMUM_TREE = [node("prompt"), node("result")];

  it.each(ALL_SHAPES)(
    "clears the publishable mark on a %s with only those three",
    (shape) => {
      const { score, missing } = computeCompleteness(
        { ...EMPTY_BUILD, shape, outcome: "It does the thing." },
        MINIMUM_TREE,
        NODE_TYPES
      );

      expect(score).toBeGreaterThanOrEqual(MINIMUM_PUBLISHABLE_SCORE);
      expect(missing.map((item) => item.key)).not.toContain("outcome");
      expect(missing.map((item) => item.key)).not.toContain(
        "instruction_or_artefact"
      );
      expect(missing.map((item) => item.key)).not.toContain("evidence");
    }
  );

  it.each(ALL_SHAPES)(
    "reports all three as missing on an empty %s record",
    (shape) => {
      const { score, missing } = computeCompleteness(
        { ...EMPTY_BUILD, shape },
        [],
        NODE_TYPES
      );

      expect(score).toBeLessThan(MINIMUM_PUBLISHABLE_SCORE);
      expect(missing.map((item) => item.key)).toEqual(
        expect.arrayContaining(["outcome", "instruction_or_artefact", "evidence"])
      );
    }
  );

  it("asks a prompt for fewer things than an app", () => {
    expect(SHAPE_RULES.prompt.length).toBeLessThan(SHAPE_RULES.app.length);
  });

  it("weights every shape so the three core items alone clear the mark", () => {
    for (const shape of ALL_SHAPES) {
      const rules = SHAPE_RULES[shape];
      const total = rules.reduce((sum, rule) => sum + rule.weight, 0);
      const core = rules
        .filter((rule) =>
          ["outcome", "instruction_or_artefact", "evidence"].includes(rule.key)
        )
        .reduce((sum, rule) => sum + rule.weight, 0);

      expect(rules).toHaveLength(new Set(rules.map((r) => r.key)).size);
      expect(Math.round((core / total) * 100)).toBeGreaterThanOrEqual(
        MINIMUM_PUBLISHABLE_SCORE
      );
    }
  });
});

// --- acceptance 5 ------------------------------------------------------------

describe("computeCompleteness — the seeded app build", () => {
  it("lands under 100, missing only the prerequisites", () => {
    const { score, missing } = computeCompleteness(
      SEEDED_APP,
      SEEDED_APP_TREE,
      NODE_TYPES
    );

    expect(score).toBeLessThan(100);
    expect(score).toBeGreaterThanOrEqual(MINIMUM_PUBLISHABLE_SCORE);
    expect(missing.map((item) => item.key)).toEqual(["prerequisite"]);
  });

  it("phrases every missing item as an instruction", () => {
    // Take the whole rule table, not just the seeded build's gap: the copy is
    // what a creator reads, so all of it has to read the same way.
    const everything = ALL_SHAPES.flatMap(
      (shape) => computeCompleteness({ ...EMPTY_BUILD, shape }, [], NODE_TYPES).missing
    );

    expect(everything.length).toBeGreaterThan(0);
    for (const item of everything) {
      expect(item.copy).toMatch(/^(add|say|list) /);
      expect(item.copy).not.toMatch(
        /\b(missing|incomplete|poor|weak|bad|thin|lacks|should have|failed)\b/i
      );
    }
  });

  it("counts a cost of zero as a stated cost", () => {
    const stated = computeCompleteness(
      { ...EMPTY_BUILD, shape: "app", cost_setup: 0 },
      [],
      NODE_TYPES
    );
    const unstated = computeCompleteness(
      { ...EMPTY_BUILD, shape: "app" },
      [],
      NODE_TYPES
    );

    expect(stated.missing.map((i) => i.key)).not.toContain("cost");
    expect(unstated.missing.map((i) => i.key)).toContain("cost");
  });

  it("does not let a gap node stand in for the thing it admits is absent", () => {
    const withGap = computeCompleteness(
      { ...EMPTY_BUILD, shape: "other" },
      [node("prompt"), node("result", [], true)],
      NODE_TYPES
    );

    expect(withGap.missing.map((i) => i.key)).toContain("evidence");
  });

  it("reads nested nodes, not only the top level", () => {
    const nested = computeCompleteness(
      { ...EMPTY_BUILD, shape: "other" },
      [node("prompt", [node("screenshot")])],
      NODE_TYPES
    );

    expect(nested.missing.map((i) => i.key)).not.toContain("evidence");
  });

  it("asks a study for its comparison and a dataset for its data", () => {
    const study = computeCompleteness(
      { ...EMPTY_BUILD, shape: "study" },
      [node("prompt"), node("screenshot")],
      NODE_TYPES
    );
    const dataset = computeCompleteness(
      { ...EMPTY_BUILD, shape: "dataset" },
      [node("prompt"), node("screenshot")],
      NODE_TYPES
    );

    expect(study.missing.map((i) => i.key)).toContain("comparison");
    expect(dataset.missing.map((i) => i.key)).toContain("dataset");
    expect(SHAPE_RULES.prompt.map((r) => r.key)).not.toContain("comparison");
  });
});

// --- freshness ---------------------------------------------------------------

describe("freshnessLabel", () => {
  const now = Date.parse("2026-08-24T12:00:00Z");
  const daysAgo = (days: number) =>
    new Date(now - days * 86_400_000).toISOString();

  it("names the day and the model", () => {
    expect(
      freshnessLabel(
        {
          last_confirmed_at: daysAgo(3),
          last_confirmed_model: "claude-sonnet-4-5",
        },
        now
      )
    ).toBe("last confirmed working 3 days ago, on Sonnet 4.5");
  });

  it("drops the model half rather than inventing one", () => {
    expect(
      freshnessLabel(
        { last_confirmed_at: daysAgo(3), last_confirmed_model: null },
        now
      )
    ).toBe("last confirmed working 3 days ago");
    expect(
      freshnessLabel(
        { last_confirmed_at: daysAgo(3), last_confirmed_model: "   " },
        now
      )
    ).toBe("last confirmed working 3 days ago");
  });

  it("passes an unrecognised model identifier through untouched", () => {
    expect(
      freshnessLabel(
        { last_confirmed_at: daysAgo(1), last_confirmed_model: "gpt-5-mini" },
        now
      )
    ).toBe("last confirmed working yesterday, on gpt-5-mini");
  });

  it("returns null when nobody has confirmed it", () => {
    expect(
      freshnessLabel(
        { last_confirmed_at: null, last_confirmed_model: "claude-opus-4-5" },
        now
      )
    ).toBeNull();
  });

  it("scales the interval with distance", () => {
    const label = (days: number) =>
      freshnessLabel(
        { last_confirmed_at: daysAgo(days), last_confirmed_model: null },
        now
      );

    expect(label(0)).toBe("last confirmed working today");
    expect(label(21)).toBe("last confirmed working 3 weeks ago");
    expect(label(90)).toBe("last confirmed working 3 months ago");
    expect(label(400)).toBe("last confirmed working 1 year ago");
  });
});

describe("isStale", () => {
  const now = Date.parse("2026-08-24T12:00:00Z");
  const daysAgo = (days: number) =>
    new Date(now - days * 86_400_000).toISOString();

  it("turns on once the last confirmation passes the window", () => {
    expect(
      isStale({ last_confirmed_at: daysAgo(STALE_AFTER_DAYS), published_at: null }, now)
    ).toBe(false);
    expect(
      isStale(
        { last_confirmed_at: daysAgo(STALE_AFTER_DAYS + 1), published_at: null },
        now
      )
    ).toBe(true);
  });

  it("falls back to publication when nobody has confirmed it", () => {
    expect(
      isStale({ last_confirmed_at: null, published_at: daysAgo(200) }, now)
    ).toBe(true);
    expect(
      isStale({ last_confirmed_at: null, published_at: daysAgo(10) }, now)
    ).toBe(false);
  });

  it("never calls an unpublished build stale", () => {
    expect(isStale({ last_confirmed_at: null, published_at: null }, now)).toBe(
      false
    );
  });

  it("ignores publication once a confirmation exists", () => {
    expect(
      isStale({ last_confirmed_at: daysAgo(2), published_at: daysAgo(900) }, now)
    ).toBe(false);
  });
});

// --- the two calls -----------------------------------------------------------

describe("recordReproduction", () => {
  beforeEach(() => {
    state.rows = [];
    state.upserts = [];
    state.reads = [];
    state.userId = "reader-1";
    state.error = null;
  });

  it("writes as the signed-in person, once per build", async () => {
    await recordReproduction({ buildId: "build-1", modelUsed: "claude-opus-4-5" });

    expect(state.upserts).toHaveLength(1);
    expect(state.upserts[0].onConflict).toBe("build_id,user_id");
    expect(state.upserts[0].row).toMatchObject({
      build_id: "build-1",
      user_id: "reader-1",
      worked: true,
      model_used: "claude-opus-4-5",
      note: null,
    });
    expect(String(state.upserts[0].row.confirmed_at)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("records a failed attempt as readily as a working one", async () => {
    await recordReproduction({
      buildId: "build-1",
      worked: false,
      note: "  the Gmail scope was wrong  ",
    });

    expect(state.upserts[0].row).toMatchObject({
      worked: false,
      model_used: null,
      note: "the Gmail scope was wrong",
    });
  });

  it("refuses to write without a session", async () => {
    state.userId = null;
    await expect(recordReproduction({ buildId: "build-1" })).rejects.toThrow(
      /no signed-in user/
    );
    expect(state.upserts).toHaveLength(0);
  });
});

describe("getReproductions", () => {
  beforeEach(() => {
    state.rows = [
      { id: "r1", build_id: "build-1", confirmed_at: "2026-08-01T00:00:00Z" },
      { id: "r2", build_id: "build-1", confirmed_at: "2026-08-20T00:00:00Z" },
      { id: "r3", build_id: "build-2", confirmed_at: "2026-08-22T00:00:00Z" },
    ];
    state.reads = [];
    state.error = null;
  });

  it("returns one build's rows, most recent first", async () => {
    const rows = await getReproductions("build-1");
    expect(rows.map((row) => row.id)).toEqual(["r2", "r1"]);
    expect(state.reads[0]).toMatchObject({ ascending: false, limit: 20 });
  });

  it("caps a limit nobody should have asked for", async () => {
    await getReproductions("build-1", 10_000);
    expect(state.reads[0].limit).toBe(200);
  });

  it("names the operation when the read fails", async () => {
    state.error = { message: "connection reset" };
    await expect(getReproductions("build-1")).rejects.toThrow(
      /getReproductions failed: connection reset/
    );
  });
});

// --- acceptance 6 ------------------------------------------------------------

describe("the vocabulary of signals.ts", () => {
  it("emits no judgement anywhere in the file", () => {
    const source = signalsSource;

    expect(source).not.toMatch(/quality/i);
    expect(source).not.toMatch(/grade/i);
    expect(source).not.toMatch(/percentile/i);
    expect(source).not.toMatch(/rating/i);
    expect(source).not.toMatch(/score\s+out\s+of/i);
  });
});
