// SV-19 P2: Add from Library marks a row whose source was edited or is gone, offers the current version only for an edited one,
// and a Library row and change carry the same words.

import { describe, expect, it } from "vitest";

import type { LibrarySavedItem } from "@/lib/library/savedItems";
import { libraryChanges, savedItemRow } from "@/pages/site/library/libraryModel";

import { rowsFor } from "./libraryWindowModel";

const item = (id: string): LibrarySavedItem => ({
  id,
  kind: "step",
  buildId: "b1",
  ref: `n-${id}`,
  snapshot: { type: "prompt", title: `Step ${id}`, payload: { text: "x" }, source: { buildTitle: "Support bot", makerId: "m1" } },
  sourceVersion: "2026-10-12T09:00:00+00:00",
  note: null,
  savedAt: "2026-10-12T09:00:00+00:00",
  lastUsedAt: "2026-10-12T09:00:00+00:00",
});
const place = { kind: "top", session: "s1", name: "Session 1" } as never;
const sources = new Map([
  ["a", { state: "edited" as const, version: "2026-10-23T09:00:00+00:00" }],
  ["b", { state: "removed" as const, version: null }],
]);

describe("the window's rows", () => {
  it("offers the current version, dated, only for an edited source", () => {
    const { rows } = rowsFor([item("a"), item("b"), item("c")], place, { usedIn: new Map(), handles: new Map(), sources });
    expect(rows.map((r) => [r.id, r.state, r.currentOn])).toEqual([
      ["a", "edited", "23 Oct"],
      ["b", "removed", null],
      ["c", "same", null],
    ]);
  });
});

describe("Library", () => {
  it("draws the same states on its rows", () => {
    expect(savedItemRow(item("a"), new Map(), Date.parse("2026-10-28T00:00:00Z"), sources).state).toBe("edited");
    expect(savedItemRow(item("b"), new Map(), Date.parse("2026-10-28T00:00:00Z"), sources).state).toBe("removed");
    expect(savedItemRow(item("c"), new Map(), Date.parse("2026-10-28T00:00:00Z"), sources).state).toBe("same");
  });

  it("lists an edit and a removal in the changes, naming the saved item", () => {
    const base = { buildId: "b1", buildSlug: "support", buildTitle: "Support bot", role: "saver" as const, at: "2026-10-27T00:00:00.000Z" };
    const rows = libraryChanges(
      [
        { ...base, id: "edited:a", kind: "edited", item: { id: "a", kind: "step", snapshot: { title: "Triage" } } },
        { ...base, id: "removed:b", kind: "removed", item: { id: "b", kind: "step", snapshot: { title: "Old" } } },
      ],
      Date.parse("2026-10-28T00:00:00Z"),
    );
    expect(rows.map((r) => [r.tag, r.item])).toEqual([["EDITED", "Triage"], ["REMOVED", "Old"]]);
  });
});
