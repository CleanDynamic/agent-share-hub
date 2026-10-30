// SV-24 P1: saved filter sets and Groups, the data layer.
//
// The claims: a set is the reader's own rows (one request, a limit); making one keeps it in Library too, and Library failing does not
// fail it; a public set's maker joins it; joining twice is not an error; a name is tidied and an empty one is refused before any
// request; Groups are one request; before the tables are applied reads answer nothing; failures name ids and never a name.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  table: string;
  method: string;
  args: unknown[];
}
type Answer = { data?: unknown; error?: unknown; count?: number | null };

let calls: Recorded[] = [];
let answer: (table: string, method: string, own: Recorded[]) => Answer = () => ({ data: [], error: null });
let session: { user: { id: string } } | null = { user: { id: "reader-1" } };
const saveItem = vi.hoisted(() => vi.fn());

function builder(table: string) {
  const self: Record<string, unknown> = {};
  let verb = "select";
  const own: Recorded[] = [];
  for (const method of ["select", "insert", "update", "delete", "eq", "order", "limit", "single", "maybeSingle"]) {
    self[method] = (...args: unknown[]) => {
      if (["select", "insert", "update", "delete"].includes(method) && !(method === "select" && verb !== "select")) verb = method;
      calls.push({ table, method, args });
      own.push({ table, method, args });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve({ error: null, ...answer(table, verb, own) }).then(resolve, reject);
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => builder(table),
    rpc: vi.fn(async (name: string, args: unknown) => {
      calls.push({ table: "rpc", method: name, args: [args] });
      return { error: null, ...answer(`rpc:${name}`, "rpc", []) };
    }),
    auth: { getSession: vi.fn(async () => ({ data: { session } })) },
  },
}));
vi.mock("@/lib/library/savedItems", () => ({ saveItem }));

import { SocialError } from "@/lib/social/types";
import { EMPTY_LAYOUT, withHeight } from "./buildsLayout";
import { cleanSetName, createFilterSet, deleteFilterSet, filterSetHref, getFilterSet, joinFilterSet, listGroups, listMyFilterSets, queryOf, renameFilterSet, saveFilterSetLayout, setFilterSetPublic } from "./filterSets";

const row = (over: Record<string, unknown> = {}) => ({ id: "fs-1", name: "Stale agents", query: { search: "shape=agent&state=stale" }, is_public: false, user_id: "reader-1", ...over });

beforeEach(() => {
  calls = [];
  answer = () => ({ data: [], error: null });
  session = { user: { id: "reader-1" } };
  saveItem.mockReset();
  saveItem.mockResolvedValue(undefined);
});

describe("listing the reader's sets", () => {
  it("is one request for the reader's own rows, newest first, with a limit", async () => {
    answer = () => ({ data: [row(), row({ id: "fs-2", name: "Sales", query: { search: "f=field%3Asales", layout: { order: ["task"] } }, is_public: true })] });
    const sets = await listMyFilterSets();
    expect(sets.map((set) => [set.id, set.name, set.search, set.isPublic])).toEqual([["fs-1", "Stale agents", "shape=agent&state=stale", false], ["fs-2", "Sales", "f=field%3Asales", true]]);
    expect(sets[1].layout?.order).toEqual(["task"]);
    expect(calls.filter((call) => call.method === "select")).toHaveLength(1);
    expect(calls).toContainEqual({ table: "filter_sets", method: "eq", args: ["user_id", "reader-1"] });
    expect(calls.find((call) => call.method === "limit")?.args).toEqual([50]);
  });

  it("is none, and no request, when nobody is signed in", async () => {
    session = null;
    expect(await listMyFilterSets()).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("is none before the table is applied, and an error otherwise", async () => {
    answer = () => ({ error: { code: "42P01" } });
    expect(await listMyFilterSets()).toEqual([]);
    answer = () => ({ error: { code: "XX000", message: "the set called Secret plans" } });
    await expect(listMyFilterSets()).rejects.toSatisfy((error: unknown) => error instanceof SocialError && !String((error as Error).message).includes("Secret"));
  });
});

describe("one set", () => {
  it("comes with its members and whether the viewer follows it", async () => {
    answer = (table, _verb, own) => (table === "filter_sets" ? { data: row({ is_public: true, user_id: "maker-9" }) } : own.some((call) => call.method === "eq" && call.args[0] === "user_id") ? { data: [{ user_id: "reader-1" }] } : { count: 7, data: null });
    const set = await getFilterSet("fs-1");
    expect(set).toMatchObject({ id: "fs-1", mine: false, members: 7, member: true, isPublic: true });
  });

  it("is null when it is not there, or is private to someone else", async () => {
    answer = (table) => (table === "filter_sets" ? { data: null } : { data: [] });
    expect(await getFilterSet("nope")).toBeNull();
  });
});

describe("making a set", () => {
  it("tidies the name, keeps the search and the layout, and keeps it in Library too", async () => {
    answer = (table) => (table === "filter_sets" ? { data: row({ name: "Sales agents", query: { search: "f=field%3Asales" } }) } : {});
    const set = await createFilterSet({ name: "  Sales   agents ", search: "?f=field%3Asales", layout: withHeight(EMPTY_LAYOUT, "field", 200) });
    const insert = calls.find((call) => call.method === "insert");
    expect(insert?.args[0]).toEqual({ user_id: "reader-1", name: "Sales agents", query: { search: "f=field%3Asales", layout: { ...EMPTY_LAYOUT, heights: { field: 200 } } }, is_public: false });
    expect(saveItem).toHaveBeenCalledWith({ kind: "filter_set", ref: set.id, snapshot: { name: "Sales agents", query: "f=field%3Asales" } });
  });

  it("still saves when Library cannot keep it", async () => {
    saveItem.mockRejectedValue(new Error("no"));
    answer = (table) => (table === "filter_sets" ? { data: row() } : {});
    await expect(createFilterSet({ name: "Stale agents", search: "shape=agent" })).resolves.toMatchObject({ id: "fs-1" });
  });

  it("joins its maker when it is public, and not otherwise", async () => {
    answer = (table) => (table === "filter_sets" ? { data: row({ is_public: true }) } : {});
    await createFilterSet({ name: "Open", search: "", isPublic: true });
    expect(calls.filter((call) => call.table === "filter_set_members" && call.method === "insert").map((call) => call.args[0])).toEqual([{ filter_set_id: "fs-1", user_id: "reader-1" }]);
    calls = [];
    answer = (table) => (table === "filter_sets" ? { data: row() } : {});
    await createFilterSet({ name: "Mine", search: "" });
    expect(calls.some((call) => call.table === "filter_set_members")).toBe(false);
  });

  it("refuses an empty name, or nobody signed in, before any request", async () => {
    await expect(createFilterSet({ name: "   ", search: "" })).rejects.toMatchObject({ kind: "invalid" });
    session = null;
    await expect(createFilterSet({ name: "x", search: "" })).rejects.toMatchObject({ kind: "no_access" });
    expect(calls).toEqual([]);
  });

  it("writes no layout key for a layout with nothing in it", () => {
    expect(queryOf("shape=agent", EMPTY_LAYOUT)).toEqual({ search: "shape=agent" });
    expect(queryOf("shape=agent", null)).toEqual({ search: "shape=agent" });
  });

  it("cuts a name to 80 characters", () => {
    expect(cleanSetName("a".repeat(120))).toHaveLength(80);
  });
});

describe("changing and removing", () => {
  it("renames the set and Library's copy", async () => {
    expect(await renameFilterSet("fs-1", "  New   name ")).toBe("New name");
    expect(calls.filter((call) => call.method === "update").map((call) => [call.table, call.args[0]])).toEqual([["filter_sets", { name: "New name" }], ["saved_items", { snapshot: { name: "New name" } }]]);
    await expect(renameFilterSet("fs-1", " ")).rejects.toMatchObject({ kind: "invalid" });
  });

  it("makes a set public by joining its maker, and private by changing nothing else", async () => {
    await setFilterSetPublic("fs-1", true);
    expect(calls.some((call) => call.table === "filter_set_members" && call.method === "insert")).toBe(true);
    calls = [];
    await setFilterSetPublic("fs-1", false);
    expect(calls.some((call) => call.table === "filter_set_members")).toBe(false);
  });

  it("keeps the layout in the set with the search beside it, because the column is replaced whole", async () => {
    await saveFilterSetLayout("fs-1", "shape=agent", withHeight(EMPTY_LAYOUT, "task", 240));
    expect(calls.find((call) => call.method === "update")?.args[0]).toEqual({ query: { search: "shape=agent", layout: { ...EMPTY_LAYOUT, heights: { task: 240 } } } });
  });

  it("deletes the set and Library's copy", async () => {
    await deleteFilterSet("fs-1");
    expect(calls.filter((call) => call.method === "delete").map((call) => call.table)).toEqual(["filter_sets", "saved_items"]);
  });

  it("does not mind being joined twice", async () => {
    answer = () => ({ error: { code: "23505" } });
    await expect(joinFilterSet("fs-1")).resolves.toBeUndefined();
    answer = () => ({ error: { code: "42501" } });
    await expect(joinFilterSet("fs-1")).rejects.toMatchObject({ kind: "no_access" });
  });
});

describe("Groups", () => {
  it("are one request, as the reader sees them", async () => {
    answer = () => ({ data: [{ id: "g1", name: "Sales agents", search: "f=field%3Asales", members: "12", is_member: true, is_owner: false }, { id: "g2", name: "Research", search: null, members: 0, is_member: false, is_owner: true }] });
    const groups = await listGroups();
    expect(groups).toEqual([
      { id: "g1", name: "Sales agents", search: "f=field%3Asales", members: 12, member: true, mine: false },
      { id: "g2", name: "Research", search: "", members: 0, member: false, mine: true },
    ]);
    expect(calls).toEqual([{ table: "rpc", method: "list_filter_set_groups", args: [{ p_limit: 12 }] }]);
  });

  it("are none before the function is applied", async () => {
    answer = () => ({ error: { code: "PGRST202" } });
    expect(await listGroups()).toEqual([]);
  });
});

describe("a set's address", () => {
  it("is its filters with set= last, so the page knows where the layout is kept", () => {
    expect(filterSetHref({ id: "fs-1", search: "shape=agent&q=sales" })).toBe("/builds?shape=agent&q=sales&set=fs-1");
    expect(filterSetHref({ id: "fs-1", search: "" })).toBe("/builds?set=fs-1");
  });
});
