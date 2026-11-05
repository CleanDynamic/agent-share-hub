// UX-09: every kind the database writes through rc_notify has a stable key in NOTIFICATION_KEYS, and the list holds nothing else.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUILD_NOTIFICATION_KINDS } from "./types";
import { POST_NOTIFICATION_MESSAGES } from "./resolveTarget";
import { NOTIFICATION_KEYS, isNotificationKey } from "./keys";

const DIR = "supabase/migrations";

/** The kind literal of every rc_notify(recipient, actor, 'kind', ...) and rc_notify_savers(build, actor, 'kind', ...) call. */
function kindsWritten(): Set<string> {
  const kinds = new Set<string>();
  for (const file of readdirSync(DIR).filter((name) => name.endsWith(".sql"))) {
    const text = readFileSync(`${DIR}/${file}`, "utf8").replace(/--[^\n]*/g, "");
    for (const match of text.matchAll(/PERFORM\s+public\.rc_notify(?:_savers)?\(\s*[^,()]+,\s*[^,()]+,\s*'([a-z_]+)'/g)) kinds.add(match[1]);
  }
  return kinds;
}

describe("NOTIFICATION_KEYS", () => {
  const keys = NOTIFICATION_KEYS.map((entry) => entry.key);

  it("names every kind a migration writes through rc_notify", () => {
    const written = kindsWritten();
    expect(written.size).toBeGreaterThanOrEqual(15);
    expect([...written].filter((kind) => !isNotificationKey(kind))).toEqual([]);
  });

  it("holds only kinds the database writes, each once", () => {
    const written = kindsWritten();
    expect(keys.filter((key) => !written.has(key))).toEqual([]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("agrees with the kinds the Activity page draws", () => {
    for (const kind of [...BUILD_NOTIFICATION_KINDS, ...Object.keys(POST_NOTIFICATION_MESSAGES)]) expect(isNotificationKey(kind)).toBe(true);
  });

  it("keys are lower snake case", () => {
    for (const key of keys) expect(key).toMatch(/^[a-z]+(_[a-z]+)*$/);
  });
});
