import { describe, expect, it } from "vitest";

import type { Build, NodeTree, NodeType } from "@/lib/build";

import {
  coverNodeFor,
  galleryWords,
  missingKeys,
  missingWords,
  nextTopPosition,
  parseAudience,
  publishBlockedLine,
  saveWords,
} from "./composeModel";

const nodeTypes = [
  { key: "screenshot", category: "evidence" },
  { key: "recording", category: "evidence" },
  { key: "prompt", category: "instruction" },
] as unknown as NodeType[];

const build = (patch: Partial<Build> = {}) =>
  ({
    title: "",
    shape: "other",
    outcome: null,
    made_for: [],
    made_with: [],
    cost_setup: null,
    cost_monthly: null,
    time_to_first_result: null,
    live_url: null,
    repo_url: null,
    ...patch,
  }) as unknown as Build;

const node = (id: string, type: string, position: number | null, payload: unknown = {}, parent_id: string | null = null) =>
  ({ id, type, position, parent_id, payload, children: [] }) as unknown as NodeTree;

describe("what a publish still needs", () => {
  it("an empty draft needs all four, in the canvas's order", () => {
    const keys = missingKeys(build(), [], nodeTypes);
    expect(missingWords(keys)).toEqual(["a cover picture or video", "a title", "a description", "a prompt"]);
    expect(publishBlockedLine(keys)).toBe("To publish, add a cover picture or video, a title, a description, a prompt.");
  });

  it("'Untitled build' counts as no title, and so does an empty one", () => {
    expect(missingKeys(build({ title: "Untitled build" }), [], nodeTypes)).toContain("title");
    expect(missingKeys(build({ title: "   " }), [], nodeTypes)).toContain("title");
    expect(missingKeys(build({ title: "Photo renamer" }), [], nodeTypes)).not.toContain("title");
  });

  it("a description, a cover node and a prompt node each clear their item", () => {
    const tree = [node("n1", "screenshot", 0, { media_id: "m1" }), node("n2", "prompt", 1)];
    const keys = missingKeys(build({ title: "Photo renamer", outcome: "Renames photos." }), tree, nodeTypes);
    expect(keys).toEqual([]);
  });

  it("a node in the tray (no position) does not count, because the tree is the placed tree", () => {
    // The container passes the placed tree only; an unplaced node is simply not in it.
    expect(missingKeys(build({ title: "T", outcome: "O" }), [], nodeTypes)).toEqual(["evidence", "instruction_or_artefact"]);
  });

  it("ignores items that are not part of the minimum (audience, cost)", () => {
    expect(missingKeys(build({ title: "T", outcome: "O", shape: "app" }), [node("n1", "screenshot", 0), node("n2", "prompt", 1)], nodeTypes)).toEqual([]);
  });
});

describe("the Gallery's words", () => {
  it("reads as nouns after 'once it has'", () => {
    expect(galleryWords([{ key: "made_for", copy: "say who this is for" }])).toBe("an audience");
    expect(
      galleryWords([
        { key: "made_for", copy: "x" },
        { key: "link", copy: "y" },
      ]),
    ).toBe("an audience and a link");
  });
});

describe("Who it's for", () => {
  it("trims, drops empties and repeats, and keeps four", () => {
    expect(parseAudience(" photographers ,families, ,Photographers, designers, writers, makers")).toEqual([
      "photographers",
      "families",
      "designers",
      "writers",
    ]);
    expect(parseAudience("")).toEqual([]);
  });
});

describe("placing a node", () => {
  it("goes after the highest top-level position, and at 0 in an empty tree", () => {
    expect(nextTopPosition([])).toBe(0);
    expect(nextTopPosition([node("a", "screenshot", 0), node("b", "prompt", 3)])).toBe(4);
  });

  it("ignores children when finding the highest", () => {
    expect(nextTopPosition([node("a", "screenshot", 1), node("c", "prompt", 9, {}, "a")])).toBe(2);
  });
});

describe("the cover's node", () => {
  it("is the evidence node whose media is the first picture", () => {
    const tree = [node("p", "prompt", 0, { media_id: "m1" }), node("s", "screenshot", 1, { media_id: "m1" }), node("t", "screenshot", 2, { media_id: "m2" })];
    expect(coverNodeFor(tree, "m1")?.id).toBe("s");
    expect(coverNodeFor(tree, null)).toBeNull();
    expect(coverNodeFor(tree, "m9")).toBeNull();
  });
});

describe("the save words", () => {
  it("says each state", () => {
    expect(saveWords("saving", false)).toBe("saving…");
    expect(saveWords("saved", true)).toBe("saved just now");
    expect(saveWords("failed", false)).toBe("not saved — ");
    expect(saveWords("idle", false)).toBe("");
  });
});
