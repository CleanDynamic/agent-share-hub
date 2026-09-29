// A build's family of rebuilds, as a tree (RC-P14).
//
// buildTree is pure, so most of this file hands it rows and reads the tree
// back. getRebuildTree is checked against a stand-in for supabase-js that
// records a REQUEST when one would reach the network: an rpc call, or a
// PostgREST builder being awaited.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  table: string;
  method: string;
  args: unknown[];
}

let calls: Recorded[] = [];
let rpcAnswer: { data: unknown; error: unknown } = { data: [], error: null };
let profilesAnswer: { data: unknown; error: unknown } = { data: [], error: null };

function builder(table: string) {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "in", "limit"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ table, method, args });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown) => {
    calls.push({ table, method: "request", args: [] });
    return Promise.resolve(profilesAnswer).then(resolve);
  };
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => builder(table),
    rpc: (fn: string, params: unknown) => {
      calls.push({ table: `rpc:${fn}`, method: "request", args: [params] });
      return Promise.resolve(rpcAnswer);
    },
  },
}));

import {
  REBUILD_TREE_DEPTH_CAP,
  REBUILD_TREE_ROW_CAP,
  buildTree,
  flattenFamily,
  getRebuildTree,
  type RebuildTreeNode,
  type RebuildTreeRow,
} from "@/lib/build/lineage";

function row(id: string, parent: string | null, depth: number, over: Partial<RebuildTreeRow> = {}): RebuildTreeRow {
  return {
    id,
    parent_build_id: parent,
    depth,
    slug: `slug-${id}`,
    title: `Build ${id}`,
    creator_id: `maker-${id}`,
    published_at: "2026-09-01T10:00:00.000Z",
    reproduction_count: 0,
    rebuild_note: null,
    ...over,
  };
}

/** The tree as "id(depth)[children]", so a shape reads in one line. */
function shape(node: RebuildTreeNode | null): string {
  if (!node) return "null";
  const kids = node.children.map(shape).join(",");
  return `${node.id}(${node.depth})${kids ? `[${kids}]` : ""}`;
}

const requests = () => calls.filter((call) => call.method === "request");

beforeEach(() => {
  calls = [];
  rpcAnswer = { data: [], error: null };
  profilesAnswer = { data: [], error: null };
});

describe("buildTree", () => {
  it("is null for no rows", () => {
    expect(buildTree([])).toBeNull();
  });

  it("nests a chain, one generation under the next", () => {
    const tree = buildTree([row("r", null, 0), row("a", "r", 1), row("b", "a", 2), row("c", "b", 3)]);
    expect(shape(tree)).toBe("r(0)[a(1)[b(2)[c(3)]]]");
  });

  it("fans out, keeping siblings in the order they arrived", () => {
    const tree = buildTree([
      row("r", null, 0),
      row("a", "r", 1),
      row("b", "r", 1),
      row("c", "r", 1),
      row("a1", "a", 2),
      row("a2", "a", 2),
      row("c1", "c", 2),
    ]);
    expect(shape(tree)).toBe("r(0)[a(1)[a1(2),a2(2)],b(1),c(1)[c1(2)]]");
  });

  it("attaches an orphan whose parent is absent to the root", () => {
    const tree = buildTree([
      row("r", null, 0),
      row("a", "r", 1),
      row("lost", "not-in-the-rows", 2),
      row("lost-child", "lost", 3),
    ]);
    expect(shape(tree)).toBe("r(0)[a(1),lost(1)[lost-child(2)]]");
  });

  it("stops at the depth cap, and leaves out everything under a cut row", () => {
    expect(REBUILD_TREE_DEPTH_CAP).toBe(20);
    const chain = [row("n0", null, 0)];
    for (let depth = 1; depth <= 25; depth += 1) {
      chain.push(row(`n${depth}`, `n${depth - 1}`, depth));
    }

    const nodes = flattenFamily(buildTree(chain));
    expect(nodes).toHaveLength(21);
    expect(Math.max(...nodes.map((node) => node.depth))).toBe(20);
    expect(nodes.map((node) => node.id)).not.toContain("n21");
    expect(nodes.map((node) => node.id)).not.toContain("n25");
  });

  it("nests rows that arrive out of order, parents first", () => {
    const tree = buildTree([row("b", "a", 2), row("a", "r", 1), row("r", null, 0)]);
    expect(shape(tree)).toBe("r(0)[a(1)[b(2)]]");
  });

  it("places a row seen twice once", () => {
    const tree = buildTree([row("r", null, 0), row("a", "r", 1), row("a", "r", 1)]);
    expect(flattenFamily(tree).map((node) => node.id)).toEqual(["r", "a"]);
  });

  it("carries each row's own columns onto its node", () => {
    const tree = buildTree([
      row("r", null, 0, { reproduction_count: 5 }),
      row("a", "r", 1, { rebuild_note: "Swapped the model", reproduction_count: 2 }),
    ]);
    expect(tree?.reproduction_count).toBe(5);
    expect(tree?.children[0]).toMatchObject({
      slug: "slug-a",
      title: "Build a",
      rebuild_note: "Swapped the model",
      reproduction_count: 2,
      maker: null,
    });
  });
});

describe("getRebuildTree", () => {
  it("asks for the family and its makers in two requests", async () => {
    rpcAnswer = { data: [row("r", null, 0), row("a", "r", 1), row("b", "r", 1, { creator_id: "maker-r" })], error: null };
    profilesAnswer = {
      data: [
        { id: "maker-r", username: "root-maker", display_name: "Root Maker", avatar_url: null },
        { id: "maker-a", username: "a-maker", display_name: null, avatar_url: null },
      ],
      error: null,
    };

    const tree = await getRebuildTree("r");

    expect(requests().map((call) => call.table)).toEqual(["rpc:rebuild_tree", "profiles"]);
    expect(requests()[0].args[0]).toEqual({ root: "r", max_nodes: REBUILD_TREE_ROW_CAP });
    expect(REBUILD_TREE_ROW_CAP).toBe(200);

    const profileCalls = calls.filter((call) => call.table === "profiles");
    expect(profileCalls.find((call) => call.method === "select")?.args[0]).toBe(
      "id, username, display_name, avatar_url",
    );
    expect(profileCalls.find((call) => call.method === "in")?.args).toEqual([
      "id",
      ["maker-r", "maker-a"],
    ]);
    expect(profileCalls.find((call) => call.method === "limit")?.args).toEqual([2]);

    expect(shape(tree)).toBe("r(0)[a(1),b(1)]");
    expect(tree?.maker?.username).toBe("root-maker");
    expect(tree?.children[0].maker?.username).toBe("a-maker");
    expect(tree?.children[1].maker?.username).toBe("root-maker");
  });

  it("is null, after one request, when the root cannot be read", async () => {
    rpcAnswer = { data: [], error: null };

    await expect(getRebuildTree("draft-of-someone-else")).resolves.toBeNull();
    expect(requests().map((call) => call.table)).toEqual(["rpc:rebuild_tree"]);
  });

  it("leaves a maker it could not read unnamed, and the build in place", async () => {
    rpcAnswer = { data: [row("r", null, 0), row("a", "r", 1)], error: null };
    profilesAnswer = { data: [], error: null };

    const tree = await getRebuildTree("r");
    expect(shape(tree)).toBe("r(0)[a(1)]");
    expect(tree?.children[0].maker).toBeNull();
  });

  it("names itself when the family is refused", async () => {
    rpcAnswer = { data: null, error: { code: "42501", message: "permission denied for function rebuild_tree" } };
    await expect(getRebuildTree("r")).rejects.toThrow(/^getRebuildTree failed/);
  });

  it("names itself when the makers are refused", async () => {
    rpcAnswer = { data: [row("r", null, 0)], error: null };
    profilesAnswer = { data: null, error: { code: "PGRST301", message: "JWT expired" } };
    await expect(getRebuildTree("r")).rejects.toThrow(/^getRebuildTree failed/);
  });
});
