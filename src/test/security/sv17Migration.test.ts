// SV-17 P1: the saved items migration, read as text: the table and its privacy, the kinds a collection accepts, the Used in read
// and the saved-by count, and the plans to run once it is applied.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = "supabase/migrations";
const FILE = "20261029120000_sv17_saved_items.sql";
const sql = () => readFileSync(`${DIR}/${FILE}`, "utf8");
const code = () => sql().replace(/--[^\n]*/g, "");

describe("the SV-17 migration", () => {
  it("steps after the newest migration that was there when it was written (SV-16's)", () => {
    expect(FILE > "20261028130000_sv16_contributor_credit.sql").toBe(true);
    expect(readdirSync(DIR)).toContain(FILE);
  });

  it("makes saved_items with the columns the prompt names, one row per source, and the Library's index", () => {
    const text = code();
    for (const column of ["user_id", "kind", "build_id", "ref", "snapshot", "source_version", "note", "created_at", "last_used_at"]) {
      expect(text).toMatch(new RegExp(`\\b${column}\\b`));
    }
    expect(text).toMatch(/kind IN \('part','session','step','request','filter_set','collection'\)/);
    expect(text).toMatch(/UNIQUE INDEX IF NOT EXISTS uniq_saved_items_owner_source[\s\S]*\(user_id, kind, coalesce\(build_id/);
    expect(text).toMatch(/idx_saved_items_user_kind_used\s+ON public\.saved_items \(user_id, kind, last_used_at DESC\)/);
  });

  it("lets only the owner read or write a row, with the auth call wrapped, and gives anon nothing", () => {
    const text = code();
    expect(text).toMatch(/ENABLE ROW LEVEL SECURITY/);
    for (const command of ["SELECT", "INSERT", "UPDATE", "DELETE"]) expect(text).toMatch(new RegExp(`ON public\\.saved_items FOR ${command}`));
    expect(text).not.toMatch(/(?<!select )auth\.uid\(\)/);
    expect(text).not.toMatch(/TO (public|anon)\b[^;]*saved_items|saved_items[^;]*TO anon/);
    expect(text).toMatch(/REVOKE ALL ON public\.saved_items FROM anon, authenticated;/);
    expect(text).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON public\.saved_items TO authenticated;/);
  });

  it("points the owner at profiles, never at the auth schema", () => {
    const text = code();
    expect(text).toMatch(/user_id\s+uuid\s+NOT NULL REFERENCES public\.profiles\(id\) ON DELETE CASCADE/);
    expect(text).not.toMatch(/REFERENCES auth\./);
  });

  it("refuses the content of a draft", () => {
    expect(code()).toMatch(/b\.status <> 'draft'/);
  });

  it("opens collection_items to the five kinds through the catalogue, and ties them to saved_item_id", () => {
    const text = code();
    expect(text).toMatch(/c\.conkey = ARRAY\[_kind_attnum\]/);
    expect(text).toMatch(/'part','session','step','request','filter_set'\)\)/);
    expect(text).toMatch(/ADD COLUMN IF NOT EXISTS saved_item_id uuid NULL REFERENCES public\.saved_items/);
    expect(text).toMatch(/collection_items_saved_item_matches_kind/);
  });

  it("keeps build_saves for builds", () => {
    expect(code()).not.toMatch(/(ALTER|CREATE|DROP|INSERT|UPDATE|DELETE|REVOKE|GRANT)[^;]*build_saves/);
  });

  it("reads Used in as the caller, and the saved-by count as numbers only, from public collections only", () => {
    const text = code();
    expect(text).toMatch(/saved_items_used_in\(\)[\s\S]*SECURITY INVOKER SET search_path = public/);
    expect(text).toMatch(/collection_saved_by_count\(_collection_ids uuid\[\]\)[\s\S]*SECURITY DEFINER SET search_path = public/);
    expect(text).toMatch(/c\.is_public = true/);
    expect(text).toMatch(/REVOKE EXECUTE ON FUNCTION public\.collection_saved_by_count\(uuid\[\]\) FROM PUBLIC/);
    expect(text).toMatch(/REVOKE EXECUTE ON FUNCTION public\.saved_items_used_in\(\) FROM PUBLIC, anon/);
    expect(text).toMatch(/idx_build_nodes_source_node/);
    expect(text).toMatch(/idx_build_nodes_source_import_session/);
  });

  it("carries the three plans to run and what each should show", () => {
    const text = sql();
    expect((text.match(/EXPLAIN \(ANALYZE, BUFFERS\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(text).toMatch(/no Sort, no Seq Scan on saved_items/);
    expect(text).toMatch(/no Seq Scan on build_nodes/);
  });

  it("has no em dash", () => {
    expect(sql()).not.toContain("—");
  });
});
