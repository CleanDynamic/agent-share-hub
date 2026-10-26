// SV-05 P1: the numbering is usable outside the composer: the build page (and OpenBuilds, the Maps view, stored counts)
// imports it from `src/lib/build/` without the composer's chunk, and reads the same numbers the composer shows.

import { describe, expect, it } from "vitest";

import { buildSteps, sessionGroups, shownGroups } from "@/lib/build/graph";
import { numberSessions } from "@/lib/build/sessionNumbers";

describe("the build page's session numbers", () => {
  it("match the composer's for the same build", () => {
    const node = (id: string, position: number, session: string) => ({ id, build_id: "b", parent_id: null, position, type: "prompt", title: null, note: null, payload: { text: id, session }, source_ref: null, is_gap: false, event_id: null, created_at: "" });
    const steps = buildSteps([node("n1", 0, "typed-a"), node("n2", 1, "typed-b")] as never[]);
    const meta = { "typed-a": { tool: "claude", date: "2026-10-01" }, "typed-b": { tool: "claude", date: "2026-10-02" } };
    const order = ["typed-b", "imported", "typed-a"];
    const page = shownGroups(sessionGroups(steps, [], {}, meta, order)).map((group) => [group.key, group.number]);
    const direct = numberSessions([{ key: "typed-a", firstTile: 0 }, { key: "typed-b", firstTile: 1 }, { key: "imported", firstTile: null }], order);
    expect(page).toEqual([...direct.numberOf.entries()]);
    expect(page).toEqual([["typed-b", 1], ["imported", 2], ["typed-a", 3]]);
  });
});
