// SV-27 Part 2: before the migration is applied, the nine deployment kinds read `ready: false` (Front end stays ready, it is
// `live_app`), the changelog answers "not available" so its field and list stay hidden, and nothing throws. Codes only.

import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

let answer: { data?: unknown; error?: unknown } = { data: [], error: null };
const inserts: unknown[] = [];

function builder() {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "insert", "delete", "eq", "order", "limit", "single"]) {
    self[method] = (...args: unknown[]) => {
      if (method === "insert") inserts.push(args[0]);
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve({ error: null, ...answer }).then(resolve, reject);
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => builder(), auth: { getSession: async () => ({ data: { session: { user: { id: "maker-1" } } } }) } },
}));

const { addBuildUpdate, buildUpdatesAvailable, listBuildUpdates, cleanUpdateNote } = await import("./buildUpdates");
const { DEPLOYMENT_TYPES, deploymentAddReadiness } = await import("./deployment");

beforeEach(() => {
  answer = { data: [], error: null };
  inserts.length = 0;
});

describe("SV-27 P2: the Add menu's Deployment group before the migration", () => {
  it("reads ready: false for the nine new kinds, and Front end ready", () => {
    const live = new Set(["live_app", "agent_config", "team"]);
    const items = deploymentAddReadiness((type) => live.has(type));
    expect(items.filter((item) => item.ready).map((item) => item.kind)).toEqual(["front_end"]);
    expect(items.filter((item) => !item.ready)).toHaveLength(9);
  });

  it("reads ready once the node types are live", () => {
    const items = deploymentAddReadiness(() => true);
    expect(items.every((item) => item.ready)).toBe(true);
  });
});

describe("SV-27 P2: the changelog before the migration", () => {
  for (const code of ["42P01", "PGRST205"]) {
    it(`answers not available on ${code}, without throwing`, async () => {
      answer = { data: null, error: { code, message: "relation does not exist" } };
      await expect(listBuildUpdates("b1")).resolves.toEqual({ available: false, updates: [], more: false });
      await expect(buildUpdatesAvailable()).resolves.toBe(false);
      await expect(addBuildUpdate("b1", "Added memory")).resolves.toBeNull();
    });
  }

  it("throws a failure that is not a missing table, naming ids only", async () => {
    answer = { data: null, error: { code: "42501", message: "Added memory" } };
    await expect(listBuildUpdates("b1")).rejects.toThrow(/no access/);
    await expect(listBuildUpdates("b1")).rejects.not.toThrow(/Added memory/);
  });

  it("writes no row without a note, and a tidy one with", async () => {
    await expect(addBuildUpdate("b1", "   ")).resolves.toBeNull();
    expect(inserts).toEqual([]);
    answer = { data: { id: "u1", note: "Added memory", created_at: "2026-10-31T10:00:00Z" }, error: null };
    await expect(addBuildUpdate("b1", "  Added   memory ")).resolves.toEqual({ id: "u1", note: "Added memory", createdAt: "2026-10-31T10:00:00Z" });
    expect(inserts).toEqual([{ build_id: "b1", note: "Added memory" }]);
    expect(cleanUpdateNote("x".repeat(300))).toHaveLength(200);
  });
});

describe("SV-27 P2: the migration file", () => {
  const sql = readFileSync("supabase/migrations/20261105120000_sv27_agent_deployment.sql", "utf8");

  it("adds the nine node types without a new category, idempotently", () => {
    for (const type of DEPLOYMENT_TYPES) expect(sql).toContain(`('${type}', `);
    expect(sql).toMatch(/ON CONFLICT \(key\) DO NOTHING/);
    expect(sql).not.toMatch(/node_types_category_check/);
    for (const category of sql.matchAll(/\('[a-z_]+', '[A-Za-z ]+', '([a-z]+)'/g)) expect(["configuration", "data"]).toContain(category[1]);
  });

  it("makes build_updates with RLS, (select auth.uid()) and no update policy", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.build_updates/);
    expect(sql).toMatch(/char_length\(note\) BETWEEN 1 AND 200/);
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/EXPLAIN \(ANALYZE, BUFFERS\)/);
    expect(sql).not.toMatch(/FOR UPDATE/);
    expect(sql.replace(/\(select auth\.uid\(\)\)/g, "")).not.toMatch(/auth\.uid\(\)/);
  });
});
