// UX-09: the three migrations, read as text. Each comes after the newest one there when it was written (UX-08's), never calls a bare
// auth.uid(), and keeps its function's search_path and grants.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = "supabase/migrations";
const FILES = ["20261108120000_ux09_made_for_topic.sql", "20261108130000_ux09_used_in_topics.sql", "20261108140000_ux09_report_topics.sql"];
const code = (file: string) => readFileSync(`${DIR}/${file}`, "utf8").replace(/--[^\n]*/g, "");

describe("the UX-09 migrations", () => {
  it.each(FILES)("%s comes after UX-08's and is on disk", (file) => {
    expect(file > "20261107180000_ux08_still_open_builds.sql").toBe(true);
    expect(readdirSync(DIR)).toContain(file);
  });

  it.each(FILES)("%s calls no bare auth.uid() and says what plan to look for", (file) => {
    expect(code(file)).not.toMatch(/(?<!select )auth\.uid\(\)/);
    expect(readFileSync(`${DIR}/${file}`, "utf8")).toMatch(/EXPLAIN|No new read and no new index/);
  });

  it("P3: one nullable column, a foreign key that lets a topic go, and nothing else written", () => {
    const text = code(FILES[0]);
    expect(text).toMatch(/ADD COLUMN IF NOT EXISTS made_for_topic_id uuid NULL/);
    expect(text).toMatch(/REFERENCES public\.openbuild_posts\(id\) ON DELETE SET NULL/);
    expect(text).not.toMatch(/\bUPDATE\b|\bINSERT\b|POLICY/);
  });

  it("P4: Used in keeps its builds, adds topics, and keeps its rights", () => {
    const text = code(FILES[1]);
    expect(text).toMatch(/RETURNS TABLE \(saved_item_id uuid, builds integer, topics integer\)/);
    expect(text).toMatch(/SECURITY INVOKER SET search_path = public/);
    expect(text).toMatch(/JOIN public\.post_attachments a\s+ON a\.kind = 'step'/);
    expect(text).toMatch(/p\.hidden_by IS NULL/);
    expect(text).toMatch(/REVOKE EXECUTE ON FUNCTION public\.saved_items_used_in\(\) FROM PUBLIC, anon/);
    expect(text).toMatch(/GRANT EXECUTE ON FUNCTION public\.saved_items_used_in\(\) TO authenticated/);
  });

  it("P8: reports take a topic, a topic's id never reaches build_comments, and hiding one is refused in words", () => {
    const text = code(FILES[2]);
    expect(text).toMatch(/CHECK \(target_type IN \('build', 'comment', 'openbuild_post'\)\)/);
    expect(text).toMatch(/ELSIF _target_type = 'comment' THEN\s+UPDATE public\.build_comments/);
    expect(text).toMatch(/RAISE EXCEPTION 'A topic or reply is hidden by its space''s moderators/);
    expect(text).toMatch(/SECURITY DEFINER\s+SET search_path = public/);
    expect(text).toMatch(/NOT public\.is_admin\(_admin\)/);
    expect(text).toMatch(/REVOKE ALL ON FUNCTION public\.resolve_report\(uuid, text\) FROM PUBLIC, anon/);
    expect(text).not.toMatch(/openbuild_posts\s+SET/);
  });
});
