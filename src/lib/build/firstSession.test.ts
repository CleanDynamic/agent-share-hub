// CA-12 P3: Session 1 on a new draft, behind supabase-js with only the network faked.

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("./__audit__/fakeSupabase")).clientModule);

import { PG, REPO_SCHEMA, startAuditBackend, tableRows, type Schema } from "./__audit__/fakeSupabase";
import { seedFirstSession } from "./firstSession";
import { sessionsMetaOf } from "./making";

const DRAFT = "0d0d0d0d-0000-4000-8000-000000000002";

afterEach(() => vi.restoreAllMocks());

/** The repository's schema before the CA-12 migration is applied: no build_sessions. */
const NOT_APPLIED: Schema = { ...REPO_SCHEMA, tables: Object.fromEntries(Object.entries(REPO_SCHEMA.tables).filter(([name]) => name !== "build_sessions")) };

describe("seedFirstSession", () => {
  it("makes an empty session with no app chosen, in the draft's making and in build_sessions at position 0", async () => {
    startAuditBackend({ schema: REPO_SCHEMA });
    const key = await seedFirstSession(DRAFT);

    expect(key).toMatch(/^typed-/);
    const build = tableRows("builds").find((row) => row.id === DRAFT);
    const meta = sessionsMetaOf(build?.making)[key];
    expect(meta).toMatchObject({ tool: null });
    expect(meta.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(tableRows("build_sessions").filter((row) => row.build_id === DRAFT)).toEqual([
      expect.objectContaining({ session_key: key, import_id: null, position: 0, collapsed: false }),
    ]);
  });

  it("still makes the session when the table is not applied yet, so the draft is not lost", async () => {
    startAuditBackend({ schema: NOT_APPLIED });
    const key = await seedFirstSession(DRAFT);
    expect(sessionsMetaOf(tableRows("builds").find((row) => row.id === DRAFT)?.making)[key]).toBeTruthy();
  });

  it("says so when the session itself cannot be written", async () => {
    startAuditBackend({ schema: REPO_SCHEMA, faults: [{ method: "PATCH", path: /^\/rest\/v1\/builds/, answer: PG.rlsInsert("builds") }] });
    await expect(seedFirstSession(DRAFT)).rejects.toThrow();
  });
});
