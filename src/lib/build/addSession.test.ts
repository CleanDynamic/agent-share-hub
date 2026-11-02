// CA-12 P5 — adding a session to a draft, behind supabase-js with only the network faked.

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("./__audit__/fakeSupabase")).clientModule);

import { REPO_SCHEMA, startAuditBackend, tableRows, type Fault } from "./__audit__/fakeSupabase";
import { addOfferedSession, addSessionToBuild, emptyFirstSession, linkSessionToBuild, placeSession, promptsOfProposal, runFactsOf, startsCollapsed, tileRows } from "./addSession";
import { COLLAPSE_OVER, reorderBuildSessions } from "./buildSessions";
import { resetContributorColumn } from "./contributors";
import { sessionsMetaOf } from "./making";
import type { NodeTree } from "./types";

const DRAFT = "0d0d0d0d-0000-4000-8000-000000000005";
const OTHER = "0d0d0d0d-0000-4000-8000-000000000006";
const WAITING = "0e0e0e0e-0000-4000-8000-000000000001";
const LONG = "0e0e0e0e-0000-4000-8000-000000000003";
const FIRST = "typed-11111111-0000-4000-8000-000000000001";

afterEach(() => {
  vi.restoreAllMocks();
  resetContributorColumn();
});

const nodesOf = (build: string) => tableRows("build_nodes").filter((row) => row.build_id === build);
const sessionRows = (build: string) => tableRows("build_sessions").filter((row) => row.build_id === build);

/** A draft that already has an empty Session 1, as ensureBuild makes one. */
const withFirstSession = (rows: Record<string, Record<string, unknown>[]>) => {
  const build = rows.builds.find((row) => row.id === DRAFT) as Record<string, unknown>;
  build.making = { sessions_meta: { [FIRST]: { tool: null, date: "2026-10-20" } } };
  rows.build_sessions.push({ id: "0f0f0f0f-0000-4000-8000-0000000000a1", build_id: DRAFT, session_key: FIRST, import_id: null, position: 0, collapsed: false });
};

describe("the rules, as pure functions", () => {
  it("collapses a session of more than 12 prompts, and no fewer", () => {
    expect(COLLAPSE_OVER).toBe(12);
    expect([1, 12, 13, 262, 829].map(startsCollapsed)).toEqual([false, false, true, true, true]);
  });

  it("takes the prompts of a proposal in order, one per user turn, and gives each a tile row after the last position", () => {
    const proposal = {
      events: [
        { ordinal: 2, kind: "prompt", payload: { text: "Second", response_summary: "Here is the second answer." }, source_ref: { source: "transcript", session_id: "x", index: 3 } },
        { ordinal: 1, kind: "prompt", payload: { text: "First" }, source_ref: { source: "transcript", session_id: "x", index: 1 } },
        { ordinal: 3, kind: "note", payload: { text: "Not a prompt" }, source_ref: { source: "transcript", session_id: "x", index: 4 } },
      ],
    } as unknown as Parameters<typeof promptsOfProposal>[0];
    const prompts = promptsOfProposal(proposal);
    expect(prompts.map((p) => p.text)).toEqual(["First", "Second"]);
    const rows = tileRows("b", "imp", "Opus 5.5", prompts, 7);
    expect(rows.map((r) => [r.position, r.type, r.parent_id])).toEqual([[7, "prompt", null], [8, "prompt", null]]);
    expect(rows[0].payload).toEqual({ text: "First", model: "Opus 5.5" });
    // What came back rides on the tile when the event has it.
    expect(rows[1].payload).toEqual({ text: "Second", model: "Opus 5.5", reply: "Here is the second answer." });
    expect(rows[0].source_ref).toEqual({ source: "transcript", session_id: "x", index: 1, import_session_id: "imp" });
    expect(tileRows("b", "imp", null, prompts, 1)[0].payload).toEqual({ text: "First" });
  });

  const tile = (session: string) => ({ id: "n", parent_id: null, position: 1, payload: { session }, source_ref: null, children: [] }) as unknown as NodeTree;
  it("replaces Session 1 only when it was made here, has no app and holds no tile", () => {
    const rows = [{ sessionKey: FIRST, position: 0 }, { sessionKey: "typed-b", position: 1 }];
    const making = { sessions_meta: { [FIRST]: { tool: null, date: "2026-10-20" } } };
    expect(emptyFirstSession(rows, making, [])).toBe(FIRST);
    expect(emptyFirstSession(rows, { sessions_meta: { [FIRST]: { tool: "claude", date: "2026-10-20" } } }, [])).toBeNull();
    expect(emptyFirstSession(rows, making, [tile(FIRST)])).toBeNull();
    expect(emptyFirstSession([{ sessionKey: "0e0e0e0e-0000-4000-8000-000000000001", position: 0 }], {}, [])).toBeNull();
    expect(emptyFirstSession([], making, [])).toBeNull();
  });

  it("puts a session in the replaced one's place, else last", () => {
    const rows = [{ sessionKey: "a", position: 0 }, { sessionKey: "b", position: 4 }];
    expect(placeSession(rows, "a")).toBe(0);
    expect(placeSession(rows, null)).toBe(5);
    expect(placeSession([], null)).toBe(0);
  });
});

describe("addSessionToBuild", () => {
  it("writes every prompt as a placed tile in order, records the session, and leaves the import as it was", async () => {
    startAuditBackend({ schema: REPO_SCHEMA });
    const result = await addSessionToBuild(LONG, { kind: "existing", buildId: DRAFT });
    expect(result).toMatchObject({ buildId: DRAFT, sessionKey: LONG, tiles: 66, collapsed: true, replaced: null });
    const nodes = nodesOf(DRAFT);
    expect(nodes).toHaveLength(66);
    expect(nodes.map((n) => n.position)).toEqual(Array.from({ length: 66 }, (_, at) => at + 1));
    expect(nodes.every((n) => n.type === "prompt" && n.parent_id === null)).toBe(true);
    expect(sessionRows(DRAFT)).toEqual([expect.objectContaining({ session_key: LONG, import_id: LONG, position: 0, collapsed: true })]);
    expect(tableRows("import_sessions").find((r) => r.id === LONG)).toMatchObject({ status: "expired", build_id: null });
    // No event is written: nothing of the conversation reaches the timeline.
    expect(tableRows("build_events")).toHaveLength(0);
  });

  it("writes tiles in batches of 100", async () => {
    startAuditBackend({
      schema: REPO_SCHEMA,
      seed: (rows) => {
        const big = rows.import_sessions.find((r) => r.id === LONG) as { proposal: { events: Record<string, unknown>[] } };
        big.proposal.events = Array.from({ length: 250 }, (_, at) => ({ kind: "prompt", ordinal: at + 1, payload: { text: `p${at}` }, source_ref: { source: "transcript", session_id: LONG, index: at } }));
      },
    });
    const { requests } = await import("./__audit__/fakeSupabase");
    await addSessionToBuild(LONG, { kind: "existing", buildId: DRAFT });
    expect(nodesOf(DRAFT)).toHaveLength(250);
    expect(requests().filter((r) => r.method === "POST" && r.path.startsWith("/rest/v1/build_nodes"))).toHaveLength(3);
  });

  it("SV-30 P6: stores the import's turn count with the session's entry when it is added, as From the run", async () => {
    startAuditBackend({ schema: REPO_SCHEMA });
    await addSessionToBuild(WAITING, { kind: "existing", buildId: DRAFT });
    const entry = sessionsMetaOf(tableRows("builds").find((r) => r.id === DRAFT)?.making)[WAITING];
    expect(entry).toMatchObject({ messages: 2, from_run: ["messages"] });
    expect(entry.compactions).toBeUndefined();
  });

  it("SV-30 P6: counts the compaction summaries among the prompts", () => {
    const summary = "This session is being continued from a previous conversation that ran out of context.";
    expect(runFactsOf(3714, [{ text: summary }, { text: "Fix it" }, { text: summary }])).toEqual({ messages: 3714, compactions: 2 });
    expect(runFactsOf(0, [{ text: "Fix it" }])).toEqual({});
  });

  it("appends: Session 2 at position 1, after the first, with its tiles after the first's", async () => {
    startAuditBackend({ schema: REPO_SCHEMA });
    await addSessionToBuild(WAITING, { kind: "existing", buildId: DRAFT });
    await addSessionToBuild(LONG, { kind: "existing", buildId: DRAFT });
    expect(sessionRows(DRAFT).map((r) => [r.session_key, r.position, r.collapsed]).sort((a, b) => Number(a[1]) - Number(b[1]))).toEqual([[WAITING, 0, false], [LONG, 1, true]]);
    expect(nodesOf(DRAFT).map((n) => n.position)).toEqual(Array.from({ length: 67 }, (_, at) => at + 1));
  });

  it("replaces an empty Session 1: its entry and row go, the added session takes its place", async () => {
    startAuditBackend({ schema: REPO_SCHEMA, seed: withFirstSession });
    const result = await addSessionToBuild(WAITING, { kind: "existing", buildId: DRAFT });
    expect(result.replaced).toBe(FIRST);
    expect(sessionRows(DRAFT)).toEqual([expect.objectContaining({ session_key: WAITING, position: 0 })]);
    expect(Object.keys(sessionsMetaOf(tableRows("builds").find((r) => r.id === DRAFT)?.making))).toEqual([WAITING]);
  });

  it("keeps Session 1 when it has an app, and the added session is the next", async () => {
    startAuditBackend({
      schema: REPO_SCHEMA,
      seed: (rows) => {
        withFirstSession(rows);
        (rows.builds.find((r) => r.id === DRAFT) as Record<string, unknown>).making = { sessions_meta: { [FIRST]: { tool: "claude", date: "2026-10-20" } } };
      },
    });
    const result = await addSessionToBuild(WAITING, { kind: "existing", buildId: DRAFT });
    expect(result.replaced).toBeNull();
    expect(sessionRows(DRAFT).map((r) => [r.session_key, r.position])).toEqual([[FIRST, 0], [WAITING, 1]]);
  });

  it("puts the same session in two drafts, each with its own tiles, and neither takes it from the other", async () => {
    startAuditBackend({ schema: REPO_SCHEMA });
    await addSessionToBuild(LONG, { kind: "existing", buildId: DRAFT });
    await addSessionToBuild(LONG, { kind: "existing", buildId: OTHER });
    expect(nodesOf(DRAFT)).toHaveLength(66);
    expect(nodesOf(OTHER)).toHaveLength(66);
    expect(new Set([...nodesOf(DRAFT), ...nodesOf(OTHER)].map((n) => n.id)).size).toBe(132);
    expect(tableRows("import_sessions").find((r) => r.id === LONG)).toMatchObject({ status: "expired", build_id: null });
  });

  it("refuses a session that is already in the draft, and writes nothing more", async () => {
    startAuditBackend({ schema: REPO_SCHEMA });
    await addSessionToBuild(WAITING, { kind: "existing", buildId: DRAFT });
    await expect(addSessionToBuild(WAITING, { kind: "existing", buildId: DRAFT })).rejects.toThrow(/already in this draft/);
    expect(nodesOf(DRAFT)).toHaveLength(1);
    expect(sessionRows(DRAFT)).toHaveLength(1);
  });

  it("starts a new build with the session as Session 1, when asked for a new one", async () => {
    startAuditBackend({ schema: REPO_SCHEMA });
    const { buildId } = await addSessionToBuild(WAITING, { kind: "new" });
    expect(nodesOf(buildId)).toHaveLength(1);
    expect(sessionRows(buildId)).toEqual([expect.objectContaining({ session_key: WAITING, position: 0 })]);
  });

  it("leaves nothing half-added when the session's row cannot be written: the tiles go, and Session 1 comes back", async () => {
    const fault: Fault = { method: "POST", path: /^\/rest\/v1\/build_sessions/, answer: { status: 500, body: { code: "XX000", message: "boom" } } };
    startAuditBackend({ schema: REPO_SCHEMA, faults: [fault], seed: withFirstSession });
    await expect(addSessionToBuild(LONG, { kind: "existing", buildId: DRAFT })).rejects.toThrow();
    expect(nodesOf(DRAFT)).toHaveLength(0);
    expect(Object.keys(sessionsMetaOf(tableRows("builds").find((r) => r.id === DRAFT)?.making))).toEqual([FIRST]);
  });

  it("refuses an import that never finished arriving", async () => {
    startAuditBackend({ schema: REPO_SCHEMA, seed: (rows) => ((rows.import_sessions.find((r) => r.id === WAITING) as Record<string, unknown>).status = "assembling") });
    await expect(addSessionToBuild(WAITING, { kind: "existing", buildId: DRAFT })).rejects.toThrow(/hasn't finished arriving/);
  });

  it("still adds the tiles when build_sessions is not applied yet, so nothing is lost", async () => {
    const without = { ...REPO_SCHEMA, tables: Object.fromEntries(Object.entries(REPO_SCHEMA.tables).filter(([name]) => name !== "build_sessions")) };
    startAuditBackend({ schema: without });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await addSessionToBuild(WAITING, { kind: "existing", buildId: DRAFT });
    expect(nodesOf(DRAFT)).toHaveLength(1);
  });
});

describe("addOfferedSession (SV-21)", () => {
  const KIT = "0c0c0c0c-0000-4000-8000-000000000009";
  const offered = {
    key: "0e0e0e0e-0000-4000-8000-0000000000f1",
    model: "Opus 5.5",
    prompts: [0, 1].map((index) => ({ text: `Prompt ${index}`, reply: null, sourceRef: { source: "claude_code", session_id: "s", index, local_id: `l${index}` } })) as never,
  };

  it("credits every tile row it writes", () => {
    resetContributorColumn();
    expect(tileRows("b", "imp", null, offered.prompts, 1, KIT).map((row) => (row as { contributor_id?: string }).contributor_id)).toEqual([KIT, KIT]);
    expect(tileRows("b", "imp", null, offered.prompts, 1)[0]).not.toHaveProperty("contributor_id");
  });

  it("writes the offered prompts as tiles and a session entry, credited to the person who offered them", async () => {
    startAuditBackend({ schema: REPO_SCHEMA });
    const result = await addOfferedSession(DRAFT, offered, KIT);
    expect(result).toMatchObject({ buildId: DRAFT, sessionKey: offered.key, tiles: 2 });
    expect(nodesOf(DRAFT).map((node) => (node.payload as { text: string }).text)).toEqual(["Prompt 0", "Prompt 1"]);
    expect(sessionsMetaOf((tableRows("builds").find((row) => row.id === DRAFT) as { making: unknown }).making)[offered.key]?.contributor_id).toBe(KIT);
  });

  it("refuses a build that is not the signed-in maker's, and writes nothing", async () => {
    startAuditBackend({ schema: REPO_SCHEMA });
    await expect(addOfferedSession("0d0d0d0d-0000-4000-8000-0000000000ff", offered, KIT)).rejects.toThrow();
    expect(nodesOf(DRAFT)).toHaveLength(0);
  });
});

describe("linking and ordering", () => {
  it("links a session to a draft without tiles, once", async () => {
    startAuditBackend({ schema: REPO_SCHEMA });
    await linkSessionToBuild(WAITING, DRAFT);
    await linkSessionToBuild(WAITING, DRAFT);
    expect(sessionRows(DRAFT)).toHaveLength(1);
    expect(nodesOf(DRAFT)).toHaveLength(0);
  });

  it("reorders sessions through parking, so the unique position is never met twice", async () => {
    startAuditBackend({ schema: REPO_SCHEMA });
    await addSessionToBuild(WAITING, { kind: "existing", buildId: DRAFT });
    await addSessionToBuild(LONG, { kind: "existing", buildId: DRAFT });
    await reorderBuildSessions(DRAFT, [LONG, WAITING]);
    expect(sessionRows(DRAFT).map((r) => [r.session_key, r.position]).sort((a, b) => Number(a[1]) - Number(b[1]))).toEqual([[LONG, 0], [WAITING, 1]]);
  });
});
