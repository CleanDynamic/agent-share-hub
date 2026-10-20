// CA-05 P1 — the words a reader changes in the steps, the three copies and the writes.

import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertNode = vi.fn();
vi.mock("./nodes", () => ({ upsertNode: (...a: unknown[]) => upsertNode(...a), getNodeTree: vi.fn(), reorderNodes: vi.fn(), deleteNode: vi.fn() }));

import { copyTogether } from "./copyTogether";
import { savePromptText, setPromptChanges } from "./composePrompts";
import { buildSteps } from "./graph";
import { readerSteps, stepsMarkdown } from "./readerSteps";
import type { BuildNode, NodeTree } from "./types";

const TEXT = "Write a welcome email for Ada's Bakery.";
const START = TEXT.indexOf("Ada's Bakery");
const node = (id: string, type: string, payload: Record<string, unknown>, position: number, children: NodeTree[] = []): NodeTree =>
  ({ id, build_id: "b", parent_id: null, position, type, title: null, note: null, payload, source_ref: null, event_id: null, is_gap: false, created_at: "", children }) as NodeTree;
const tree = (): NodeTree[] => [
  node("p1", "prompt", { text: TEXT, session: "typed-a", changes: [{ start: START, end: START + 12 }] }, 1, [node("c1", "code", { source: "x", language: "ts", filename: "a.ts" }, 1)]),
  node("p2", "prompt", { text: "No change here.", session: "typed-a" }, 2),
];

beforeEach(() => {
  upsertNode.mockReset();
  upsertNode.mockImplementation(async (row: unknown) => row);
});

describe("the three copies", () => {
  it("reads changes onto a prompt only when it has some", () => {
    const [one, two] = buildSteps(tree());
    expect(one.changes).toEqual([{ start: START, end: START + 12 }]);
    expect(two.changes).toBeUndefined();
  });
  it("Copy together puts them in square brackets", () => {
    const [one] = buildSteps(tree());
    expect(copyTogether(one)).toContain("Write a welcome email for [Ada's Bakery].");
  });
  it("Copy for AI puts them in square brackets", () => {
    const steps = readerSteps(tree(), null);
    const markdown = stepsMarkdown({ title: "T" }, steps);
    expect(markdown).toContain("for [Ada's Bakery].");
    expect(markdown).toContain("No change here.");
  });
});

describe("the writes", () => {
  const row = (payload: Record<string, unknown>): BuildNode => ({ ...tree()[0], payload, children: undefined }) as unknown as BuildNode;
  it("setPromptChanges writes ranges, joined, and takes the key off when none are left", async () => {
    await setPromptChanges(row({ text: TEXT }), [{ start: 8, end: 15 }, { start: 12, end: 20 }]);
    expect(upsertNode.mock.calls[0][0].payload).toEqual({ text: TEXT, changes: [{ start: 8, end: 20 }] });
    await setPromptChanges(row({ text: TEXT, changes: [{ start: 8, end: 15 }] }), []);
    expect(upsertNode.mock.calls[1][0].payload).toEqual({ text: TEXT });
  });
  it("savePromptText keeps the ranges where the words moved to", async () => {
    await savePromptText(row({ text: TEXT, changes: [{ start: START, end: START + 12 }] }), `Please. ${TEXT}`);
    const [saved] = upsertNode.mock.calls[0][0].payload.changes;
    expect(`Please. ${TEXT}`.slice(saved.start, saved.end)).toBe("Ada's Bakery");
  });
});
