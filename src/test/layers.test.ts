// Acceptance cover for the explanation-layer data layer.
//
// Two claims are worth more than the rest and are asserted first:
//
//   THE HASH MATCHES THE FUNCTION'S. Staleness is decided in the browser, from
//   a port of the edge function's own hash. If the two ever drift, every build
//   would look stale forever and the creator would be offered a regeneration
//   they do not need — so the port is checked against the real function source,
//   not against a copy of it.
//
//   UNAPPROVED TEXT IS FILTERED IN THE QUERY. The public page cannot be relied
//   on to remember a flag, so approved = true is asserted as part of the
//   request getApprovedLayers actually builds.
//
// The database is not reachable from a unit test, so the writes are asserted
// against a stub that records what PostgREST would have received.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  method: string;
  args: unknown[];
}

let calls: Recorded[] = [];
let response: { data: unknown; error: unknown } = { data: [], error: null };

/** The PostgREST builder shape: every method records itself and returns this. */
function builder() {
  const self: Record<string, unknown> = {};
  const chain =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return self;
    };

  for (const method of ["select", "eq", "update", "insert", "order", "limit"]) {
    self[method] = chain(method);
  }
  self.single = () => {
    calls.push({ method: "single", args: [] });
    return Promise.resolve(response);
  };
  self.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(response).then(resolve);
  return self;
}

const invoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return builder();
    },
    functions: { invoke: (name: string, options: unknown) => invoke(name, options) },
  },
}));

import {
  commitLayerReview,
  generateLayers,
  getApprovedLayers,
  getLayers,
  hashNodeTree,
  layerHashInput,
  layerReviewDeclined,
  recordLayerReviewDeclined,
  shouldOfferLayerReview,
  staleLayers,
  type BuildLayer,
} from "@/lib/build/layers";
import type { NodeTree } from "@/lib/build/types";

// The real function source, imported the way NS-P21's parity test imports
// parse-repo's: a copy of the algorithm here would assert nothing.
import { hashInput, hashNodeTree as serverHash } from "../../supabase/functions/generate-build-layers/hash.ts";
import { buildTree } from "../../supabase/functions/generate-build-layers/describe.ts";

const ROWS = [
  {
    id: "n-root",
    build_id: "b1",
    parent_id: null,
    position: 0,
    type: "prompt",
    title: "The system prompt",
    note: "Took four goes.",
    payload: { text: "You are a triage agent.", temperature: 0.2 },
    is_gap: false,
  },
  {
    id: "n-child",
    build_id: "b1",
    parent_id: "n-root",
    position: 0,
    type: "result",
    title: "What it produced",
    note: null,
    // Deliberately written in a different key order from the line above, so a
    // canonicalisation that is not really canonical shows up.
    payload: { summary: "Cleared the inbox.", tokens: 812 },
    is_gap: false,
  },
  {
    id: "n-tray",
    build_id: "b1",
    parent_id: null,
    position: null,
    type: "note",
    title: "Not placed yet",
    note: null,
    payload: {},
    is_gap: false,
  },
];

/** The same rows as the client holds them: nested, tray excluded. */
function clientTree(): NodeTree[] {
  const rows = ROWS.filter((row) => row.position !== null);
  const nest = (parentId: string | null): NodeTree[] =>
    rows
      .filter((row) => row.parent_id === parentId)
      .map((row) => ({ ...row, children: nest(row.id) }) as unknown as NodeTree);
  return nest(null);
}

function layerRow(overrides: Partial<BuildLayer> = {}): BuildLayer {
  return {
    id: "l-run",
    build_id: "b1",
    layer: "run",
    content: { steps: [{ n: 1, title: "Open it", body: "Do the thing.", node_ref: "n-root" }] },
    generated_at: "2026-08-20T10:00:00Z",
    generated_from_hash: "v1:abc",
    approved: false,
    approved_at: null,
    edited_by_creator: false,
    model_used: "claude",
    ...overrides,
  } as BuildLayer;
}

beforeEach(() => {
  calls = [];
  response = { data: [], error: null };
  invoke.mockReset();
  window.localStorage.clear();
});

function call(method: string): Recorded[] {
  return calls.filter((entry) => entry.method === method);
}

describe("the record hash", () => {
  it("is the same string the edge function hashes", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serverInput = hashInput(buildTree(ROWS as any));
    expect(layerHashInput(clientTree())).toBe(serverInput);
  });

  it("digests to the same value the edge function stores", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expected = await serverHash(buildTree(ROWS as any));
    expect(await hashNodeTree(clientTree())).toBe(expected);
    expect(await hashNodeTree(clientTree())).toMatch(/^v1:[0-9a-f]{64}$/);
  });

  it("moves when a note changes and not when the tray does", async () => {
    const before = await hashNodeTree(clientTree());

    const noted = clientTree();
    noted[0].note = "Took five goes.";
    expect(await hashNodeTree(noted)).not.toBe(before);

    // The tray is not in the tree at all, so nothing about it can move this.
    expect(await hashNodeTree(clientTree())).toBe(before);
  });
});

describe("reading layers", () => {
  it("filters unapproved rows in the query, for the reader", async () => {
    await getApprovedLayers("b1");

    expect(call("from")[0].args[0]).toBe("build_layers");
    const filters = call("eq").map((entry) => entry.args);
    expect(filters).toContainEqual(["build_id", "b1"]);
    expect(filters).toContainEqual(["approved", true]);
  });

  it("does not filter for the creator, who has to see what is unapproved", async () => {
    await getLayers("b1");

    const filters = call("eq").map((entry) => entry.args);
    expect(filters).toContainEqual(["build_id", "b1"]);
    expect(filters.some(([column]) => column === "approved")).toBe(false);
  });

  it("coerces a malformed step rather than rendering undefined at a reader", async () => {
    response = {
      data: [
        {
          ...layerRow(),
          content: { steps: [{ title: "Only a title" }, "nonsense", { n: 9, body: 7 }] },
        },
      ],
      error: null,
    };

    const [row] = await getApprovedLayers("b1");
    expect(row.content.steps).toEqual([
      { n: 1, title: "Only a title", body: "", node_ref: null },
      { n: 9, title: "", body: "", node_ref: null },
    ]);
  });

  it("drops a row whose layer is not one of the two", async () => {
    response = { data: [{ ...layerRow(), layer: "explain" }], error: null };
    expect(await getApprovedLayers("b1")).toEqual([]);
  });
});

describe("what the review pass writes", () => {
  it("sets edited_by_creator and approved on an edited layer", async () => {
    const row = layerRow();
    response = { data: { ...row, edited_by_creator: true, approved: true }, error: null };

    await commitLayerReview([
      {
        row,
        steps: [{ n: 1, title: "Open it", body: "My own words.", node_ref: "n-root" }],
        approve: true,
      },
    ]);

    const [patch] = call("update")[0].args as [Record<string, unknown>];
    expect(patch.edited_by_creator).toBe(true);
    expect(patch.approved).toBe(true);
    expect(patch.approved_at).toEqual(expect.any(String));
    expect(patch.content).toEqual({
      steps: [{ n: 1, title: "Open it", body: "My own words.", node_ref: "n-root" }],
    });
  });

  it("approves without touching the words when nothing was edited", async () => {
    const row = layerRow();
    response = { data: { ...row, approved: true }, error: null };

    await commitLayerReview([{ row, approve: true }]);

    const [patch] = call("update")[0].args as [Record<string, unknown>];
    expect(patch).toEqual({ approved: true, approved_at: expect.any(String) });
    expect(patch.content).toBeUndefined();
  });

  it("writes nothing at all for a declined layer, and does not delete it", async () => {
    const written = await commitLayerReview([{ row: layerRow(), approve: false }]);

    expect(written).toEqual([]);
    expect(call("update")).toHaveLength(0);
    expect(calls.some((entry) => entry.method === "delete")).toBe(false);
  });
});

describe("asking the generator", () => {
  it("sends force only when a creator asked for it", async () => {
    invoke.mockResolvedValue({
      data: { generated_from_hash: "v1:abc", layers: [], warnings: [] },
      error: null,
    });

    await generateLayers({ buildId: "b1" });
    expect((invoke.mock.calls[0][1] as { body: Record<string, unknown> }).body).toEqual({
      build_id: "b1",
    });

    await generateLayers({ buildId: "b1", layers: ["understand"], force: true });
    expect((invoke.mock.calls[1][1] as { body: Record<string, unknown> }).body).toEqual({
      build_id: "b1",
      layers: ["understand"],
      force: true,
    });
  });

  it("carries a protected row back as stale rather than as a failure", async () => {
    invoke.mockResolvedValue({
      data: {
        generated_from_hash: "v1:new",
        stale: true,
        layers: [
          {
            layer: "run",
            status: "stale",
            stale: true,
            protected_by: "approved",
            row: layerRow({ approved: true }),
          },
        ],
        warnings: [],
      },
      error: null,
    });

    const result = await generateLayers({ buildId: "b1" });
    expect(result.stale).toBe(true);
    expect(result.layers[0].protectedBy).toBe("approved");
    expect(result.layers[0].row?.content.steps[0].title).toBe("Open it");
  });
});

describe("whether the review pass is offered", () => {
  const tree = clientTree();
  const hash = "v1:abc";
  const base = { buildId: "b1", tree, hash };

  it("is not offered for a build with nothing placed", () => {
    expect(shouldOfferLayerReview({ ...base, tree: [], layers: [] })).toBe(false);
  });

  it("is offered when a build has no layers yet", () => {
    expect(shouldOfferLayerReview({ ...base, layers: [] })).toBe(true);
  });

  it("is offered when one of the two is unapproved", () => {
    const layers = [
      layerRow({ approved: true, generated_from_hash: hash }),
      layerRow({ id: "l-u", layer: "understand", generated_from_hash: hash }),
    ];
    expect(shouldOfferLayerReview({ ...base, layers })).toBe(true);
  });

  it("is not offered when both are approved against this exact record", () => {
    const layers = [
      layerRow({ approved: true, generated_from_hash: hash }),
      layerRow({ id: "l-u", layer: "understand", approved: true, generated_from_hash: hash }),
    ];
    expect(shouldOfferLayerReview({ ...base, layers })).toBe(false);
  });

  it("is offered again once the record has moved under an approved layer", () => {
    const layers = [
      layerRow({ approved: true, generated_from_hash: "v1:old" }),
      layerRow({ id: "l-u", layer: "understand", approved: true, generated_from_hash: "v1:old" }),
    ];
    expect(shouldOfferLayerReview({ ...base, layers })).toBe(true);
  });

  it("stops being offered once declined, until the record changes", () => {
    recordLayerReviewDeclined("b1", hash);
    expect(layerReviewDeclined("b1", hash)).toBe(true);
    expect(shouldOfferLayerReview({ ...base, layers: [] })).toBe(false);

    // A different record is a different question, and gets asked again.
    expect(shouldOfferLayerReview({ ...base, hash: "v1:moved", layers: [] })).toBe(true);
  });
});

describe("staleness", () => {
  it("says nothing rather than everything when the hash is unknown", () => {
    expect(staleLayers([layerRow()], null)).toEqual([]);
  });

  it("names the rows written from a record that has since moved", () => {
    const rows = [
      layerRow({ generated_from_hash: "v1:old" }),
      layerRow({ id: "l-u", layer: "understand", generated_from_hash: "v1:now" }),
    ];
    expect(staleLayers(rows, "v1:now").map((row) => row.layer)).toEqual(["run"]);
  });
});
