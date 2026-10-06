// sessions.ts — what each function asks the client for, and what it does when
// the row is gone (RLS hides it) or already claimed. The client is faked at the
// one boundary the module talks through; imports.ts, making.ts and the model
// registry's lookups are the real ones where they are pure, mocked where they
// write.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TranscriptProposal } from "./intake";

interface Call {
  method: string;
  args: unknown[];
}

function chain(result: { data?: unknown; error?: unknown; count?: number | null }, calls: Call[]) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order", "limit", "update"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.maybeSingle = (...args: unknown[]) => {
    calls.push({ method: "maybeSingle", args });
    return Promise.resolve({ data: null, error: null, ...result });
  };
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null, ...result }).then(resolve);
  return builder;
}

const calls: Call[] = [];
let results: { data?: unknown; error?: unknown; count?: number | null }[] = [];
const fromTable = vi.fn();
const getSession = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => fromTable(table),
    auth: { getSession: () => getSession() },
  },
}));

const claimImport = vi.fn();
const discardImport = vi.fn();
const loadImportProposal = vi.fn();
vi.mock("./imports", () => ({
  claimImport: (...a: unknown[]) => claimImport(...a),
  discardImport: (...a: unknown[]) => discardImport(...a),
  loadImportProposal: (...a: unknown[]) => loadImportProposal(...a),
}));

const refreshMakingStats = vi.fn();
vi.mock("./making", () => ({
  refreshMakingStats: (...a: unknown[]) => refreshMakingStats(...a),
}));

import {
  attachSession,
  countDraftBuilds,
  getSessionPrompts,
  listBuildSessions,
  listSessions,
  removeSession,
  setSessionModel,
} from "./sessions";

const IMPORT_ID = "11111111-0000-4000-8000-000000000001";
const BUILD_ID = "33333333-0000-4000-8000-000000000003";
const USER_ID = "22222222-0000-4000-8000-000000000002";

function ref(index: number) {
  return { source: "transcript", session_id: IMPORT_ID, index };
}

function proposal(title: string | null = "Inbox triage agent"): TranscriptProposal {
  return {
    events: [
      { ordinal: 2, kind: "prompt", visibility: "public", occurred_at: null, payload: { text: "Second", response_summary: null }, source_ref: ref(3), inferred: false, inferred_reason: null },
      { ordinal: 1, kind: "prompt", visibility: "public", occurred_at: null, payload: { text: "First", response_summary: null }, source_ref: ref(1), inferred: false, inferred_reason: null },
      { ordinal: 3, kind: "note", visibility: "public", occurred_at: null, payload: { text: "Not a prompt", response_summary: null }, source_ref: ref(4), inferred: false, inferred_reason: null },
    ],
    nodes: [],
    warnings: [],
    summary: {
      session_id: IMPORT_ID,
      source_hint: null,
      detected_format: "labelled",
      detected_labels: { user: [], assistant: [] },
      turn_count: 4,
      user_turn_count: 2,
      assistant_turn_count: 2,
      event_count: 3,
      node_count: 0,
      character_count: 10,
      line_count: 2,
      proposed_title: title
        ? { value: title, source_ref: ref(1), inferred: false, inferred_reason: null }
        : null,
      proposed_outcome: null,
    },
  };
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: IMPORT_ID,
    client: "claude-code",
    model: "claude-sonnet-5-5",
    target_build_id: null,
    build_id: null,
    created_at: "2026-10-05T10:00:00Z",
    first_prompt: "  Build me an inbox triage agent  ",
    user_turns: 9,
    assistant_turns: 29,
    ...overrides,
  };
}

function answer(...next: { data?: unknown; error?: unknown; count?: number | null }[]) {
  results = next;
}

const methods = () => calls.map((c) => c.method);
const callOf = (method: string) => calls.find((c) => c.method === method);

beforeEach(() => {
  calls.length = 0;
  results = [];
  fromTable.mockReset();
  fromTable.mockImplementation((table: string) => {
    calls.push({ method: "from", args: [table] });
    return chain(results.shift() ?? { data: null }, calls);
  });
  getSession.mockReset();
  getSession.mockResolvedValue({ data: { session: { user: { id: USER_ID } } }, error: null });
  claimImport.mockReset();
  claimImport.mockResolvedValue({ buildId: BUILD_ID, counts: {} });
  discardImport.mockReset();
  discardImport.mockResolvedValue(undefined);
  loadImportProposal.mockReset();
  loadImportProposal.mockResolvedValue(proposal());
  refreshMakingStats.mockReset();
  refreshMakingStats.mockResolvedValue(undefined);
});

describe("listSessions", () => {
  it("asks for parsed sessions only, newest first, with the default limit and named columns", async () => {
    answer({ data: [row()] });
    const sessions = await listSessions();

    expect(callOf("from")?.args).toEqual(["import_sessions"]);
    const columns = callOf("select")?.args[0] as string;
    expect(columns).not.toContain("*");
    expect(columns).toContain("proposal->summary->user_turn_count");
    expect(columns).toContain("proposal->events->0->payload->>text");
    expect(callOf("in")?.args).toEqual(["status", ["parsed"]]);
    expect(callOf("order")?.args).toEqual(["created_at", { ascending: false }]);
    expect(callOf("limit")?.args).toEqual([50]);
    expect(sessions).toHaveLength(1);
  });

  it("adds claimed sessions on request and honours a limit", async () => {
    answer({ data: [] });
    await listSessions({ includeAttached: true, limit: 5 });
    expect(callOf("in")?.args).toEqual(["status", ["parsed", "claimed"]]);
    expect(callOf("limit")?.args).toEqual([5]);
  });

  it("maps a row: trimmed first prompt, prompt and turn counts, model name", async () => {
    answer({ data: [row({ target_build_id: BUILD_ID })] });
    const [s] = await listSessions();
    expect(s).toEqual({
      id: IMPORT_ID,
      client: "claude-code",
      model: "claude-sonnet-5-5",
      targetBuildId: BUILD_ID,
      modelName: "Sonnet 5.5",
      firstPrompt: "Build me an inbox triage agent",
      promptCount: 9,
      turnCount: 38,
      createdAt: "2026-10-05T10:00:00Z",
      buildId: null,
    });
  });

  it("cuts the first prompt to 160 characters", async () => {
    answer({ data: [row({ first_prompt: "x".repeat(400) })] });
    const [s] = await listSessions();
    expect(s.firstPrompt).toHaveLength(160);
  });

  it("copes with a row that has no model, no prompt and no counts", async () => {
    answer({ data: [row({ model: null, first_prompt: null, user_turns: null, assistant_turns: undefined })] });
    const [s] = await listSessions();
    expect(s.model).toBeNull();
    expect(s.modelName).toBeNull();
    expect(s.firstPrompt).toBeNull();
    expect(s.promptCount).toBe(0);
    expect(s.turnCount).toBe(0);
  });

  it("shows an unknown model as the text it was stored with", async () => {
    answer({ data: [row({ model: "llama-9-giant" })] });
    const [s] = await listSessions();
    expect(s.modelName).toBe("llama-9-giant");
  });

  it("returns an empty list when RLS leaves nothing, and throws on an error", async () => {
    answer({ data: null });
    expect(await listSessions()).toEqual([]);
    answer({ error: { message: "boom" } });
    await expect(listSessions()).rejects.toThrow(/listSessions/);
  });
});

describe("listBuildSessions", () => {
  it("reads one build's claimed sessions oldest first, with a limit", async () => {
    answer({ data: [row({ build_id: BUILD_ID })] });
    const sessions = await listBuildSessions(BUILD_ID);
    expect(calls.filter((c) => c.method === "eq").map((c) => c.args)).toEqual([
      ["build_id", BUILD_ID],
      ["status", "claimed"],
    ]);
    expect(callOf("order")?.args).toEqual(["created_at", { ascending: true }]);
    expect(callOf("limit")?.args[0]).toBeGreaterThan(0);
    expect(sessions[0].buildId).toBe(BUILD_ID);
  });

  it("is empty for a build whose sessions RLS hides", async () => {
    answer({ data: [] });
    expect(await listBuildSessions(BUILD_ID)).toEqual([]);
  });
});

describe("getSessionPrompts", () => {
  it("returns only prompt events, in ordinal order", async () => {
    const prompts = await getSessionPrompts(IMPORT_ID);
    expect(loadImportProposal).toHaveBeenCalledWith(IMPORT_ID);
    expect(prompts.map((p) => [p.ordinal, p.text])).toEqual([
      [1, "First"],
      [2, "Second"],
    ]);
    expect(prompts[0].sourceRef).toEqual(ref(1));
  });

  it("passes on the refusal when the session is gone", async () => {
    loadImportProposal.mockRejectedValue(new Error("This import has no proposal to review."));
    await expect(getSessionPrompts(IMPORT_ID)).rejects.toThrow(/no proposal/);
  });
});

describe("attachSession", () => {
  it("claims into a new draft titled from the proposal, with nothing from the conversation kept", async () => {
    answer({ data: { id: IMPORT_ID, status: "parsed", build_id: null } });
    const id = await attachSession(IMPORT_ID, { kind: "new" });

    expect(id).toBe(BUILD_ID);
    const [importId, passed, selections, destination] = claimImport.mock.calls[0];
    expect(importId).toBe(IMPORT_ID);
    expect(passed).toEqual(proposal());
    expect([...selections.eventOrdinals]).toEqual([]);
    expect([...selections.nodeLocalIds]).toEqual([]);
    expect(selections.outcome).toBe(false);
    expect(selections.title).toBe(true);
    expect(destination).toEqual({ kind: "new", title: "Inbox triage agent" });
    expect(refreshMakingStats).toHaveBeenCalledWith(BUILD_ID);
  });

  it("titles a new draft Untitled build when the proposal has no title", async () => {
    loadImportProposal.mockResolvedValue(proposal(null));
    answer({ data: { id: IMPORT_ID, status: "parsed", build_id: null } });
    await attachSession(IMPORT_ID, { kind: "new" });
    expect(claimImport.mock.calls[0][3]).toEqual({ kind: "new", title: "Untitled build" });
  });

  it("claims into an existing draft without keeping the title", async () => {
    answer({ data: { id: IMPORT_ID, status: "parsed", build_id: null } });
    await attachSession(IMPORT_ID, { kind: "existing", buildId: BUILD_ID });
    const [, , selections, destination] = claimImport.mock.calls[0];
    expect(selections.title).toBe(false);
    expect(destination).toEqual({ kind: "existing", buildId: BUILD_ID });
  });

  it("refuses a session that is already claimed, before any draft is created", async () => {
    answer({ data: { id: IMPORT_ID, status: "claimed", build_id: BUILD_ID } });
    await expect(attachSession(IMPORT_ID, { kind: "new" })).rejects.toThrow(/already in a build/);
    expect(claimImport).not.toHaveBeenCalled();
    expect(refreshMakingStats).not.toHaveBeenCalled();
  });

  it("refuses a session RLS hides or that is gone", async () => {
    answer({ data: null });
    await expect(attachSession(IMPORT_ID, { kind: "new" })).rejects.toThrow(/no longer available/);
    expect(claimImport).not.toHaveBeenCalled();
  });

  it("does not refresh stats when the claim itself fails (a second tab won the race)", async () => {
    answer({ data: { id: IMPORT_ID, status: "parsed", build_id: null } });
    claimImport.mockRejectedValue(new Error("already claimed"));
    await expect(attachSession(IMPORT_ID, { kind: "new" })).rejects.toThrow(/already claimed/);
    expect(refreshMakingStats).not.toHaveBeenCalled();
  });
});

describe("removeSession", () => {
  it("calls discardImport, which leaves a claimed or vanished row alone", async () => {
    await removeSession(IMPORT_ID);
    expect(discardImport).toHaveBeenCalledWith(IMPORT_ID);
  });
});

describe("setSessionModel", () => {
  it("stores the trimmed text and refreshes the build it is in", async () => {
    answer({ data: [{ id: IMPORT_ID, build_id: BUILD_ID }] });
    await setSessionModel(IMPORT_ID, "  Sonnet 5.5 ");
    expect((callOf("update")?.args[0] as { model: unknown }).model).toBe("Sonnet 5.5");
    expect(callOf("eq")?.args).toEqual(["id", IMPORT_ID]);
    expect(refreshMakingStats).toHaveBeenCalledWith(BUILD_ID);
  });

  it("stores null for empty text, and does not refresh a session with no build", async () => {
    answer({ data: [{ id: IMPORT_ID, build_id: null }] });
    await setSessionModel(IMPORT_ID, "   ");
    expect((callOf("update")?.args[0] as { model: unknown }).model).toBeNull();
    expect(refreshMakingStats).not.toHaveBeenCalled();
  });

  it("refuses more than 64 characters without writing", async () => {
    await expect(setSessionModel(IMPORT_ID, "m".repeat(65))).rejects.toThrow(/64/);
    expect(methods()).not.toContain("update");
    await setSessionModel(IMPORT_ID, "m".repeat(64)).catch(() => undefined);
    expect(methods()).toContain("update");
  });

  it("says so when the row is gone", async () => {
    answer({ data: [] });
    await expect(setSessionModel(IMPORT_ID, "x")).rejects.toThrow(/no longer available/);
    expect(refreshMakingStats).not.toHaveBeenCalled();
  });
});

describe("countDraftBuilds", () => {
  it("counts the signed-in creator's drafts with a head request", async () => {
    answer({ count: 3 });
    expect(await countDraftBuilds()).toBe(3);
    expect(callOf("from")?.args).toEqual(["builds"]);
    expect(callOf("select")?.args).toEqual(["id", { count: "exact", head: true }]);
    expect(calls.filter((c) => c.method === "eq").map((c) => c.args)).toEqual([
      ["creator_id", USER_ID],
      ["status", "draft"],
    ]);
  });

  it("is 0 when signed out, without asking the database", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    expect(await countDraftBuilds()).toBe(0);
    expect(fromTable).not.toHaveBeenCalled();
  });

  it("is 0 when the count is null, and throws on an error", async () => {
    answer({ count: null });
    expect(await countDraftBuilds()).toBe(0);
    answer({ error: { message: "x" } });
    await expect(countDraftBuilds()).rejects.toThrow(/countDraftBuilds/);
  });
});
