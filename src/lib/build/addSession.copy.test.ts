// SV-07 P2: a ready-made session added the way an import is (SV-18 and SV-21 call it), behind supabase-js with only the network faked.

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("./__audit__/fakeSupabase")).clientModule);

import { PG, REPO_SCHEMA, startAuditBackend, tableRows, type Fault, type Row } from "./__audit__/fakeSupabase";
import { addSessionCopy, type SessionCopy } from "./addSession";
import { sessionOrderOf, sessionsMetaOf } from "./making";

const DRAFT = "0d0d0d0d-0000-4000-8000-000000000005";
const FIVE = "typed-55555555-0000-4000-8000-000000000005";
const COPY = "typed-66666666-0000-4000-8000-000000000006";

afterEach(() => vi.restoreAllMocks());

const copy: SessionCopy = {
  key: COPY,
  meta: { tool: "claude", date: "2026-10-26", title: "Signs" },
  tiles: [
    { type: "prompt", title: null, note: null, payload: { text: "Paint the sign" }, source_ref: null },
    { type: "prompt", title: null, note: null, payload: { text: "Hang it" }, source_ref: null },
  ],
};

/** Two parts; Session 5, made here, in Part 2 with one tile. */
function open(faults: Fault[] = []) {
  startAuditBackend({
    schema: REPO_SCHEMA,
    faults,
    seed: (rows) => {
      const build = rows.builds.find((row) => row.id === DRAFT) as Row;
      build.making = { sessions_meta: { [FIVE]: { tool: null, date: "2026-10-20", workstream: "ws-2" } }, workstreams: [{ key: "ws-1" }, { key: "ws-2" }], session_order: [FIVE] };
      rows.build_sessions = rows.build_sessions.filter((row) => row.build_id !== DRAFT);
      rows.build_sessions.push({ id: "0f0f0f0f-0000-4000-8000-0000000000b1", build_id: DRAFT, session_key: FIVE, import_id: null, position: 0, collapsed: false });
      rows.build_nodes.push({ id: "0a0a0a0a-0000-4000-8000-0000000000c1", build_id: DRAFT, parent_id: null, position: 0, type: "prompt", title: null, note: null, payload: { text: "Five", session: FIVE }, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-20T10:00:00Z" });
    },
  });
}

const making = () => (tableRows("builds").find((row) => row.id === DRAFT) as Row).making;
const tiles = () => tableRows("build_nodes").filter((row) => row.build_id === DRAFT).sort((a, b) => Number(a.position) - Number(b.position));

describe("SV-07 P2 · addSessionCopy", () => {
  it("writes the tiles in the session, its entry in the part it joins, its row and its place at the end of that part", async () => {
    open();
    const result = await addSessionCopy(DRAFT, copy, "ws-2");
    expect(result).toMatchObject({ sessionKey: COPY, tiles: 2, replaced: null });
    expect(sessionsMetaOf(making())[COPY]).toMatchObject({ tool: "claude", title: "Signs", workstream: "ws-2" });
    expect(sessionOrderOf(making())).toEqual([FIVE, COPY]);
    expect(tableRows("build_sessions").filter((row) => row.build_id === DRAFT).map((row) => row.session_key)).toContain(COPY);
    expect(tiles().map((row) => (row.payload as { session?: string }).session)).toEqual([FIVE, COPY, COPY]);
    // Session 5 is where it was.
    expect(sessionsMetaOf(making())[FIVE].workstream).toBe("ws-2");
  });

  it("refuses a key that is already in the draft, and one that is not a session made here", async () => {
    open();
    await expect(addSessionCopy(DRAFT, { ...copy, key: FIVE })).rejects.toThrow(/already in this draft/);
    await expect(addSessionCopy(DRAFT, { ...copy, key: "0e0e0e0e-0000-4000-8000-000000000001" })).rejects.toThrow(/made here/);
  });

  it("takes back what it wrote when a later write fails", async () => {
    open([{ method: "PATCH", path: /\/builds/, answer: PG.rlsInsert("builds") }]);
    await expect(addSessionCopy(DRAFT, copy, "ws-2")).rejects.toThrow();
    expect(tiles()).toHaveLength(1);
    expect(sessionsMetaOf(making())[COPY]).toBeUndefined();
  });
});
