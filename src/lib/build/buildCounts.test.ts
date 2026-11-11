// SV-23 P1: the stored counts are the composer's own, and a write is owed only when one differs from the row's.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { partsBuild, partsMaking, partsTree } from "@/dev/fixtures/parts";

import { countsToWrite, heldCountsOf, storedCountsOf } from "./buildCounts";
import { buildMapOf } from "./buildsMaps";
import { flattenTree } from "./buildsMapsTestSupport";
import { buildSteps, madeFileNamesOf, madeFilesOf, sessionGroups, type SessionGroup, type Step } from "./graph";
import { sessionOrderOf, sessionsMetaOf, storedWorkstreamsOf } from "./making";
import { sessionMapFor } from "./sessionMap";

const step = (number: string, kind: Step["kind"], children: Step[] = []): Step => ({ number, kind, children }) as unknown as Step;
const group = (key: string, implicit = false): SessionGroup => ({ key, kind: "import", implicit, sessionId: key, number: 1, tool: null, model: null, startedAt: null, stepNumbers: [] }) as SessionGroup;

describe("storedCountsOf", () => {
  it("counts top-level steps, agents anywhere, parts, and the sessions the composer shows", () => {
    const steps = [step("1", "prompt"), step("2", "team", [step("2.1", "agent"), step("2.2", "agent")]), step("3", "agent"), step("4", "code")];
    const counts = storedCountsOf(steps, [group("a"), group("b"), group("implicit", true)], [{ key: "p1" }, { key: "p2" }]);
    expect(counts).toEqual({ step_count: 4, part_count: 2, agent_count: 3, session_count: 2 });
  });
});

describe("countsToWrite", () => {
  const counts = { step_count: 4, part_count: 1, agent_count: 0, session_count: 2 };

  it("writes every count to a build that was never counted", () => {
    expect(countsToWrite(counts, { step_count: null, part_count: null, agent_count: null, session_count: 0 })).toEqual(counts);
  });

  it("writes only what differs", () => {
    expect(countsToWrite(counts, { ...counts, step_count: 3 })).toEqual({ step_count: 4 });
  });

  it("writes nothing when the row already holds them", () => {
    expect(countsToWrite(counts, counts)).toBeNull();
  });

  it("writes nothing for an empty build that was never counted, and zeros for a counted build that was emptied", () => {
    const zero = { step_count: 0, part_count: 0, agent_count: 0, session_count: 0 };
    expect(countsToWrite(zero, { step_count: null, part_count: null, agent_count: null, session_count: 0 })).toBeNull();
    expect(countsToWrite(zero, { ...counts, agent_count: 2 })).toEqual({ step_count: 0, part_count: 0, agent_count: 0, session_count: 0 });
  });

  it("reads a row defensively", () => {
    expect(heldCountsOf(null)).toEqual({ step_count: null, part_count: null, agent_count: null, session_count: null });
    expect(heldCountsOf({ step_count: "3", session_count: 2 }).step_count).toBeNull();
  });
});

/* ── BF-03 P3 (D3) ── */

describe("the stored session count and the Map", () => {
  /** The fixture builds the Maps read tests use: the parts build (`buildsMaps.test.ts`) and a build with nothing in it. */
  const builds = [
    { name: "the parts build", making: partsMaking, nodes: flattenTree(partsTree) },
    { name: "an empty build", making: {}, nodes: [] },
  ];

  it("the stored session count equals the Map's session count", () => {
    for (const build of builds) {
      const { steps, groups, making, tree } = build.making === partsMaking ? partsBuild() : { steps: [], groups: [], making: {}, tree: [] };
      const files = [...madeFilesOf(tree)].map(([id, madeBy]) => ({ id, name: madeFileNamesOf(tree).get(id) ?? "", madeBy }));
      const map = sessionMapFor({ groups, steps, files, making });
      expect(storedCountsOf(steps, groups, storedWorkstreamsOf(making)).session_count, build.name).toBe(map.sessions.length);
      // The page's own read draws the same number of boxes.
      expect(buildMapOf({ id: build.name, making: build.making, build_nodes: build.nodes as never }).model?.sessions.length ?? 0, build.name).toBe(map.sessions.length);
    }
  });

  /* THE KNOWN DIFFERENCE (A4). Both counts are `shownGroups(groups).length`; what differs is the order they are given. The writer
     (buildCountsWrite, and the composer) numbers by the build_sessions rows when there are any; the Map read passes
     `making.session_order` only. `sessionGroups` opens a session for every key the order holds, so a session the table has, with no
     tile yet and missing from `making.session_order`, is counted by the writer and not drawn on the Map. Neither function changes. */
  it("known difference: a session only the build_sessions table holds is counted by the writer and not drawn on the Map", () => {
    const steps = buildSteps(partsTree);
    const args = [steps, partsMaking.sessions, partsMaking.session_tools ?? {}, sessionsMetaOf(partsMaking)] as const;
    const parts = storedWorkstreamsOf(partsMaking);
    const mapGroups = sessionGroups(...args, sessionOrderOf(partsMaking), parts);
    const tableOrder = [...sessionOrderOf(partsMaking), "import-only-in-the-table"];
    const writerGroups = sessionGroups(...args, tableOrder, parts);
    const drawn = sessionMapFor({ groups: mapGroups, steps, making: partsMaking }).sessions.length;
    expect(storedCountsOf(steps, writerGroups, parts).session_count).toBe(drawn + 1);
  });
});
