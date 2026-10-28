// SV-17 P2: saved items, the data layer.
//
// The claims: a step is stored as forkRules copies it (no build_cost, run_cost, trace_url); a session is stored as prompt text,
// model and source only; a draft's content can't be saved; saving twice is not an error; the list is one request per page
// and never reads another reader's rows; a failure names ids and never the server's words.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  table: string;
  method: string;
  args: unknown[];
  builder: number;
}
type Answer = { data: unknown; error: unknown; status?: number };

let calls: Recorded[] = [];
let builders = 0;
let answer: (table: string, own: Recorded[]) => Answer = () => ({ data: [], error: null, status: 200 });
let session: { user: { id: string } } | null = { user: { id: "reader-1" } };
let header: Record<string, unknown> | null = null;
let tree: unknown[] = [];
let bounty: Record<string, unknown> | null = null;

function builder(table: string) {
  const id = (builders += 1);
  const mine = () => calls.filter((call) => call.builder === id);
  const self: Record<string, unknown> = {};
  for (const method of ["select", "insert", "update", "delete", "eq", "in", "order", "limit", "range", "single", "maybeSingle"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ table, method, args, builder: id });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
    calls.push({ table, method: "request", args: [], builder: id });
    return Promise.resolve(answer(table, mine())).then(resolve, reject);
  };
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => builder(table),
    rpc: vi.fn(async (name: string) => {
      calls.push({ table: "rpc", method: name, args: [], builder: 0 });
      return answer(`rpc:${name}`, []);
    }),
    auth: { getSession: vi.fn(async () => ({ data: { session } })) },
  },
}));
vi.mock("@/lib/build/builds", () => ({ getBuildHeader: vi.fn(async () => header) }));
vi.mock("@/lib/build/nodes", () => ({ getNodeTree: vi.fn(async () => tree), readNodeRows: vi.fn(async (ids: string[]) => (tree as { id: string }[]).filter((node) => ids.includes(node.id))) }));

import { SocialError } from "@/lib/social/types";
import {
  collectionSavedBy,
  countSavedItems,
  listSavedItems,
  saveItem,
  savedItemsUsedIn,
  sessionSnapshot,
  stepSnapshot,
  unsaveItem,
  updateSavedItemNote,
} from "./savedItems";

const node = (over: Record<string, unknown>) => ({ id: "n1", build_id: "b1", parent_id: null, position: 1, type: "agent", title: "Triage", note: null, payload: {}, source_ref: null, contributor_id: null, children: [], ...over });
const published = { id: "b1", creator_id: "maker-1", status: "published", title: "Support bot", making: {} };

const inserts = () => calls.filter((call) => call.table === "saved_items" && call.method === "insert");

beforeEach(() => {
  calls = [];
  builders = 0;
  session = { user: { id: "reader-1" } };
  header = published;
  tree = [];
  bounty = null;
  answer = (table) => (table === "bounties" ? { data: bounty, error: null, status: 200 } : { data: [], error: null, status: 200 });
});

describe("the snapshots", () => {
  it("stores a step as forkRules copies it: no run cost, build cost or trace url", () => {
    const snap = stepSnapshot(
      node({ payload: { instructions: "Sort tickets", build_cost: 4, run_cost: 2, trace_url: "https://t/1", helpers: [{ name: "lookup", did: "ran 12 times" }] } }) as never,
      published as never,
    );
    expect(snap.payload).toEqual({ instructions: "Sort tickets", helpers: [{ name: "lookup" }] });
    expect(JSON.stringify(snap)).not.toMatch(/build_cost|run_cost|trace_url|ran 12 times/);
  });

  it("stores a session as prompt text, model and source only", () => {
    const rows = [
      node({ id: "p1", type: "prompt", payload: { text: "Add a login page", model: "Claude Opus", reply: "I added it", session: "s1" }, source_ref: { source: "claude_code", session_id: "x", index: 1, import_session_id: "s1" } }),
      node({ id: "p2", type: "prompt", payload: { text: "Make it blue", model: "Claude Opus" }, source_ref: { source: "claude_code", session_id: "x", index: 2, import_session_id: "s1" } }),
      node({ id: "p3", type: "prompt", payload: { text: "Another session" }, source_ref: { import_session_id: "s2" } }),
    ];
    const snap = sessionSnapshot(rows as never, "s1", { ...published, making: { sessions_meta: { s1: { tool: "claude-code", date: "2026-10-20" } } } } as never);
    expect(snap.prompts).toEqual([{ text: "Add a login page" }, { text: "Make it blue" }]);
    expect(snap.model).toBe("Claude Opus");
    expect(snap.source).toMatchObject({ buildId: "b1", tool: "claude-code" });
    expect(JSON.stringify(snap)).not.toContain("I added it");
  });
});

describe("saveItem", () => {
  it("saves a step with its snapshot, as the reader, in one write", async () => {
    tree = [node({ payload: { instructions: "Sort", run_cost: 9 } })];
    await saveItem({ kind: "step", buildId: "b1", ref: "n1" });
    expect(inserts()).toHaveLength(1);
    const row = inserts()[0].args[0] as Record<string, unknown>;
    expect(row).toMatchObject({ user_id: "reader-1", kind: "step", build_id: "b1", ref: "n1" });
    expect(JSON.stringify(row.snapshot)).not.toContain("run_cost");
  });

  it("stores the source's version with a saved step, so a later edit can read as Edited (SV-19)", async () => {
    tree = [node({ payload: { instructions: "Sort" } })];
    answer = (table) => (table === "build_nodes" ? { data: [{ id: "n1", build_id: "b1", parent_id: null, type: "agent", updated_at: "2026-10-12T09:00:00+00:00", session: null, import_session: null }], error: null, status: 200 } : { data: [], error: null, status: 200 });
    await saveItem({ kind: "step", buildId: "b1", ref: "n1" });
    expect(inserts()[0].args[0]).toMatchObject({ source_version: "2026-10-12T09:00:00+00:00" });
  });

  it("still saves, with no version, when the versions can't be read (the column is not there yet)", async () => {
    tree = [node({ payload: { instructions: "Sort" } })];
    answer = (table) => (table === "build_nodes" ? { data: null, error: { code: "42703", message: "column build_nodes.updated_at does not exist" }, status: 400 } : { data: [], error: null, status: 200 });
    await saveItem({ kind: "step", buildId: "b1", ref: "n1" });
    expect(inserts()[0].args[0]).toMatchObject({ source_version: null });
  });

  it("refuses a draft's content before any write", async () => {
    header = { ...published, status: "draft" };
    tree = [node({})];
    await expect(saveItem({ kind: "step", buildId: "b1", ref: "n1" })).rejects.toBeInstanceOf(SocialError);
    expect(inserts()).toHaveLength(0);
  });

  it("saving twice is not an error", async () => {
    tree = [node({})];
    answer = (table) => (table === "saved_items" ? { data: null, error: { code: "23505", message: "Failing row contains (secret prompt)" }, status: 409 } : { data: [], error: null });
    await expect(saveItem({ kind: "step", buildId: "b1", ref: "n1" })).resolves.toBeUndefined();
  });

  it("refuses when signed out, and a step that isn't in the build", async () => {
    session = null;
    await expect(saveItem({ kind: "step", buildId: "b1", ref: "n1" })).rejects.toBeInstanceOf(SocialError);
    session = { user: { id: "reader-1" } };
    tree = [node({ id: "other" })];
    await expect(saveItem({ kind: "step", buildId: "b1", ref: "n1" })).rejects.toBeInstanceOf(SocialError);
    expect(inserts()).toHaveLength(0);
  });

  it("saves a filter set and a collection as given, with no build", async () => {
    await saveItem({ kind: "filter_set", ref: "fs-1", snapshot: { name: "Stale agents", query: "shape=agent&stale=1" } });
    await saveItem({ kind: "collection", ref: "c1", snapshot: { name: "Support" } });
    expect(inserts().map((call) => (call.args[0] as { kind: string }).kind)).toEqual(["filter_set", "collection"]);
    expect((inserts()[0].args[0] as { build_id: unknown }).build_id).toBeNull();
  });

  it("never carries a server message in its error", async () => {
    tree = [node({})];
    answer = (table) => (table === "saved_items" ? { data: null, error: { code: "42501", message: "Failing row contains (private prompt text)" }, status: 403 } : { data: [], error: null });
    const error = await saveItem({ kind: "step", buildId: "b1", ref: "n1" }).catch((e: unknown) => e as Error);
    expect(error).toBeInstanceOf(SocialError);
    expect((error as Error).message).not.toContain("private prompt text");
  });
});

describe("unsaveItem and the note", () => {
  it("removes the reader's own row only, and removing one that isn't there is not an error", async () => {
    await unsaveItem("si-1");
    const del = calls.filter((call) => call.table === "saved_items" && call.method === "eq").map((call) => call.args);
    expect(del).toContainEqual(["id", "si-1"]);
    expect(del).toContainEqual(["user_id", "reader-1"]);
  });

  it("saves a note, trimmed, and refuses one over 2000 characters before any request", async () => {
    await updateSavedItemNote("si-1", "  use for refunds  ");
    const update = calls.find((call) => call.method === "update");
    expect(update?.args[0]).toEqual({ note: "use for refunds" });
    calls = [];
    await expect(updateSavedItemNote("si-1", "x".repeat(2001))).rejects.toBeInstanceOf(SocialError);
    expect(calls).toHaveLength(0);
  });
});

describe("listSavedItems", () => {
  const row = (id: string) => ({ id, kind: "step", build_id: "b1", ref: "n1", snapshot: { title: "Triage" }, source_version: null, note: null, created_at: "2026-10-20T00:00:00Z", last_used_at: "2026-10-21T00:00:00Z" });

  it("is one request for a page, filtered to the kind, newest use first, limited", async () => {
    answer = () => ({ data: [row("a"), row("b")], error: null, status: 200 });
    const page = await listSavedItems({ kind: "step", sort: "used", limit: 2 });
    expect(calls.filter((call) => call.method === "request")).toHaveLength(1);
    expect(calls.find((call) => call.method === "eq" && call.args[0] === "kind")?.args[1]).toBe("step");
    expect(calls.find((call) => call.method === "order")?.args).toEqual(["last_used_at", { ascending: false, nullsFirst: false }]);
    expect(calls.some((call) => call.method === "range")).toBe(true);
    expect(page.items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(page.next).toBe("2");
  });

  it("orders by saved, and by name", async () => {
    await listSavedItems({ sort: "saved" });
    expect(calls.find((call) => call.method === "order")?.args[0]).toBe("created_at");
    calls = [];
    await listSavedItems({ sort: "name" });
    expect(calls.find((call) => call.method === "order")?.args).toEqual(["snapshot->>title", { ascending: true, nullsFirst: false }]);
  });

  it("ends when a page is short, and always has a limit", async () => {
    answer = () => ({ data: [row("a")], error: null, status: 200 });
    const page = await listSavedItems({ limit: 5 });
    expect(page.next).toBeNull();
    expect(calls.some((call) => call.method === "range")).toBe(true);
  });

  it("counts the kinds in one request", async () => {
    answer = () => ({ data: [{ kind: "step" }, { kind: "step" }, { kind: "session" }], error: null });
    expect(await countSavedItems()).toEqual({ part: 0, session: 1, step: 2, request: 0, filter_set: 0, collection: 0 });
    expect(calls.filter((call) => call.method === "request")).toHaveLength(1);
  });
});

describe("Used in and saved by", () => {
  it("reads Used in for the page in one request, as a map by saved item", async () => {
    answer = () => ({ data: [{ saved_item_id: "si-1", builds: 3 }], error: null });
    const used = await savedItemsUsedIn();
    expect(used.get("si-1")).toBe(3);
    expect(calls.filter((call) => call.table === "rpc")).toHaveLength(1);
  });

  it("reads saved by for collections in one request, and nothing for no ids", async () => {
    answer = () => ({ data: [{ collection_id: "c1", saved_by: 14 }], error: null });
    expect((await collectionSavedBy(["c1", "c1"])).get("c1")).toBe(14);
    expect(calls.filter((call) => call.table === "rpc")).toHaveLength(1);
    calls = [];
    expect((await collectionSavedBy([])).size).toBe(0);
    expect(calls).toHaveLength(0);
  });
});
