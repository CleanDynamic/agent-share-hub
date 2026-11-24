import { describe, expect, it } from "vitest";

import { isHiddenNotification } from "./hidden";

describe("isHiddenNotification", () => {
  it("hides the kinds that are about XP or a level, whichever way they are written", () => {
    for (const kind of ["xp", "xp_awarded", "level_up", "level_earned", "depth_unlocked"]) {
      expect(isHiddenNotification({ kind }), kind).toBe(true);
      expect(isHiddenNotification({ notification_type: kind }), kind).toBe(true);
    }
  });

  it("hides a system notification whose sub says a level was earned", () => {
    expect(isHiddenNotification({ kind: "system", metadata: { sub: "level_earned", level: "builder" } })).toBe(true);
  });

  it("keeps every other notification", () => {
    for (const kind of ["rebuilt", "published", "comment", "reply", "like", "follow", "post_reply", "mention", "system", "new_message", "streak_saved"]) {
      expect(isHiddenNotification({ kind }), kind).toBe(false);
    }
    expect(isHiddenNotification({ kind: "system", metadata: { sub: "welcome" } })).toBe(false);
    expect(isHiddenNotification({ kind: "like", metadata: null })).toBe(false);
  });
});
