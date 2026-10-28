// SV-15: the Library's changes list is the saved builds' share of the shared activity events.

import { describe, expect, it } from "vitest";

import type { ActivityEvent } from "@/lib/feed/activity";

import { changesFigure, libraryChanges } from "./libraryModel";

const now = Date.parse("2026-10-28T12:00:00.000Z");
const base = { buildId: "b1", buildSlug: "s", buildTitle: "Account research brief", at: "2026-10-28T07:00:00.000Z" };
const kit = { id: "u2", handle: "kit", name: "Kit" };

describe("libraryChanges", () => {
  const events: ActivityEvent[] = [
    { ...base, id: "run:1", kind: "run", role: "saver", runner: kit, worked: true, model: "Opus 5.5", note: null },
    { ...base, id: "run:2", kind: "run", role: "maker", runner: kit, worked: true, model: null, note: null },
    { ...base, id: "stale:b1", kind: "stale", role: "saver" },
  ];

  it("keeps only the saved builds' events and words them for the list", () => {
    expect(libraryChanges(events, now)).toEqual([
      { id: "run:1", tag: "RUN", item: "Account research brief", detail: "worked on Opus 5.5 · @kit", age: "5h" },
      { id: "stale:b1", tag: "STALE", item: "Account research brief", detail: "not confirmed in a while", age: "5h" },
    ]);
  });

  it("counts them for the figure", () => {
    expect(changesFigure(libraryChanges(events, now))).toEqual({
      figure: "2 changes",
      parts: [{ text: "Last 14 days" }, { text: "1 run", tone: "evidence" }, { text: "1 out of date", tone: "lit" }],
    });
  });
});
