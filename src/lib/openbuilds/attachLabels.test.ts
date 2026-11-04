// UX-05 Part 4: how the attach picker names work, and its groups.

import { beforeEach, describe, expect, it, vi } from "vitest";

const answers: Record<string, unknown[]> = {};
vi.mock("./types", async (importOriginal) => {
  const original = await importOriginal<typeof import("./types")>();
  const chain = (table: string) => {
    const query: Record<string, unknown> = {};
    for (const method of ["select", "in", "is", "order", "eq", "limit"]) query[method] = () => query;
    query.then = (resolve: (value: unknown) => void) => resolve({ data: answers[table] ?? [], error: null });
    return query;
  };
  return { ...original, db: { from: (table: string) => chain(table) } };
});

import type { AttachableWork } from "./attachable";
import { groupAttachable, labelAttachable } from "./attachLabels";

const work = (extra: Partial<AttachableWork>): AttachableWork => ({ size: "step", origin: "published", buildId: "b1", buildTitle: "Resume screener", nodeId: "n2", partKey: null, sessionKey: null, title: "Rubric", makerId: "me", ...extra });
const node = (id: string, position: number, type: string, session: string | null = null) => ({ id, build_id: "b1", parent_id: null, type, title: id, position, tested: null, setup: null, step: null, session });

beforeEach(() => {
  for (const key of Object.keys(answers)) delete answers[key];
  answers.build_nodes = [node("n1", 0, "prompt", "s-a"), node("n2", 1, "code"), node("n3", 2, "prompt", "s-b")];
  answers.builds = [{ id: "b1", making: { sessions_meta: { "s-a": { tool: "claude-code" }, "s-b": { tool: "claude-code" } } } }];
  answers.profiles = [{ id: "kit", username: "kit" }];
});

describe("labelAttachable", () => {
  it("names published work as the reader does: Step 2 · Code · Rubric, with the build at the right", async () => {
    const [labelled] = await labelAttachable([work({})]);
    expect(labelled).toMatchObject({ label: "Step 2 · Code · Rubric", context: "Resume screener" });
  });

  it("names a draft prompt as the composer does: Prompt 3 · Session 2 · Scorer split", async () => {
    const [labelled] = await labelAttachable([work({ origin: "draft", nodeId: "n3", title: "Scorer split" })]);
    expect(labelled.label).toBe("Prompt 3 · Session 2 · Scorer split");
  });

  it("credits another person's work: @kit · Resume screener", async () => {
    const [labelled] = await labelAttachable([work({ size: "build", origin: "others", nodeId: null, title: "Resume screener", makerId: "kit" })]);
    expect(labelled.label).toBe("@kit · Resume screener");
  });

  it("names a session by its place", async () => {
    const [labelled] = await labelAttachable([work({ size: "session", nodeId: null, sessionKey: "s-b", title: "" })]);
    expect(labelled.label).toBe("Session 2 · Claude Code");
  });

  it("reads nothing for nothing", async () => {
    expect(await labelAttachable([])).toEqual([]);
  });
});

describe("groupAttachable", () => {
  it("orders the groups and leaves out an empty one, so an opted-out build's group is absent when nothing came back", () => {
    const groups = groupAttachable([work({ origin: "published" }), work({ origin: "draft" }), work({ origin: "earlier_post" })]);
    expect(groups.map((group) => group.title)).toEqual(["Your drafts", "Your published builds", "Your posts and replies"]);
    expect(groups.map((group) => group.title)).not.toContain("Other people's");
  });
});
