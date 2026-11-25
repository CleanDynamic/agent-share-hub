import { describe, expect, it } from "vitest";

import type { ChecklistItem } from "@/lib/build/publishChecklist";

import { PHONE_EDITOR_COPY, clampZoom, fitScale, foldOnArrival, layoutPhoneMap, MAP_NODE, notReadyRows, phoneCountsLine, phoneNoticeWords } from "./phoneEditorModel";

const item = (key: string, done: boolean, stepId: string | null = null, detail: string | null = null): ChecklistItem => ({ key, section: "required", done, words: key, detail, stepId });

describe("prompt 23: the phone editor's model", () => {
  it("says a removal the phone's way, and leaves other sentences alone", () => {
    expect(phoneNoticeWords("Removed Prompt 5")).toBe("Prompt 5 removed");
    expect(phoneNoticeWords("Removed Team 11 and its 3 agents")).toBe("Team 11 and its 3 agents removed");
    expect(phoneNoticeWords("Removed Session 2. Its steps moved to Session 1")).toBe("Removed Session 2. Its steps moved to Session 1");
    expect(phoneNoticeWords("Duplicated Prompt 2")).toBe("Duplicated Prompt 2");
  });

  it("joins the counts with slashes", () => {
    expect(phoneCountsLine({ sessions: 2, prompts: 4, files: 1 })).toBe("2 sessions / 4 prompts / 1 file");
    expect(phoneCountsLine({ sessions: 1, prompts: 0, files: 0 })).toBe("1 session");
  });

  it("lists the open items, required first, with the step's number", () => {
    const rows = notReadyRows(
      { required: [item("title", true), item("blocker-0", false, "s5", "Not set: Response, Variables, Time it took.")], recommended: [item("cover", false)] },
      (id) => (id === "s5" ? "5" : null),
    );
    expect(rows.map((row) => [row.key, row.number, row.needs])).toEqual([
      ["blocker-0", "5", "Not set: Response, Variables, Time it took."],
      ["cover", null, null],
    ]);
  });

  it("folds every session but the one holding the chosen step", () => {
    const sessions = [
      { key: null, tiles: ["loose"] },
      { key: "a", tiles: ["1", "2"] },
      { key: "b", tiles: ["3"] },
      { key: "c", tiles: [] },
    ];
    expect(foldOnArrival(sessions, "3")).toEqual(["a", "c"]);
    expect(foldOnArrival(sessions, null)).toEqual(["b", "c"]);
    expect(foldOnArrival([{ key: "a", tiles: ["1"] }], "1")).toEqual([]);
  });

  it("lays sessions out in columns and links each step to the next", () => {
    const map = layoutPhoneMap({
      sessions: [
        { key: "a", number: 1, steps: [{ id: "1", number: "1", kind: "prompt", title: "One" }, { id: "2", number: "2", kind: "prompt", title: "Two" }] },
        { key: "b", number: 2, steps: [{ id: "3", number: "3", kind: "code", title: "Three" }] },
      ],
    });
    expect(map.nodes.map((node) => [node.id, node.x, node.y])).toEqual([
      ["1", MAP_NODE.pad, MAP_NODE.pad],
      ["2", MAP_NODE.pad, MAP_NODE.pad + MAP_NODE.row],
      ["3", MAP_NODE.pad + MAP_NODE.column, MAP_NODE.pad],
    ]);
    expect(map.links.map((link) => `${link.from}>${link.to}`)).toEqual(["1>2", "2>3"]);
    expect(map.width).toBe(MAP_NODE.pad * 2 + MAP_NODE.column + MAP_NODE.width);
  });

  it("fits and clamps the zoom", () => {
    expect(fitScale({ width: 800, height: 200 }, { width: 400, height: 400 })).toBe(0.5);
    expect(fitScale({ width: 100, height: 100 }, { width: 400, height: 400 })).toBe(1);
    expect(clampZoom(5)).toBe(2);
    expect(clampZoom(0.1)).toBe(0.25);
  });

  it("has no em dashes or exclamation marks in its words", () => {
    const words = Object.values(PHONE_EDITOR_COPY).map((value) => (typeof value === "function" ? (value as (arg: never) => string)(2 as never) : value));
    for (const line of words) {
      expect(line).not.toMatch(/\u2014|!/);
    }
  });
});
