// SV-22 P1: briefs.

import { beforeEach, describe, expect, it, vi } from "vitest";

let tables: Record<string, { data: unknown; error?: unknown }> = {};
const updates: Record<string, unknown>[] = [];

function builder(table: string) {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order", "limit"]) self[method] = () => self;
  self.range = () => Promise.resolve({ data: tables[table]?.data ?? [], error: tables[table]?.error ?? null });
  self.maybeSingle = () => Promise.resolve({ data: tables[table]?.data ?? null, error: tables[table]?.error ?? null });
  self.then = (resolve: (value: unknown) => unknown) => resolve({ data: tables[table]?.data ?? [], error: tables[table]?.error ?? null });
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => builder(table) } }));
vi.mock("@/lib/build/builds", () => ({ updateBuild: (_id: string, patch: Record<string, unknown>) => (updates.push(patch), Promise.resolve({})) }));
vi.mock("@/lib/build/publish", () => ({ hasTitle: (title: string | null) => Boolean(title && title !== "Untitled build"), NO_TITLE: "Give the build a title before you publish it.", publishBuild: vi.fn() }));

import { briefRefusal, comparePair } from "./briefRules";
import { listBriefs, setBrief } from "./briefs";

beforeEach(() => {
  updates.length = 0;
  tables = {};
});

describe("briefRefusal", () => {
  it("names what a brief still needs", () => {
    expect(briefRefusal({ status: "draft", title: "Dentist" }, 2)).toMatch(/Publish/);
    expect(briefRefusal({ status: "published", title: "Untitled build" }, 2)).toMatch(/title/);
    expect(briefRefusal({ status: "published", title: "Dentist" }, 0)).toMatch(/open step/);
    expect(briefRefusal({ status: "published", title: "Dentist" }, 1)).toBeNull();
  });
});

describe("comparePair", () => {
  it("is the two newest answers, or none", () => {
    expect(comparePair([{ slug: "a" }, { slug: "b" }, { slug: "c" }])).toEqual([{ slug: "a" }, { slug: "b" }]);
    expect(comparePair([{ slug: "a" }])).toBeNull();
  });
});

describe("listBriefs", () => {
  it("groups the page's answers under their brief and counts the open steps", async () => {
    tables = {
      builds: { data: [{ id: "br1", slug: "dentist", title: "Dentist", published_at: "2026-10-01T00:00:00Z", creator: { username: "dax" } }] },
      build_nodes: { data: [{ build_id: "br1" }, { build_id: "br1" }] },
    };
    // Both reads of `builds` answer the same table here; the answers read is told apart by its parent column.
    const answers = [{ parent_build_id: "br1", id: "a1", slug: "x", title: "X", created_at: "2026-10-02T00:00:00Z", reproduction_count: 2, creator: { id: "u1", username: "maya" } }];
    const original = tables.builds.data;
    let call = 0;
    Object.defineProperty(tables.builds, "data", { get: () => (call++ === 0 ? original : answers) });
    const page = await listBriefs();
    expect(page.briefs).toHaveLength(1);
    expect(page.briefs[0]).toMatchObject({ openSteps: 2, answerCount: 1, reproduced: 1, maker: "dax" });
    expect(page.briefs[0].answers[0]).toMatchObject({ handle: "maya", runs: 2 });
  });

  it("reads as no briefs while the column is missing", async () => {
    tables = { builds: { data: null, error: { code: "42703" } } };
    await expect(listBriefs()).resolves.toEqual({ briefs: [], nextOffset: null });
  });
});

describe("setBrief", () => {
  it("refuses a build that cannot be a brief, and writes nothing", async () => {
    tables = { builds: { data: { status: "published", title: "Dentist" } }, build_nodes: { data: [] } };
    await expect(setBrief("b1", true)).rejects.toThrow(/open step/);
    expect(updates).toEqual([]);
  });

  it("marks a published, titled build with a gap", async () => {
    tables = { builds: { data: { status: "published", title: "Dentist" } }, build_nodes: { data: [{ id: "g" }] } };
    await setBrief("b1", true);
    expect(updates).toEqual([{ is_brief: true }]);
  });

  it("takes the mark off without asking", async () => {
    await setBrief("b1", false);
    expect(updates).toEqual([{ is_brief: false }]);
  });
});
