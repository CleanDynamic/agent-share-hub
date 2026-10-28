// SV-19 P1: the node versions migration, read as text: the column, the trigger that moves it only when the content changes, and
// the plans to run once it is applied.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = "supabase/migrations";
const FILE = "20261030120000_sv19_node_versions.sql";
const code = () => readFileSync(`${DIR}/${FILE}`, "utf8").replace(/--[^\n]*/g, "");

describe("the SV-19 migration", () => {
  it("steps after the newest migration that was there when it was written (SV-17's)", () => {
    expect(FILE > "20261029120000_sv17_saved_items.sql").toBe(true);
    expect(readdirSync(DIR)).toContain(FILE);
  });

  it("adds build_nodes.updated_at, filled from created_at for existing rows, then not null with a default of now()", () => {
    const text = code();
    expect(text).toMatch(/ADD COLUMN IF NOT EXISTS updated_at timestamptz/);
    expect(text).toMatch(/UPDATE public\.build_nodes SET updated_at = created_at WHERE updated_at IS NULL/);
    expect(text).toMatch(/updated_at SET DEFAULT now\(\)/);
    expect(text).toMatch(/updated_at SET NOT NULL/);
    // The fill comes before the trigger exists, so it moves nothing else.
    expect(text.indexOf("SET updated_at = created_at")).toBeLessThan(text.indexOf("CREATE TRIGGER"));
  });

  it("moves the version only when type, title, note or payload change, so moving a node is not an edit", () => {
    const text = code();
    expect(text).toMatch(/\(NEW\.type, NEW\.title, NEW\.note, NEW\.payload\) IS DISTINCT FROM \(OLD\.type, OLD\.title, OLD\.note, OLD\.payload\)/);
    expect(text).not.toMatch(/position|parent_id/);
    expect(text).toMatch(/BEFORE UPDATE ON public\.build_nodes/);
  });

  it("pins the function's search_path, keeps it out of anon's and public's reach, and can be run twice", () => {
    const text = code();
    expect(text).toMatch(/SET search_path = public/);
    expect(text).not.toMatch(/SECURITY DEFINER/);
    expect(text).toMatch(/REVOKE EXECUTE ON FUNCTION public\.build_nodes_touch_updated_at\(\) FROM PUBLIC, anon/);
    expect(text).toMatch(/DROP TRIGGER IF EXISTS trg_build_nodes_touch_updated_at/);
    expect(text).toMatch(/CREATE OR REPLACE FUNCTION/);
  });

  it("writes the plans to run once it is applied", () => {
    const header = readFileSync(`${DIR}/${FILE}`, "utf8").split("ALTER TABLE")[0];
    expect(header).toMatch(/EXPLAIN \(ANALYZE, BUFFERS\)/);
    expect(header).toMatch(/SHOULD SHOW/);
  });
});
