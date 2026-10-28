// SV-15: listActivityFor, one test per kind and one for the `since` boundary. The client is a table-keyed stub: each
// `from(table)` resolves to the rows the test gave it, and records the filters it was asked with.

import { beforeEach, describe, expect, it, vi } from "vitest";

type Rows = Record<string, unknown[]>;
let tables: Rows = {};
const calls: Array<{ table: string; filters: Array<[string, ...unknown[]]> }> = [];

function chain(table: string) {
  const call = { table, filters: [] as Array<[string, ...unknown[]]> };
  calls.push(call);
  const q: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "in", "gt", "order", "limit"]) {
    q[method] = (...args: unknown[]) => {
      call.filters.push([method, ...args]);
      return q;
    };
  }
  q.then = (resolve: (value: unknown) => unknown) => resolve({ data: tables[table] ?? [], error: null });
  return q;
}

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => chain(table) } }));

import { listActivityFor } from "@/lib/feed/activity";

const DAY = 86_400_000;
const NOW = Date.parse("2026-10-28T12:00:00.000Z");
const SINCE = new Date(NOW - 2 * DAY).toISOString();
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

const build = (over: Record<string, unknown> = {}) => ({ id: "b1", slug: "call-notes", title: "Call notes", creator_id: "u1", status: "published", last_confirmed_at: ago(1), published_at: ago(30), ...over });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  calls.length = 0;
  tables = { builds: [build()], build_saves: [], bounties: [], build_reproductions: [], solutions: [], profiles: [{ id: "u2", username: "kit", display_name: "Kit" }] };
});

describe("listActivityFor", () => {
  it("returns a run by someone else on a build the reader made", async () => {
    tables.build_reproductions = [{ id: "r1", build_id: "b1", user_id: "u2", confirmed_at: ago(0.5), model_used: "opus-5.5", worked: true, note: " fine " }];
    const [event] = await listActivityFor({ userId: "u1", since: SINCE });
    expect(event).toMatchObject({ kind: "run", id: "run:r1", role: "maker", buildSlug: "call-notes", worked: true, model: "opus-5.5", note: "fine", runner: { handle: "kit" } });
    const read = calls.find((c) => c.table === "build_reproductions");
    expect(read?.filters).toContainEqual(["neq", "user_id", "u1"]);
  });

  it("returns a rebuild of a build the reader saved, as a saver", async () => {
    tables.builds = [];
    tables.build_saves = [{ build: build({ id: "b9", slug: "triage", title: "Triage", creator_id: "u3" }) }];
    // The second `builds` read (parent_build_id) is the rebuild; the stub gives every builds read the same rows.
    tables.builds = [{ id: "b2", slug: "triage-2", title: "Triage 2", creator_id: "u2", parent_build_id: "b9", published_at: ago(1) }];
    const events = await listActivityFor({ userId: "u1", since: SINCE });
    expect(events.find((e) => e.kind === "rebuild")).toMatchObject({ role: "saver", buildId: "b9", rebuildId: "b2", rebuildSlug: "triage-2", rebuilder: { handle: "kit" } });
  });

  it("returns a solution on a request the reader opened", async () => {
    tables.bounties = [{ id: "q1", build_id: "b1" }];
    tables.solutions = [{ id: "s1", bounty_id: "q1", solver_id: "u2", submitted_at: ago(1) }];
    const events = await listActivityFor({ userId: "u1", since: SINCE });
    expect(events.find((e) => e.kind === "answer")).toMatchObject({ id: "answer:s1", bountyId: "q1", buildId: "b1", solver: { handle: "kit" } });
  });

  it("returns a build that went stale since `since`, and not one that was already stale", async () => {
    tables.builds = [build({ id: "fresh-then", last_confirmed_at: ago(121) }), build({ id: "old", slug: "old", last_confirmed_at: ago(300) })];
    // 121 days ago confirmed: stale now (>120), fresh two days ago (119). 300 days: stale at both times.
    const events = await listActivityFor({ userId: "u1", since: SINCE });
    const stale = events.filter((e) => e.kind === "stale");
    expect(stale.map((e) => e.buildId)).toEqual(["fresh-then"]);
  });

  it("leaves out an event at or before `since`", async () => {
    tables.bounties = [{ id: "q1", build_id: "b1" }];
    tables.build_reproductions = [{ id: "r1", build_id: "b1", user_id: "u2", confirmed_at: ago(3), model_used: null, worked: false, note: null }];
    await listActivityFor({ userId: "u1", since: SINCE });
    const read = calls.find((c) => c.table === "build_reproductions");
    expect(read?.filters).toContainEqual(["gt", "confirmed_at", SINCE]);
    const solutions = calls.find((c) => c.table === "solutions");
    expect(solutions?.filters).toContainEqual(["gt", "submitted_at", SINCE]);
  });

  it("starts every hop-2 read together, and reads nothing for a reader with no builds", async () => {
    tables.builds = [];
    expect(await listActivityFor({ userId: "u1", since: SINCE })).toEqual([]);
    expect(calls.map((c) => c.table).sort()).toEqual(["build_saves", "bounties", "builds"].sort());
  });

  it("savedOnly reads neither the reader's builds nor their requests, and leaves out a saved build they made", async () => {
    tables.builds = [];
    tables.build_saves = [{ build: build({ id: "b9", creator_id: "u3" }) }, { build: build({ id: "b1" }) }];
    tables.build_reproductions = [
      { id: "r1", build_id: "b9", user_id: "u2", confirmed_at: ago(1), model_used: null, worked: true, note: null },
      { id: "r2", build_id: "b1", user_id: "u2", confirmed_at: ago(1), model_used: null, worked: true, note: null },
    ];
    const events = await listActivityFor({ userId: "u1", since: SINCE, savedOnly: true });
    expect(events.map((e) => [e.id, e.role])).toEqual([["run:r1", "saver"]]);
    expect(calls.some((c) => c.table === "bounties")).toBe(false);
    expect(calls.find((c) => c.table === "builds")?.filters).not.toContainEqual(["eq", "creator_id", "u1"]);
  });

  it("savedOnly reports a saved step whose source was edited since it was saved, and one whose source is gone (SV-19)", async () => {
    tables.builds = [];
    tables.saved_items = [
      { id: "s1", kind: "step", build_id: "b9", ref: "n1", snapshot: { title: "Triage", source: { buildSlug: "support", buildTitle: "Support bot" } }, source_version: ago(10) },
      { id: "s2", kind: "step", build_id: "b9", ref: "n2", snapshot: { title: "Gone" }, source_version: ago(10) },
      { id: "s3", kind: "step", build_id: "b9", ref: "n3", snapshot: { title: "Untouched" }, source_version: ago(10) },
    ];
    tables.build_nodes = [
      { id: "n1", build_id: "b9", parent_id: null, type: "agent", updated_at: ago(1), session: null, import_session: null },
      { id: "n3", build_id: "b9", parent_id: null, type: "agent", updated_at: ago(10), session: null, import_session: null },
    ];
    const events = await listActivityFor({ userId: "u1", since: SINCE, savedOnly: true });
    expect(events.map((e) => [e.id, e.kind, e.role])).toEqual([
      ["removed:s2", "removed", "saver"],
      ["edited:s1", "edited", "saver"],
    ]);
    expect(events.find((e) => e.kind === "edited")).toMatchObject({ at: ago(1), buildSlug: "support", item: { id: "s1" } });
  });

  it("an edit from before the window is not reported, and Home (not savedOnly) never reads saved items", async () => {
    tables.saved_items = [{ id: "s1", kind: "step", build_id: "b9", ref: "n1", snapshot: {}, source_version: ago(30) }];
    tables.build_nodes = [{ id: "n1", build_id: "b9", parent_id: null, type: "agent", updated_at: ago(20), session: null, import_session: null }];
    expect((await listActivityFor({ userId: "u1", since: SINCE, savedOnly: true })).some((e) => e.kind === "edited")).toBe(false);
    calls.length = 0;
    await listActivityFor({ userId: "u1", since: SINCE });
    expect(calls.some((c) => c.table === "saved_items" || c.table === "build_nodes")).toBe(false);
  });

  it("orders newest first and cuts to the limit", async () => {
    tables.build_reproductions = [
      { id: "r1", build_id: "b1", user_id: "u2", confirmed_at: ago(1.5), model_used: null, worked: true, note: null },
      { id: "r2", build_id: "b1", user_id: "u2", confirmed_at: ago(0.2), model_used: null, worked: false, note: null },
    ];
    const events = await listActivityFor({ userId: "u1", since: SINCE, limit: 1 });
    expect(events.map((e) => e.id)).toEqual(["run:r2"]);
  });
});
