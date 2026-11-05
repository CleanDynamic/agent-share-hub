// UX-09: the five migrations, read as text. Each comes after the newest one there when it was written (UX-08's), never calls a bare
// auth.uid(), and keeps its function's search_path and grants.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = "supabase/migrations";
const FILES = [
  "20261108120000_ux09_made_for_topic.sql",
  "20261108130000_ux09_used_in_topics.sql",
  "20261108140000_ux09_report_topics.sql",
  "20261108150000_ux09_topic_messages.sql",
  "20261108160000_ux09_site_hide_topics.sql",
];
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

  it("Q4: a message carries a topic in one nullable column; no thread, pin or policy changes", () => {
    const text = code(FILES[3]);
    expect(text).toMatch(/ADD COLUMN IF NOT EXISTS shared_post_id uuid NULL REFERENCES public\.openbuild_posts\(id\) ON DELETE SET NULL/);
    expect(text).toMatch(/CREATE INDEX IF NOT EXISTS idx_dm_messages_shared_post[\s\S]*WHERE shared_post_id IS NOT NULL/);
    expect(text).not.toMatch(/dm_threads|pinned_content_type|POLICY/);
  });

  it("Q5: the site's hide is apart from the space's, admins only, through (select auth.uid())", () => {
    const text = code(FILES[4]);
    expect(text).toMatch(/ADD COLUMN IF NOT EXISTS site_hidden_by uuid NULL REFERENCES public\.profiles\(id\) ON DELETE SET NULL/);
    // Read: nobody but an admin reads what the site hid; the space's hide keeps its readers.
    expect(text).toMatch(/site_hidden_by IS NULL\s+AND \(\s+hidden_by IS NULL/);
    expect(text).toMatch(/OR \(select public\.is_admin\(\(select auth\.uid\(\)\)\)\)/);
    // Write: an admin's update policy; the guard keeps each hide to its own side.
    expect(text).toMatch(/CREATE POLICY "Site staff hide and unhide"[\s\S]*USING \(\(select public\.is_admin\(\(select auth\.uid\(\)\)\)\)\)/);
    expect(text).toMatch(/IF NOT public\.is_admin\(_uid\) THEN\s+RAISE EXCEPTION 'Only the site''s moderators can hide or unhide this for the site\.'/);
    expect(text).toMatch(/IF NOT \(public\.viewer_owns_root\(OLD\.root_id\) OR public\.viewer_moderates_post\(OLD\.root_id\)\) THEN/);
    expect(text).toMatch(/AND site_hidden_by IS NULL\s+AND \(parent_id IS NULL OR public\.viewer_can_reply_in\(root_id\)\)/);
    // resolve_report hides a topic or a reply for the site, and no longer refuses it.
    expect(text).toMatch(/ELSIF _target_type = 'openbuild_post' THEN\s+[\s\S]*UPDATE public\.openbuild_posts SET site_hidden_by = _admin/);
    expect(text).not.toMatch(/is hidden by its space''s moderators/);
    // reply_count counts what neither side hid; the author's notice answers only about the caller.
    expect(text).toMatch(/UPDATE OF hidden_by, site_hidden_by ON public\.openbuild_posts/);
    expect(text).toMatch(/AND p\.author_id = \(select auth\.uid\(\)\)\s+AND p\.site_hidden_by IS NOT NULL/);
    expect(text).toMatch(/REVOKE ALL ON FUNCTION public\.site_hidden_posts_of\(uuid\) FROM PUBLIC, anon/);
    expect(text).toMatch(/GRANT EXECUTE ON FUNCTION public\.site_hidden_posts_of\(uuid\) TO authenticated/);
  });
});
