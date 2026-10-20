// CA-08 Part 3 — the two flows' data calls, run for real against each failure the prompt names.
//
// The functions are the shipped ones (drafts.ts, builds.ts, making.ts, sessions.ts, thread.ts). Only the network is
// fake (./fakeSupabase): supabase-js is real, so every error below is the error object the browser would hold.
// These tests pass: each one asserts what happens today, failures included. Nothing here fixes anything.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("./fakeSupabase")).clientModule);

import { isPermissionError } from "@/lib/errors/permission";

import { createBuild } from "../builds";
import { listDraftsWithSessions } from "../drafts";
import { getGalleryFacets } from "../gallery";
import { newSessionKey, sessionsMetaOf, setSessionMeta, todayDay } from "../making";
import { countDraftBuilds, listSessions } from "../sessions";
import { saveThread } from "../thread";
import { LIVE_SCHEMA, MAKER_ID, PG, REPO_SCHEMA, requests, startAuditBackend, tableRows, without, type Fault } from "./fakeSupabase";

/** The PostgREST error a data-layer error carries as its cause. */
const causeOf = (error: unknown) => (error as { cause?: { code?: string; message?: string } }).cause ?? {};

async function failure(run: () => Promise<unknown>): Promise<Error> {
  try {
    await run();
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected a failure, and the call succeeded");
}

/** onNewSession's first two writes, in its order: ensureBuild's createBuild, then setSessionMeta. (refreshRecord is the page's.) */
async function newSession(): Promise<{ id: string; key: string }> {
  const created = await createBuild({ title: "Untitled build", outcome: null, made_for: [] });
  const key = newSessionKey();
  await setSessionMeta(created.id, key, { tool: null, date: todayDay() });
  return { id: created.id, key };
}

const drafts = () => tableRows("builds").filter((row) => row.status === "draft" && row.creator_id === MAKER_ID).length;

describe("CA-08 · the control: every migration applied", () => {
  it("lists the fifteen drafts, newest first, with their session counts", async () => {
    startAuditBackend({ schema: REPO_SCHEMA });
    const list = await listDraftsWithSessions();
    expect(list).toHaveLength(15);
    expect(list[0].updatedAt).toBe("2026-10-10T19:31:55Z");
    expect(requests().map((r) => `${r.method} ${r.status}`)).toEqual(["GET 200", "GET 200"]);
  });

  it("makes a new session: the draft is made, then sessions_meta is written", async () => {
    startAuditBackend({ schema: REPO_SCHEMA });
    const { id, key } = await newSession();
    const row = tableRows("builds").find((build) => build.id === id);
    expect(sessionsMetaOf(row?.making)[key]).toEqual({ tool: null, date: todayDay() });
    expect(drafts()).toBe(16);
  });
});

describe("CA-08 · cause 1: the live database behind the repository (no builds.post_doc)", () => {
  it("the Drafts page's first query fails with 42703, and nothing else is asked", async () => {
    startAuditBackend({ schema: LIVE_SCHEMA });
    const error = await failure(listDraftsWithSessions);
    expect(error.message).toBe("listDraftBuildsByCreator failed: column builds.post_doc does not exist");
    expect(causeOf(error).code).toBe("42703");
    expect(requests()).toHaveLength(1);
    expect(requests()[0].path).toMatch(/^\/rest\/v1\/builds\?select=id,creator_id,.*,solves_node_id,post_doc&creator_id=eq\./);
  });

  it("while the header's count, which selects only id, still reads 15, and the Sessions query still works", async () => {
    startAuditBackend({ schema: LIVE_SCHEMA });
    expect(await countDraftBuilds()).toBe(15);
    expect(await listSessions({ includeAttached: false })).toHaveLength(1);
  });

  it("a new post's first write fails in createBuild with 42703, and no draft is made", async () => {
    startAuditBackend({ schema: LIVE_SCHEMA });
    const error = await failure(newSession);
    expect(error.message).toBe("createBuild failed: column builds.post_doc does not exist");
    expect(causeOf(error).code).toBe("42703");
    expect(drafts()).toBe(15);
    // The insert and its select are one statement: it failed whole.
    expect(requests().map((r) => `${r.method} ${r.status} ${r.code}`)).toEqual(["POST 400 42703"]);
  });

  it("a draft that already exists cannot be written either: updateBuild selects post_doc too", async () => {
    startAuditBackend({ schema: LIVE_SCHEMA });
    const id = String(tableRows("builds")[0].id);
    const error = await failure(() => setSessionMeta(id, newSessionKey(), { tool: null, date: todayDay() }));
    expect(error.message).toBe("updateBuild failed: column builds.post_doc does not exist");
    // readMadeWith (made_with, making) worked; the PATCH did not.
    expect(requests().map((r) => `${r.method} ${r.status}`)).toEqual(["GET 200", "PATCH 400"]);
  });

  it("the Post tab's save writes the picture set, then fails on post_doc with PGRST204: half written", async () => {
    startAuditBackend({ schema: LIVE_SCHEMA });
    const id = String(tableRows("builds")[0].id);
    const error = await failure(() => saveThread(id, { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello." }] }] }));
    expect(error.message).toBe("updateBuild failed: Could not find the 'post_doc' column of 'builds' in the schema cache");
    expect(causeOf(error).code).toBe("PGRST204");
    expect(requests().map((r) => `${r.method} ${r.path.split("?")[0]} ${r.status}`)).toEqual(["POST /rest/v1/rpc/set_build_post_media 200", "PATCH /rest/v1/builds 400"]);
  });
});

describe("CA-08 · what should happen on the live schema, and does not (it.fails: these fail today, on purpose)", () => {
  it.fails("the Drafts page's read lists the fifteen drafts against the schema types.ts describes", async () => {
    startAuditBackend({ schema: LIVE_SCHEMA });
    expect(await listDraftsWithSessions()).toHaveLength(15);
  });

  it.fails("a new post's first write makes a draft against the schema types.ts describes", async () => {
    startAuditBackend({ schema: LIVE_SCHEMA });
    await newSession();
    expect(drafts()).toBe(16);
  });
});

describe("CA-08 · cause 1, the columns the flows rely on (20261001280000)", () => {
  it("without session_count, the drafts load and their counts fail: the page still errors", async () => {
    startAuditBackend({ schema: without(REPO_SCHEMA, "builds", "session_count") });
    const error = await failure(listDraftsWithSessions);
    expect(error.message).toBe("listDraftsWithSessions (counts) failed: column builds.session_count does not exist");
  });

  it("without making, the draft is made and the session is not: setSessionMeta's read fails", async () => {
    // One column at a time: BUILD_COLUMNS does not name making, so createBuild works and the miss shows one call later.
    startAuditBackend({ schema: without(REPO_SCHEMA, "builds", "making") });
    const error = await failure(newSession);
    expect(error.message).toBe("setSessionMeta failed: column builds.making does not exist");
    expect(drafts()).toBe(16);
  });
});

describe("CA-08 · each other failure the prompt names, on the same two paths", () => {
  const cases: { name: string; faults: Fault[]; drafts: string; session: string; code: string }[] = [
    {
      name: "42883, a function the builds policy calls is missing (is_admin)",
      faults: [{ path: /^\/rest\/v1\/builds/, answer: PG.missingFunction("public.is_admin(uuid)") }],
      drafts: "listDraftBuildsByCreator failed: function public.is_admin(uuid) does not exist",
      session: "createBuild failed: function public.is_admin(uuid) does not exist",
      code: "42883",
    },
    {
      // A read is never refused by a policy (it filters); 42501 on a read is a missing grant. An insert is refused by the policy.
      name: "42501, a grant missing for the read and the insert policy refusing the write",
      faults: [
        { method: "GET", path: /^\/rest\/v1\/builds/, answer: { status: 403, body: { code: "42501", details: null, hint: null, message: "permission denied for table builds" } } },
        { method: "POST", path: /^\/rest\/v1\/builds/, answer: PG.rlsInsert("builds") },
      ],
      drafts: "listDraftBuildsByCreator failed: permission denied for table builds",
      session: 'createBuild failed: new row violates row-level security policy for table "builds"',
      code: "42501",
    },
  ];
  for (const { name, faults, drafts: draftsLine, session, code } of cases) {
    it(name, async () => {
      startAuditBackend({ schema: REPO_SCHEMA, faults });
      const read = await failure(listDraftsWithSessions);
      expect(read.message).toBe(draftsLine);
      expect(causeOf(read).code).toBe(code);
      const write = await failure(newSession);
      expect(write.message).toBe(session);
      expect(drafts()).toBe(15);
    });
  }

  it("23514, a check refuses the making write: the draft IS made, the session is not", async () => {
    startAuditBackend({ schema: REPO_SCHEMA, faults: [{ method: "PATCH", path: /^\/rest\/v1\/builds/, answer: PG.check("builds", "builds_making_object_check") }] });
    const error = await failure(newSession);
    expect(error.message).toBe('updateBuild failed: new row for relation "builds" violates check constraint "builds_making_object_check"');
    expect(causeOf(error).code).toBe("23514");
    expect(drafts()).toBe(16);
  });

  it("zero rows updated (an UPDATE policy that hides the row): .single() turns it into PGRST116, never a silent success", async () => {
    startAuditBackend({ schema: REPO_SCHEMA, faults: [{ method: "PATCH", path: /^\/rest\/v1\/builds/, answer: PG.zeroRows() }] });
    const error = await failure(newSession);
    expect(error.message).toBe("updateBuild failed: Cannot coerce the result to a single JSON object");
    expect(causeOf(error).code).toBe("PGRST116");
    expect(drafts()).toBe(16);
  });

  it("zero rows updated, as RLS really does it: the build is someone else's", async () => {
    startAuditBackend({ schema: REPO_SCHEMA, seed: (rows) => void (rows.builds[0].creator_id = "0b0b0b0b-0000-4000-8000-0000000000ff") });
    const id = String(tableRows("builds")[0].id);
    // A draft of someone else's is not even readable, so readMadeWith refuses first.
    const error = await failure(() => setSessionMeta(id, newSessionKey(), { tool: null, date: todayDay() }));
    expect(error.message).toBe("setSessionMeta failed: That build is no longer available.");
  });

  it("no session: the drafts read is [] without a request (it looks like no drafts), the write refuses, and Sessions is refused for anon", async () => {
    startAuditBackend({ schema: REPO_SCHEMA, signedIn: false });
    expect(await listDraftsWithSessions()).toEqual([]);
    expect(requests()).toHaveLength(0);
    const write = await failure(newSession);
    expect(write.message).toBe("createBuild failed: no signed-in user");
    const sessions = await failure(() => listSessions({ includeAttached: false }));
    expect(sessions.message).toBe("listSessions failed: permission denied for table import_sessions");
    expect(isPermissionError(sessions)).toBe(true);
  });

  it("a network failure on a write is not retried: createBuild fails at once with postgrest-js's own words", async () => {
    startAuditBackend({ schema: REPO_SCHEMA, faults: [{ method: "POST", path: /^\/rest\/v1\/builds/, answer: "network" }] });
    const error = await failure(newSession);
    expect(error.message).toBe("createBuild failed: TypeError: Failed to fetch");
    expect(causeOf(error).code).toBe("");
    expect(requests()).toHaveLength(1);
  });

  it(
    "a network failure on a read is retried three times by postgrest-js (1 s, 2 s, 4 s) before it fails",
    async () => {
      startAuditBackend({ schema: REPO_SCHEMA, faults: [{ method: "GET", path: /^\/rest\/v1\/builds/, answer: "network" }] });
      const started = Date.now();
      const error = await failure(listDraftsWithSessions);
      expect(error.message).toBe("listDraftBuildsByCreator failed: TypeError: Failed to fetch");
      expect(requests()).toHaveLength(4);
      expect(Date.now() - started).toBeGreaterThanOrEqual(6900);
    },
    20_000,
  );

  it("PGRST202, an RPC missing from the schema cache: the composer's facets read and the Post tab's picture set", async () => {
    startAuditBackend({ schema: { ...REPO_SCHEMA, functions: [] } });
    const facets = await failure(getGalleryFacets);
    expect(facets.message).toBe("getGalleryFacets failed: Could not find the function public.gallery_facets(thresholds) in the schema cache");
    expect(causeOf(facets).code).toBe("PGRST202");
    const id = String(tableRows("builds")[0].id);
    const thread = await failure(() => saveThread(id, { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello." }] }] }));
    expect(thread.message).toBe("setPostMedia failed: Could not find the function public.set_build_post_media(p_build_id, p_media_ids) in the schema cache");
  });
});
