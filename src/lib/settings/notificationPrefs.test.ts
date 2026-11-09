import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  KIND_TO_KEY,
  PREFERENCE_GROUPS,
  PREFERENCE_KEYS,
  RETIRED_KINDS,
  parsePreferences,
  preferenceKeyOf,
} from "./notificationPrefs";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");
const sql = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(MIGRATIONS, f), "utf8"));

describe("parsePreferences", () => {
  it("counts a missing key as on", () => {
    const prefs = parsePreferences({ new_follower: true, content_approved: true });
    for (const key of PREFERENCE_KEYS) expect(prefs[key], key).toBe(true);
  });

  it("turns a kind off only for a stored false", () => {
    const prefs = parsePreferences({ post_like: false, build_like: "no", build_comment: 0, post_reply: null });
    expect(prefs.post_like).toBe(false);
    expect(prefs.build_like).toBe(true);
    expect(prefs.build_comment).toBe(true);
    expect(prefs.post_reply).toBe(true);
  });

  it("reads nothing, an array or a string as everything on", () => {
    for (const raw of [undefined, null, [], "false", 3]) {
      const prefs = parsePreferences(raw);
      expect(Object.values(prefs).every(Boolean), String(raw)).toBe(true);
    }
  });

  it("keeps only the keys the database accepts", () => {
    expect(preferenceKeyOf("post_like")).toBe("post_like");
    expect(preferenceKeyOf("content_approved")).toBeNull();
    expect(preferenceKeyOf("__proto__")).toBeNull();
  });
});

describe("the switches and the database", () => {
  it("gives every key exactly one row", () => {
    const rowKeys = PREFERENCE_GROUPS.flatMap((g) => g.rows.map((r) => r.key));
    expect([...rowKeys].sort()).toEqual([...PREFERENCE_KEYS].sort());
  });

  it("holds the kind to key map to notification_pref_key in the migration", () => {
    const file = sql.find((text) => text.includes("FUNCTION public.notification_pref_key"));
    expect(file, "the migration defines notification_pref_key").toBeDefined();
    const body = file!.slice(file!.indexOf("FUNCTION public.notification_pref_key"));
    const pairs = [...body.slice(0, body.indexOf("$$;", body.indexOf("$$") + 2)).matchAll(/WHEN '([a-z_]+)'\s+THEN '([a-z_]+)'/g)].map((m) => [m[1], m[2]]);
    expect(Object.fromEntries(pairs)).toEqual(KIND_TO_KEY);
  });

  it("gives every kind the database writes a switch, or lists it as retired", () => {
    const kinds = new Set<string>();
    for (const text of sql) {
      for (const m of text.matchAll(/rc_notify\(\s*[^,()]+(?:\([^)]*\))?,\s*[^,()]+(?:\([^)]*\))?,\s*'([a-z_]+)'/g)) kinds.add(m[1]);
      for (const m of text.matchAll(/rc_notify_savers\(\s*[^,]+,\s*[^,]+,\s*'([a-z_]+)'/g)) kinds.add(m[1]);
    }
    expect(kinds.size, "the scan found the kinds").toBeGreaterThan(8);
    const unaccounted = [...kinds].filter((k) => !(k in KIND_TO_KEY) && !(RETIRED_KINDS as readonly string[]).includes(k));
    expect(unaccounted).toEqual([]);
  });

  it("names the saved-things switch for the kinds SV-20 sends to people who kept something", () => {
    expect(PREFERENCE_GROUPS.find((g) => g.title === "Saved things")?.rows[0].key).toBe("saved_changed");
  });
});
