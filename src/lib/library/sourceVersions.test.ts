// SV-19 P2: what became of a saved item's source. The claims: a source edited after the save reads Edited; a source that is
// deleted or unpublished reads Removed while the snapshot stays; moving a node is not an edit (the database's rule, tested in the
// migration test); a read that hit its cap never says Removed; the version switch marks the lines only one side has.

import { describe, expect, it } from "vitest";

import { contentLines, diffLines, sourceRows, statusOf, versionOf, type StampRow } from "./sourceVersions";

const row = (id: string, updated_at: string | null, extra: Partial<StampRow> = {}): StampRow => ({ id, build_id: "b1", parent_id: null, type: "prompt", updated_at, session: null, import_session: null, ...extra });
const item = (over: Partial<{ kind: "step" | "part" | "session" | "request"; ref: string | null; buildId: string | null; sourceVersion: string | null }> = {}) => ({
  kind: "step" as const,
  ref: "n1",
  buildId: "b1",
  sourceVersion: "2026-10-12T09:00:00+00:00",
  ...over,
});

describe("statusOf", () => {
  it("reads Edited when the source's version is newer than the one saved", () => {
    expect(statusOf(item(), [row("n1", "2026-10-23T09:00:00+00:00")], true)).toEqual({ state: "edited", version: "2026-10-23T09:00:00+00:00" });
  });

  it("reads Same when the version is the one saved, or older", () => {
    expect(statusOf(item(), [row("n1", "2026-10-12T09:00:00+00:00")], true).state).toBe("same");
    expect(statusOf(item(), [row("n1", "2026-09-01T09:00:00+00:00")], true).state).toBe("same");
  });

  it("reads Same for an item saved before versions existed (no recorded version)", () => {
    expect(statusOf(item({ sourceVersion: null }), [row("n1", "2026-10-23T09:00:00+00:00")], true).state).toBe("same");
  });

  it("reads Removed when the node is gone from a build that was read in full", () => {
    expect(statusOf(item(), [row("other", "2026-10-23T09:00:00+00:00")], true)).toEqual({ state: "removed", version: null });
  });

  it("reads Removed when the build is gone (the item has no build) or can't be read (no rows at all)", () => {
    expect(statusOf(item({ buildId: null }), null, true).state).toBe("removed");
    expect(statusOf(item(), [], true).state).toBe("removed");
  });

  it("never says Removed from a read that was cut at its cap", () => {
    expect(statusOf(item(), [row("other", null)], false).state).toBe("same");
  });

  it("has nothing to say about a kind with no tile as its source", () => {
    expect(statusOf(item({ kind: "request" }), [], true)).toEqual({ state: "same", version: null });
  });
});

describe("versionOf", () => {
  it("is a part's newest stamp across its subtree, and ignores tiles outside it", () => {
    const rows = [
      row("p", "2026-10-01T00:00:00+00:00", { type: "agent" }),
      row("c", "2026-10-05T00:00:00+00:00", { parent_id: "p" }),
      row("g", "2026-10-09T00:00:00+00:00", { parent_id: "c" }),
      row("x", "2026-10-30T00:00:00+00:00"),
    ];
    expect(versionOf("part", "p", rows)).toBe("2026-10-09T00:00:00+00:00");
    expect(sourceRows("part", "p", rows).map((r) => r.id)).toEqual(["p", "c", "g"]);
  });

  it("is a session's newest prompt tile, found by either of the two ways a tile names its session", () => {
    const rows = [row("a", "2026-10-02T00:00:00+00:00", { session: "s1" }), row("b", "2026-10-04T00:00:00+00:00", { import_session: "s1" }), row("c", "2026-10-08T00:00:00+00:00", { session: "s2" })];
    expect(versionOf("session", "s1", rows)).toBe("2026-10-04T00:00:00+00:00");
  });

  it("is null when the column is not there yet", () => {
    expect(versionOf("step", "n1", [row("n1", null)])).toBeNull();
  });
});

describe("the version switch", () => {
  it("marks the lines only one side has: removed on the saved side, added on the current", () => {
    const { saved, current } = diffLines(["Title", "Summarise the call", "Model: Opus"], ["Title", "Summarise the call in three lines", "Model: Opus"]);
    expect(saved).toEqual([{ text: "Title" }, { text: "Summarise the call", change: "removed" }, { text: "Model: Opus" }]);
    expect(current).toEqual([{ text: "Title" }, { text: "Summarise the call in three lines", change: "added" }, { text: "Model: Opus" }]);
  });

  it("marks nothing when the two are the same", () => {
    const { saved, current } = diffLines(["a", "b"], ["a", "b"]);
    expect([...saved, ...current].some((line) => line.change)).toBe(false);
  });

  it("reads a step's title, text, model and note, leaving out what is empty", () => {
    expect(contentLines({ title: "Notes", payload: { text: "One\n\nTwo", model: "opus" }, note: null })).toEqual(["Notes", "One", "Two", "Model: opus"]);
  });
});
