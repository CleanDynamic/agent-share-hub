import { describe, expect, it } from "vitest";

import {
  missingForPublish,
  missingList,
  parseAudience,
  publishToast,
  saveState,
  UNTITLED,
} from "./composeModel";

const missing = (...keys: string[]) => ({ missing: keys.map((key) => ({ key, copy: "" })) }) as never;

describe("missingForPublish", () => {
  it("is everything before the draft exists", () => {
    expect(missingForPublish({ title: "", completeness: null })).toEqual([
      "evidence",
      "title",
      "outcome",
      "instruction_or_artefact",
    ]);
  });

  it("keeps the canvas's order, whatever order the registry reports", () => {
    const keys = missingForPublish({
      title: "",
      completeness: missing("instruction_or_artefact", "outcome", "evidence"),
    });
    expect(keys).toEqual(["evidence", "title", "outcome", "instruction_or_artefact"]);
    expect(publishToast(keys)).toBe("To publish, add a cover picture or video, a title, a description, a prompt.");
  });

  it("counts an untitled title as missing, and a real one as present", () => {
    expect(missingForPublish({ title: UNTITLED, completeness: missing() })).toEqual(["title"]);
    expect(missingForPublish({ title: "   ", completeness: missing() })).toEqual(["title"]);
    expect(missingForPublish({ title: "Photo renamer", completeness: missing() })).toEqual([]);
  });

  it("ignores requirements that do not gate publishing", () => {
    expect(missingForPublish({ title: "A", completeness: missing("made_for", "cost", "link") })).toEqual([]);
  });
});

describe("missingList", () => {
  it("joins with commas", () => {
    expect(missingList(["title", "outcome"])).toBe("a title, a description");
  });
});

describe("parseAudience", () => {
  it("trims, drops blanks, deduplicates and stops at four", () => {
    expect(parseAudience(" photographers ,, families, Photographers , a, b, c")).toEqual([
      "photographers",
      "families",
      "a",
      "b",
    ]);
  });

  it("is empty for nothing", () => {
    expect(parseAudience(" , ")).toEqual([]);
  });
});

describe("saveState", () => {
  const now = new Date();
  it("reads an error before a save in flight, and a save before a rest", () => {
    expect(saveState({ isSaving: true, saveError: new Error("x"), lastSavedAt: now })).toBe("error");
    expect(saveState({ isSaving: true, saveError: null, lastSavedAt: now })).toBe("saving");
    expect(saveState({ isSaving: false, saveError: null, lastSavedAt: now })).toBe("saved");
    expect(saveState({ isSaving: false, saveError: null, lastSavedAt: null })).toBe("idle");
  });
});
