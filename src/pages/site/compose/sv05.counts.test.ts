// SV-05 P2: every count on the page counts every session in the build, a session with no tiles too, and a new session
// takes the next place at the end of its part.

import { describe, expect, it } from "vitest";

import { buildSteps, groupKey, sessionGroups, shownGroups } from "@/lib/build/graph";
import { nextSessionNumber } from "@/lib/build/sessionNumbers";

import { listPartsOf } from "./partsModel";
import { countsLine } from "./SandboxView";
import { sourceSessions } from "./sourcesModel";

type Node = Record<string, unknown>;
const prompt = (id: string, position: number, session: string): Node => ({ id, build_id: "b", parent_id: null, position, type: "prompt", title: null, note: null, payload: { text: id, session }, source_ref: null, is_gap: false, event_id: null, created_at: "" });
const tree = [prompt("n1", 0, "typed-a"), prompt("n2", 1, "typed-b")];
const steps = buildSteps(tree as never[]);

describe("SV-05 P2 · counts include every session", () => {
  const meta = { "typed-a": { tool: "claude", date: "2026-10-10", workstream: "ws-1" }, "typed-b": { tool: "claude", date: "2026-10-11", workstream: "ws-2" }, "imp-1": { tool: null, date: "", workstream: "ws-2" } };
  const workstreams = [{ key: "ws-1" }, { key: "ws-2" }];
  const making = { sessions_meta: meta, workstreams, session_order: ["typed-a", "typed-b", "imp-1"] };
  const groups = sessionGroups(steps, [], {}, meta, making.session_order, workstreams);

  it("a session with no tiles counts in the build line, Sources and its part", () => {
    expect(countsLine({ sessions: shownGroups(groups).length, prompts: 2, files: 0 })).toBe("3 sessions · 2 prompts");
    const rows = sourceSessions(groups, steps);
    expect(rows.map((row) => [row.key, row.number])).toEqual([["typed-a", 1], ["typed-b", 2], ["imp-1", 3]]);
    const parts = listPartsOf(making, groups, "dusk");
    expect(parts?.list.map((part) => part.view.sessions)).toEqual([1, 2]);
  });

  it("an import while such a session exists takes a new number", () => {
    const keys = shownGroups(groups).map(groupKey);
    const next = nextSessionNumber(keys, { meta, workstreams });
    expect(next).toBe(4);
    expect(shownGroups(groups).map((group) => group.number)).not.toContain(next);
  });

  it("adding into Part 1 of two renumbers Part 2", () => {
    const keys = shownGroups(groups).map(groupKey);
    expect(nextSessionNumber(keys, { meta, workstreams }, "ws-1")).toBe(2);
    const added = { ...meta, "typed-new": { tool: null, date: "2026-10-12", workstream: "ws-1" } };
    const after = sessionGroups(steps, [], {}, added, ["typed-a", "typed-new", "typed-b", "imp-1"], workstreams);
    expect(after.map((group) => [groupKey(group), group.number])).toEqual([["typed-a", 1], ["typed-new", 2], ["typed-b", 3], ["imp-1", 4]]);
  });
});
