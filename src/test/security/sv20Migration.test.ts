// SV-20 P1 and P2: the one migration for notifications about builds, read as text. The database notifies, never the client:
// the saver triggers write through rc_notify and nothing else, run as definer with a pinned search_path, and nobody can call them.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = "supabase/migrations";
const FILE = "20261031120000_sv20_notifications.sql";
const sql = () => readFileSync(`${DIR}/${FILE}`, "utf8");
const code = () => sql().replace(/--[^\n]*/g, "");

describe("the SV-20 migration", () => {
  it("steps after the newest migration before it", () => {
    // Every migration that was there before it sorts earlier. Later ones (SV-21's) are not its concern.
    const earlier = readdirSync(DIR).filter((name) => name !== FILE && name < "20261031").sort();
    expect(FILE > earlier[earlier.length - 1]).toBe(true);
  });

  it("lets a notification target a node and a collection, keeping every value it allowed", () => {
    const text = code();
    for (const value of ["blueprint", "blog", "bounty", "stage", "block", "comment", "message", "thread", "profile", "build", "build_comment", "bounty_build", "node", "collection"]) {
      expect(text).toContain(`'${value}'`);
    }
    expect(text).toMatch(/FROM pg_constraint/);
  });

  it("adds the saver's switch off by default", () => {
    expect(code()).toMatch(/ALTER TABLE public\.saved_items\s+ADD COLUMN IF NOT EXISTS notify boolean NOT NULL DEFAULT false/);
  });

  it("writes only through rc_notify, from triggers on the three source tables", () => {
    const text = code();
    expect(text).not.toMatch(/INSERT INTO public\.notifications/);
    expect(text).toMatch(/PERFORM public\.rc_notify\(/);
    for (const table of ["builds", "build_reproductions", "solutions"]) expect(text).toMatch(new RegExp(`ON public\\.${table}`));
  });

  it("pins search_path on every function and revokes execute from anon, PUBLIC and authenticated", () => {
    const text = code();
    const functions = text.match(/CREATE OR REPLACE FUNCTION public\.\w+/g) ?? [];
    expect(functions.length).toBeGreaterThanOrEqual(4);
    expect((text.match(/SET search_path = public/g) ?? []).length).toBe(functions.length);
    for (const name of functions.map((f) => f.split(".")[1])) {
      expect(text).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\([^)]*\\)\\s+FROM PUBLIC, anon, authenticated`));
    }
  });

  it("tells a saver only when they turned it on, never the actor, never the maker twice, and a reader once", () => {
    const text = code();
    expect(text).toMatch(/s\.notify/);
    expect(text).toMatch(/DISTINCT ON \(found\.user_id\)/);
    expect(text).toMatch(/s\.user_id <> _maker/);
    expect(text).toMatch(/s\.user_id <> _actor/);
    expect(text).toMatch(/LIMIT 500/);
  });

  it("carries the plan to run for the saver read, and has no em dash", () => {
    expect((sql().match(/EXPLAIN \(ANALYZE, BUFFERS\)/g) ?? []).length).toBeGreaterThanOrEqual(1);
    expect(sql()).not.toContain("—");
  });
});
