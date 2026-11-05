// UX-09 Part 4: Library's Used in counts the topics that attach a saved step, beside the builds, from the one request.

import { describe, expect, it } from "vitest";

import { usesTotal } from "@/lib/library/savedItems";

import { savedItemRow, usedInWords } from "./libraryModel";

const step = { id: "si-1", kind: "step", buildId: "b1", ref: "n1", snapshot: {}, note: null, savedAt: "2026-11-01T00:00:00Z", lastUsedAt: "2026-11-01T00:00:00Z", sourceVersion: null } as unknown as Parameters<typeof savedItemRow>[0];

describe("UX-09 P4: Used in", () => {
  it("a step attached to a reply raises the row's Used in by one", () => {
    const before = savedItemRow(step, usesTotal(new Map([["si-1", { builds: 2, topics: 0 }]])), Date.parse("2026-11-05T00:00:00Z"));
    const after = savedItemRow(step, usesTotal(new Map([["si-1", { builds: 2, topics: 1 }]])), Date.parse("2026-11-05T00:00:00Z"));
    expect(before.usedIn).toBe(2);
    expect(after.usedIn).toBe(3);
  });

  it("the detail names builds and topics apart", () => {
    expect(usedInWords({ builds: 2, topics: 0 })).toBe("2 builds");
    expect(usedInWords({ builds: 1, topics: 1 })).toBe("1 build · 1 topic");
    expect(usedInWords({ builds: 0, topics: 3 })).toBe("0 builds · 3 topics");
    expect(usedInWords(undefined)).toBe("0 builds");
  });
});
