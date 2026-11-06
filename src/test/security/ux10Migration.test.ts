// UX-10 P1: the profile feed migration, read as text.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = "supabase/migrations";
const FILE = "20261109120000_ux10_profile_feed.sql";
const raw = () => readFileSync(`${DIR}/${FILE}`, "utf8");
const code = () => raw().replace(/--[^\n]*/g, "");

describe("the UX-10 migration", () => {
  it("comes after UX-09's, and no migration between them and the UX-11 migrations is missing", () => {
    const files = readdirSync(DIR).filter((name) => name.endsWith(".sql")).sort();
    expect(files.slice(files.indexOf(FILE) + 1)).toEqual(["20261110120000_ux11_legacy_backup.sql", "20261110140000_ux11_retire_request_notifications.sql"]);
    expect(FILE > "20261108160000_ux09_site_hide_topics.sql").toBe(true);
  });

  it("calls no bare auth.uid(), and says what plan to look for", () => {
    expect(code()).not.toMatch(/(?<!select )auth\.uid\(\)/);
    expect(raw()).toMatch(/EXPLAIN \(ANALYZE, BUFFERS\)/);
    expect(raw()).toMatch(/SHOULD SHOW/);
  });

  it("adds the profile's columns, each with its check, whether or not they exist", () => {
    const text = code();
    for (const column of ["avatar_crop", "banner_crop", "avatar_alt", "banner_alt", "about", "links", "profile_settings"]) {
      expect(text).toMatch(new RegExp(`ADD COLUMN IF NOT EXISTS ${column}\\b`));
    }
    expect(text).toMatch(/profile_settings jsonb NOT NULL DEFAULT '\{\}'::jsonb/);
    expect(text).toMatch(/char_length\(about\) <= 600/);
    expect(text).toMatch(/char_length\(avatar_alt\) <= 1000/);
    expect(text).toMatch(/array_length\(l, 1\), 0\) <= 3/);
    expect(text).toMatch(/WHERE key NOT IN \('feed_filter', 'build_display', 'side_sections', 'notes_visible', 'level_visible'\)/);
    expect(text).toMatch(/IF NOT EXISTS \(SELECT 1 FROM pg_constraint WHERE conname = 'profiles_settings_ok'/);
  });

  it("pins: three at most, only what the person made, everyone reads and only the owner writes", () => {
    const text = code();
    expect(text).toMatch(/PRIMARY KEY \(user_id, item_kind, item_id\)/);
    expect(text).toMatch(/UNIQUE \(user_id, position\)/);
    expect(text).toMatch(/CHECK \(position BETWEEN 1 AND 3\)/);
    expect(text).toMatch(/>= 3 THEN\s+RAISE EXCEPTION 'A profile holds 3 pins/);
    expect(text).toMatch(/RAISE EXCEPTION 'You can only pin something you made\.'/);
    expect(text).toMatch(/WITH CHECK \(user_id = \(select auth\.uid\(\)\)\)/);
  });

  it("the feed is security invoker, never returns drafts or saves, and applies notes_visible", () => {
    const text = code();
    const feed = text.slice(text.indexOf("FUNCTION public.get_profile_feed"), text.indexOf("FUNCTION public.profile_level_of"));
    expect(feed).toMatch(/SECURITY INVOKER SET search_path = ''/);
    expect(feed).toMatch(/b\.status IN \('published', 'gallery'\)/);
    expect(feed).toMatch(/profile_notes_shown\(who\.own, who\.follows, who\.notes_visible\)/);
    expect(feed).not.toMatch(/saved_items|saves/);
    expect(feed).toMatch(/WHERE p_cursor IS NULL/);
  });

  it("the one definer answers a level only as the owner's setting allows, and sets its search_path", () => {
    const text = code();
    expect(text.match(/SECURITY DEFINER/g)).toHaveLength(1);
    expect(text).toMatch(/FUNCTION public\.profile_level_of\(p_user uuid\)[\s\S]*SECURITY DEFINER SET search_path = ''[\s\S]*level_visible', 'everyone'\) = 'everyone'/);
    expect(text).toMatch(/REVOKE EXECUTE ON FUNCTION public\.profile_level_of\(uuid\) FROM PUBLIC/);
  });

  it("adds no bucket and no notification", () => {
    const text = code();
    expect(text).not.toMatch(/storage\.buckets|rc_notify|notifications/);
  });

  it("save_profile writes in one call and is for the signed in only", () => {
    const text = code();
    expect(text).toMatch(/REVOKE EXECUTE ON FUNCTION public\.save_profile\(jsonb\) FROM PUBLIC, anon/);
    expect(text).toMatch(/WHERE id = me/);
  });
});
