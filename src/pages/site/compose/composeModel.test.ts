import { describe, expect, it } from "vitest";

import type { BuildNode, NodeTree } from "@/lib/build/types";

import {
  addPromptLabel,
  addSessionLabel,
  addedToast,
  applyNodeWrites,
  madeWithChips,
  missingForPublish,
  missingList,
  parseAmount,
  parseAudience,
  parsePromptDragData,
  promptDragData,
  promptSourceLine,
  publishToast,
  saveState,
  sessionAddedToast,
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

/* ── UI-P48 ── */

const IMPORT_1 = "11111111-0000-4000-8000-000000000001";
const IMPORT_2 = "22222222-0000-4000-8000-000000000002";
const SESSIONS = [
  { id: IMPORT_1, client: "claude-code", modelName: "Sonnet 5.5" },
  { id: IMPORT_2, client: "claude", modelName: null },
];

describe("the prompts' words", () => {
  it("names where a prompt came from", () => {
    const from = (importId: string, model?: string) => ({
      payload: model ? { text: "x", model } : { text: "x" },
      source_ref: { source: "transcript", session_id: "p", index: 2, import_session_id: importId },
    });
    expect(promptSourceLine(from(IMPORT_1), SESSIONS)).toBe("Session 1 · Sonnet 5.5");
    // No model yet: the client, as the session's head names it.
    expect(promptSourceLine(from(IMPORT_2), SESSIONS)).toBe("Session 2 · Claude");
    expect(promptSourceLine({ payload: { text: "x" }, source_ref: null }, SESSIONS)).toBe("Written by you");
    expect(promptSourceLine(from("gone", "Opus 5.5"), SESSIONS)).toBe("From a session · Opus 5.5");
  });

  it("labels + with the first 60 characters, on one line", () => {
    const text = "Build me a script that renames photos by the date they were taken.\nKeep the original name in brackets.";
    expect(addPromptLabel(text)).toBe("Add to prompts: Build me a script that renames photos by the date they were");
    expect(addPromptLabel("Short.")).toBe("Add to prompts: Short.");
    expect(addedToast(3)).toBe("Added as prompt 3.");
  });

  it("labels a waiting session's + with its first prompt, 60 characters on one line", () => {
    const text = "Build me a script that renames photos by the date they were taken.\nKeep the original name in brackets.";
    expect(addSessionLabel(text)).toBe("Add to this build: Build me a script that renames photos by the date they were");
    expect(addSessionLabel("  Short.  ")).toBe("Add to this build: Short.");
  });

  it("carries an import and an ordinal through a drag, and nothing else", () => {
    expect(parsePromptDragData(promptDragData(IMPORT_1, 4))).toEqual({ importId: IMPORT_1, ordinal: 4 });
    expect(parsePromptDragData("https://example.com:443")).toBeNull();
    expect(parsePromptDragData("some text the maker selected")).toBeNull();
    expect(parsePromptDragData("")).toBeNull();
  });
});

describe("the session added toast", () => {
  it("names the model the refresh put under Made with", () => {
    expect(sessionAddedToast({ modelName: "Sonnet 5.5", client: "claude-code" }, [])).toBe("Session added. Sonnet 5.5 is now under Made with.");
  });

  it("names the tool when the model is left out or not known, and nothing when neither is", () => {
    expect(sessionAddedToast({ modelName: "Sonnet 5.5", client: "claude-code" }, ["sonnet 5.5"])).toBe("Session added. Claude Code is now under Made with.");
    expect(sessionAddedToast({ modelName: null, client: "cursor" }, [])).toBe("Session added. Cursor is now under Made with.");
    expect(sessionAddedToast({ modelName: null, client: "web" }, [])).toBe("Session added.");
  });
});

describe("madeWithChips", () => {
  it("draws one chip per session, deduplicated, then what was typed by hand", () => {
    const chips = madeWithChips(
      [
        { client: "claude-code", modelName: "Sonnet 5.5" },
        { client: "claude-code", modelName: "Sonnet 5.5" },
        { client: "claude", modelName: "Opus 5.5" },
        { client: "cursor", modelName: null },
        { client: "web", modelName: null },
      ],
      { madeWith: ["Claude Code", "Sonnet 5.5", "Claude", "Cursor", "Midjourney"], excluded: ["Opus 5.5"] },
    );
    expect(chips.map((chip) => [chip.label, chip.kind, chip.on])).toEqual([
      ["Claude Code · Sonnet 5.5", "model", true],
      ["Claude · Opus 5.5", "model", false],
      ["Cursor", "tool", true],
      ["Midjourney", "entry", true],
    ]);
  });

  it("knows a model typed under another spelling", () => {
    const chips = madeWithChips([{ client: "claude-code", modelName: "Sonnet 5.5" }], { madeWith: ["claude-sonnet-5-5"], excluded: [] });
    expect(chips.map((chip) => chip.label)).toEqual(["Claude Code · Sonnet 5.5"]);
  });
});

describe("applyNodeWrites", () => {
  const node = (id: string, position: number, over: Partial<NodeTree> = {}): NodeTree =>
    ({ id, build_id: "b", parent_id: null, position, type: "prompt", title: null, note: null, payload: { text: id }, source_ref: null, event_id: null, is_gap: false, created_at: "", children: [], ...over }) as NodeTree;
  const row = (tree: NodeTree): BuildNode => {
    const { children: _children, ...rest } = tree;
    return rest;
  };

  it("returns the same tree when there is nothing to lay over, or nothing differs", () => {
    const tree = [node("a", 1), node("b", 2)];
    expect(applyNodeWrites(tree, new Map())).toBe(tree);
    expect(applyNodeWrites(tree, new Map([["a", row(node("a", 1))]]))).toBe(tree);
  });

  it("adds a node the tree has not read yet, drops a deleted one, and keeps position order", () => {
    const tree = [node("cover", 1, { type: "screenshot" }), node("a", 2), node("b", 3)];
    const next = applyNodeWrites(
      tree,
      new Map<string, BuildNode | null>([
        ["b", null],
        ["c", row(node("c", 4))],
        ["a", row(node("a", 5))],
      ]),
    );
    expect(next.map((n) => `${n.id}@${n.position}`)).toEqual(["cover@1", "c@4", "a@5"]);
  });
});

describe("parseAmount", () => {
  it("is null for blank, a number when it is one, and undefined while it is not", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount(" 18.40 ")).toBe(18.4);
    expect(parseAmount("0")).toBe(0);
    expect(parseAmount("-3")).toBeUndefined();
    expect(parseAmount("abc")).toBeUndefined();
    expect(parseAmount("12.6", { whole: true })).toBe(13);
  });
});
