// SV-23: the counts written away from the composer are the composer's. A session added to a published build (an offer accepted on
// OpenBuilds) or to a draft (Drafts, the upload page) ends in refreshMakingStats, which writes the stored counts with the same
// function; and the admin backfill counts the builds nobody saved since.

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NodeTree } from "./types";

const getNodeTree = vi.fn();
const listBuildSessionRows = vi.fn();
const listBuildSessions = vi.fn();
const updateBuild = vi.fn();
const maybeSingle = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) } }));
vi.mock("./nodes", () => ({ getNodeTree: (...a: unknown[]) => getNodeTree(...a) }));
vi.mock("./buildSessions", () => ({ listBuildSessionRows: (...a: unknown[]) => listBuildSessionRows(...a), orderOf: (rows: { sessionKey: string }[]) => rows.map((row) => row.sessionKey) }));
vi.mock("./sessions", () => ({ listBuildSessions: (...a: unknown[]) => listBuildSessions(...a) }));
vi.mock("./builds", () => ({ updateBuild: (...a: unknown[]) => updateBuild(...a), updateBuildInStep: (...a: unknown[]) => updateBuild(...a) }));
vi.mock("./patternsWrite", () => ({ refreshPatterns: () => Promise.resolve(true) }));

import { refreshStoredCounts, resetStoredCountsColumns, storedCountsOfBuild } from "./buildCountsWrite";
import { refreshMakingStats } from "./making";

const node = (n: number, type: string, payload: Record<string, unknown>): NodeTree =>
  ({ id: `n${n}`, build_id: "b1", type, title: null, payload, position: n, parent_id: null, source_ref: null, is_gap: false, created_at: "2026-10-22T00:00:00Z", children: [] }) as unknown as NodeTree;

const TWO_SESSIONS = [node(1, "prompt", { text: "First", session: "imp-1" }), node(2, "prompt", { text: "Second", session: "imp-1" }), node(3, "prompt", { text: "Third", session: "imp-2" })];

const wrote = () => updateBuild.mock.calls.map((call) => call[1] as Record<string, unknown>).filter((patch) => "session_count" in patch);

beforeEach(() => {
  resetStoredCountsColumns();
  getNodeTree.mockReset().mockResolvedValue(TWO_SESSIONS);
  listBuildSessionRows.mockReset().mockResolvedValue([]);
  listBuildSessions.mockReset().mockResolvedValue([]);
  updateBuild.mockReset().mockResolvedValue({});
  maybeSingle.mockReset().mockResolvedValue({ data: { made_with: [], making: {} }, error: null });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("storedCountsOfBuild", () => {
  it("counts the steps and the sessions the composer shows, from the tiles it reads itself", async () => {
    expect(await storedCountsOfBuild("b1", {})).toEqual({ step_count: 3, part_count: 0, agent_count: 0, session_count: 2 });
  });

  it("counts a session made in the composer that has no tiles yet, and the stored parts", async () => {
    getNodeTree.mockResolvedValue([TWO_SESSIONS[0]]);
    const making = { session_order: ["imp-1", "typed-abc"], sessions_meta: { "typed-abc": { tool: null, date: "2026-10-22", workstream: "p1" } }, workstreams: [{ key: "p1" }, { key: "p2" }] };
    const counts = await storedCountsOfBuild("b1", making);
    expect(counts.session_count).toBe(2);
    expect(counts.part_count).toBe(2);
  });
});

describe("refreshStoredCounts", () => {
  it("writes the four counts", async () => {
    expect(await refreshStoredCounts("b1", {})).toBe(true);
    expect(updateBuild).toHaveBeenCalledWith("b1", { step_count: 3, part_count: 0, agent_count: 0, session_count: 2 });
  });

  it("stops trying once the columns are missing, and says false", async () => {
    updateBuild.mockRejectedValue({ code: "PGRST204" });
    expect(await refreshStoredCounts("b1", {})).toBe(false);
    updateBuild.mockClear();
    expect(await refreshStoredCounts("b1", {})).toBe(false);
    expect(updateBuild).not.toHaveBeenCalled();
  });
});

describe("a session added away from the composer", () => {
  it("updates the stored counts through refreshMakingStats, with no composer open", async () => {
    await refreshMakingStats("b1");
    await vi.waitFor(() => expect(wrote()).toHaveLength(1));
    expect(wrote()[0]).toEqual({ step_count: 3, part_count: 0, agent_count: 0, session_count: 2 });
  });
});
