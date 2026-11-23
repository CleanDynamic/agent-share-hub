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

  const rebuilt: ActivityEvent = { ...base, id: "rebuild:1", kind: "rebuild", role: "saver", rebuilder: kit } as ActivityEvent;

  it("keeps only the saved builds' events, and leaves out the run-based ones", () => {
    expect(libraryChanges(events, now)).toEqual([]);
    expect(libraryChanges([...events, rebuilt], now)).toEqual([
      { id: "rebuild:1", tag: "REBUILD", item: "Account research brief", detail: "rebuilt by @kit", age: "5h" },
    ]);
  });

  it("counts them for the figure", () => {
    expect(changesFigure(libraryChanges([...events, rebuilt], now))).toEqual({
      figure: "1 change",
      parts: [{ text: "Last 14 days" }, { text: "1 rebuilt" }],
    });
  });
});
