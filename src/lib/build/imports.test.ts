// imports.ts — the browser's half of the extractive connector (EX-P09, EX-P10).
//
// What is under test is the ORDER and the CONDITIONS, because those are what
// the e2e stub cannot prove: that the draft is created before the import row
// is touched, that the row is marked claimed only while it is still parsed,
// that a claim that finds no row says so rather than writing twice, and that a
// discard sweeps whatever chunk objects finish_import left behind. The client
// is mocked at the one boundary this module talks through.
//
// EX-P10 adds the second destination: a claim into an EXISTING draft never
// creates a build, checks the draft is the creator's own and still a draft
// before anything is written, and refuses with the connector's own wording
// when it is not. The writer is mocked, so what is proved here is that it is
// called with the chosen draft and nothing else is written around it.
//
// EX-P14 adds the provenance record, and it is mocked for the same reason: what
// belongs here is that the claim calls it LAST, with the destination the
// creator actually took and the two values read back off the row it was already
// updating. What it then stores, and that it never throws, are
// provenance.test.ts's subject.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TranscriptProposal } from "./intake";

interface Call {
  method: string;
  args: unknown[];
}

/**
 * A recording query builder. Every method returns the same chain and is
 * awaited for `result`, so a test reads the calls back in order and decides
 * what the "database" answered.
 */
function chain(result: { data: unknown; error: unknown }, calls: Call[]) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "in", "order", "limit", "update", "maybeSingle"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

const tableCalls: Call[] = [];
let tableResults: { data: unknown; error: unknown }[] = [];
const fromTable = vi.fn();

const storageList = vi.fn();
const storageRemove = vi.fn();
const getSession = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => fromTable(table),
    auth: { getSession: () => getSession() },
    storage: {
      from: () => ({
        list: (...args: unknown[]) => storageList(...args),
        remove: (...args: unknown[]) => storageRemove(...args),
      }),
    },
  },
}));

const createBuild = vi.fn();
const getBuildHeader = vi.fn();
const listDraftBuildsByCreator = vi.fn();
vi.mock("./builds", () => ({
  createBuild: (...args: unknown[]) => createBuild(...args),
  getBuildHeader: (...args: unknown[]) => getBuildHeader(...args),
  listDraftBuildsByCreator: (...args: unknown[]) => listDraftBuildsByCreator(...args),
}));

const materialiseProposal = vi.fn();
vi.mock("./intake", () => ({
  materialiseProposal: (...args: unknown[]) => materialiseProposal(...args),
}));

/**
 * The provenance write is mocked, so what is proved here is that the claim
 * CALLS it, with the destination it actually took and the two values it read
 * back off the row. What it then stores is provenance.test.ts's subject.
 */
const recordCreatedVia = vi.fn();
vi.mock("./provenance", () => ({
  recordCreatedVia: (...args: unknown[]) => recordCreatedVia(...args),
}));

import {
  claimImport,
  discardImport,
  listClaimTargets,
  listWaitingImports,
  loadImportProposal,
} from "./imports";

const IMPORT_ID = "11111111-0000-4000-8000-000000000001";
const USER_ID = "22222222-0000-4000-8000-000000000002";
const BUILD_ID = "33333333-0000-4000-8000-000000000003";
const OTHER_BUILD_ID = "44444444-0000-4000-8000-000000000004";
const OTHER_USER_ID = "55555555-0000-4000-8000-000000000005";

const NEW_BUILD = { kind: "new", title: "Untitled build" } as const;
const INTO_DRAFT = { kind: "existing", buildId: BUILD_ID } as const;

/**
 * What the claim's UPDATE returns. `client` and `reader_id` ride the RETURNING
 * clause of a write that was happening anyway, so the provenance record costs
 * no second read of a row this function has already touched.
 */
const CLAIMED_ROW = { id: IMPORT_ID, client: "claude-code", reader_id: "claude" };

/** What the writer reports. The claim hands it back unchanged. */
const WRITTEN = {
  events: 1,
  nodes: 0,
  titleApplied: false,
  outcomeApplied: false,
  alreadyMaterialised: false,
};

/** A build header as getBuildHeader returns it, with only what the check reads. */
function header(overrides: Record<string, unknown> = {}) {
  return { id: BUILD_ID, creator_id: USER_ID, status: "draft", title: "Inbox triage agent", ...overrides };
}

const proposal: TranscriptProposal = {
  events: [
    {
      ordinal: 1,
      kind: "prompt",
      visibility: "public",
      occurred_at: null,
      payload: { text: "Build me a thing", response_summary: null },
      source_ref: { source: "transcript", session_id: IMPORT_ID, index: 1 },
      inferred: false,
      inferred_reason: null,
    },
  ],
  nodes: [],
  summary: {
    session_id: IMPORT_ID,
    source_hint: null,
    detected_format: "labelled",
    detected_labels: { user: ["You"], assistant: ["Claude"] },
    turn_count: 2,
    user_turn_count: 1,
    assistant_turn_count: 1,
    event_count: 1,
    node_count: 0,
    character_count: 40,
    line_count: 4,
    proposed_title: null,
    proposed_outcome: null,
  },
  warnings: [],
};

const selections = {
  eventOrdinals: new Set([1]),
  nodeLocalIds: new Set<string>(),
  title: false,
  outcome: false,
};

function answer(...results: { data: unknown; error: unknown }[]) {
  tableResults = results;
}

beforeEach(() => {
  tableCalls.length = 0;
  tableResults = [];
  fromTable.mockReset();
  fromTable.mockImplementation((table: string) => {
    tableCalls.push({ method: "from", args: [table] });
    const result = tableResults.shift() ?? { data: null, error: null };
    return chain(result, tableCalls);
  });
  createBuild.mockReset();
  createBuild.mockResolvedValue({ id: BUILD_ID });
  getBuildHeader.mockReset();
  getBuildHeader.mockResolvedValue(header());
  listDraftBuildsByCreator.mockReset();
  listDraftBuildsByCreator.mockResolvedValue([]);
  getSession.mockReset();
  getSession.mockResolvedValue({ data: { session: { user: { id: USER_ID } } }, error: null });
  materialiseProposal.mockReset();
  materialiseProposal.mockResolvedValue(WRITTEN);
  recordCreatedVia.mockReset();
  recordCreatedVia.mockResolvedValue(undefined);
  storageList.mockReset();
  storageList.mockResolvedValue({ data: [], error: null });
  storageRemove.mockReset();
  storageRemove.mockResolvedValue({ data: [], error: null });
});

const methods = () => tableCalls.map((call) => call.method);
const callOf = (method: string) => tableCalls.find((call) => call.method === method);

describe("listWaitingImports", () => {
  it("reads the parsed rows newest first, capped, by named columns, and maps the counts", async () => {
    answer({
      data: [
        {
          id: IMPORT_ID,
          client: "claude-code",
          source_hint: null,
          reader_id: "transcript",
          detection_reason: "Split as labelled into 84 turns.",
          total_chars: 120000,
          secret_findings: [{ kind: "openai_key", count: 2 }, { kind: 7 }],
          target_build_id: null,
          created_at: "2026-09-17T10:00:00Z",
          expires_at: "2026-09-24T10:00:00Z",
          turn_count: 84,
          event_count: 42,
          node_count: null,
          detected_format: "labelled",
        },
      ],
      error: null,
    });

    const rows = await listWaitingImports();

    expect(callOf("from")?.args).toEqual(["import_sessions"]);
    const select = String(callOf("select")?.args[0]);
    expect(select).not.toContain("*");
    expect(select).toContain("event_count:proposal->summary->event_count");
    expect(callOf("eq")?.args).toEqual(["status", "parsed"]);
    expect(callOf("order")?.args).toEqual(["created_at", { ascending: false }]);
    expect(callOf("limit")?.args).toEqual([20]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: IMPORT_ID,
      client: "claude-code",
      turn_count: 84,
      event_count: 42,
      node_count: 0,
      detected_format: "labelled",
    });
    // A malformed finding is dropped; a well-formed one keeps kind and count only.
    expect(rows[0].secret_findings).toEqual([{ kind: "openai_key", count: 2 }]);
  });
});

describe("loadImportProposal", () => {
  it("returns the stored envelope", async () => {
    answer({ data: { proposal }, error: null });
    await expect(loadImportProposal(IMPORT_ID)).resolves.toEqual(proposal);
    expect(callOf("eq")?.args).toEqual(["id", IMPORT_ID]);
  });

  it("refuses a row with no proposal on it", async () => {
    answer({ data: { proposal: null }, error: null });
    await expect(loadImportProposal(IMPORT_ID)).rejects.toThrow(/no proposal to review/);
  });
});

describe("claimImport into a new build", () => {
  it("creates the draft, writes it, then marks the row claimed — in that order", async () => {
    answer({ data: [CLAIMED_ROW], error: null });

    const claimed = await claimImport(IMPORT_ID, proposal, selections, NEW_BUILD);

    expect(claimed).toEqual({ buildId: BUILD_ID, counts: WRITTEN });
    expect(createBuild).toHaveBeenCalledWith({ title: "Untitled build" });
    expect(getBuildHeader).not.toHaveBeenCalled();
    expect(materialiseProposal).toHaveBeenCalledWith(BUILD_ID, proposal, selections);
    // The row is touched only after the build exists and is written.
    expect(createBuild.mock.invocationCallOrder[0]).toBeLessThan(
      materialiseProposal.mock.invocationCallOrder[0],
    );
    expect(materialiseProposal.mock.invocationCallOrder[0]).toBeLessThan(
      fromTable.mock.invocationCallOrder[0],
    );

    expect(callOf("update")?.args[0]).toMatchObject({ status: "claimed", build_id: BUILD_ID });
    const eqs = tableCalls.filter((call) => call.method === "eq").map((call) => call.args);
    expect(eqs).toEqual([
      ["id", IMPORT_ID],
      ["status", "parsed"],
    ]);
    expect(methods()).toEqual(["from", "update", "eq", "eq", "select"]);
    expect(callOf("select")?.args).toEqual(["id, client, reader_id"]);
  });

  it("records the provenance last, naming the client and reader off the row", async () => {
    answer({ data: [CLAIMED_ROW], error: null });

    await claimImport(IMPORT_ID, proposal, selections, NEW_BUILD);

    expect(recordCreatedVia).toHaveBeenCalledWith(BUILD_ID, {
      destination: "new",
      importId: IMPORT_ID,
      client: "claude-code",
      readerId: "claude",
    });
    // Last: everything that matters is written before the label is attempted.
    expect(fromTable.mock.invocationCallOrder[0]).toBeLessThan(
      recordCreatedVia.mock.invocationCallOrder[0],
    );
  });

  it("records nulls rather than inventing a client the row did not carry", async () => {
    answer({ data: [{ id: IMPORT_ID }], error: null });

    await claimImport(IMPORT_ID, proposal, selections, NEW_BUILD);

    expect(recordCreatedVia).toHaveBeenCalledWith(BUILD_ID, {
      destination: "new",
      importId: IMPORT_ID,
      client: null,
      readerId: null,
    });
  });

  it("says so when the row was already claimed, instead of pretending", async () => {
    answer({ data: [], error: null });
    await expect(claimImport(IMPORT_ID, proposal, selections, NEW_BUILD)).rejects.toThrow(
      /already claimed/,
    );
  });

  it("does not touch the row when the write fails", async () => {
    materialiseProposal.mockRejectedValueOnce(new Error("insert refused"));
    await expect(claimImport(IMPORT_ID, proposal, selections, NEW_BUILD)).rejects.toThrow(
      /insert refused/,
    );
    expect(fromTable).not.toHaveBeenCalled();
  });
});

describe("claimImport into an existing draft", () => {
  it("never creates a build: it checks the draft, writes through the same writer, and marks the row with that draft", async () => {
    answer({ data: [CLAIMED_ROW], error: null });

    const claimed = await claimImport(IMPORT_ID, proposal, selections, INTO_DRAFT);

    expect(claimed).toEqual({ buildId: BUILD_ID, counts: WRITTEN });
    expect(createBuild).not.toHaveBeenCalled();
    expect(getBuildHeader).toHaveBeenCalledWith(BUILD_ID);
    expect(materialiseProposal).toHaveBeenCalledWith(BUILD_ID, proposal, selections);
    // The draft is checked before anything is written, and the row is touched last.
    expect(getBuildHeader.mock.invocationCallOrder[0]).toBeLessThan(
      materialiseProposal.mock.invocationCallOrder[0],
    );
    expect(materialiseProposal.mock.invocationCallOrder[0]).toBeLessThan(
      fromTable.mock.invocationCallOrder[0],
    );

    expect(callOf("update")?.args[0]).toMatchObject({ status: "claimed", build_id: BUILD_ID });
    const eqs = tableCalls.filter((call) => call.method === "eq").map((call) => call.args);
    expect(eqs).toEqual([
      ["id", IMPORT_ID],
      ["status", "parsed"],
    ]);
    expect(methods()).toEqual(["from", "update", "eq", "eq", "select"]);
  });

  /**
   * The destination is passed through as the creator chose it, because that is
   * the whole difference between the two shapes provenance stores: a new build
   * states the connector record, an existing draft appends to whatever it has.
   */
  it("records the provenance against the chosen draft, as an existing destination", async () => {
    answer({ data: [CLAIMED_ROW], error: null });

    await claimImport(IMPORT_ID, proposal, selections, INTO_DRAFT);

    expect(recordCreatedVia).toHaveBeenCalledWith(BUILD_ID, {
      destination: "existing",
      importId: IMPORT_ID,
      client: "claude-code",
      readerId: "claude",
    });
  });

  /**
   * The label is the last thing and the least of them: by the time it runs the
   * conversation is in the draft and the import is marked claimed, so a failure
   * there must not become a failed claim. THAT GUARANTEE LIVES IN
   * recordCreatedVia, WHICH DOES NOT THROW, and it is proved in
   * provenance.test.ts rather than here — this file mocks the function away, so
   * a test here could only prove something about the mock.
   */
  it("hands back the claim once the provenance record has settled", async () => {
    answer({ data: [CLAIMED_ROW], error: null });

    const claimed = await claimImport(IMPORT_ID, proposal, selections, INTO_DRAFT);

    expect(claimed).toEqual({ buildId: BUILD_ID, counts: WRITTEN });
    expect(recordCreatedVia).toHaveBeenCalledTimes(1);
  });

  it("hands back what the writer wrote, so a draft that already held the conversation reports nothing added", async () => {
    answer({ data: [CLAIMED_ROW], error: null });
    const nothing = { ...WRITTEN, events: 0, alreadyMaterialised: true };
    materialiseProposal.mockResolvedValueOnce(nothing);

    const claimed = await claimImport(IMPORT_ID, proposal, selections, INTO_DRAFT);

    expect(claimed.counts).toEqual(nothing);
  });

  it("refuses a draft that does not exist with the connector's wording, and writes nothing", async () => {
    getBuildHeader.mockResolvedValueOnce(null);

    await expect(claimImport(IMPORT_ID, proposal, selections, INTO_DRAFT)).rejects.toThrow(
      "No draft with that id belongs to this account. Call buildgallery_list_drafts to see the " +
        "available drafts, or omit target_build_id to create a new build.",
    );
    expect(createBuild).not.toHaveBeenCalled();
    expect(materialiseProposal).not.toHaveBeenCalled();
    expect(fromTable).not.toHaveBeenCalled();
  });

  it("refuses a draft that belongs to someone else exactly as it refuses a missing one", async () => {
    getBuildHeader.mockResolvedValueOnce(header({ id: OTHER_BUILD_ID, creator_id: OTHER_USER_ID }));

    await expect(
      claimImport(IMPORT_ID, proposal, selections, { kind: "existing", buildId: OTHER_BUILD_ID }),
    ).rejects.toThrow(/No draft with that id belongs to this account/);
    expect(materialiseProposal).not.toHaveBeenCalled();
    expect(fromTable).not.toHaveBeenCalled();
  });

  it("refuses a published build with the connector's wording, and writes nothing", async () => {
    getBuildHeader.mockResolvedValueOnce(header({ status: "published" }));

    await expect(claimImport(IMPORT_ID, proposal, selections, INTO_DRAFT)).rejects.toThrow(
      "That build is published, and the connector only adds to drafts. Choose a draft, or omit " +
        "target_build_id to create a new build.",
    );
    expect(materialiseProposal).not.toHaveBeenCalled();
    expect(fromTable).not.toHaveBeenCalled();
  });

  it("refuses to check anything without a signed-in creator", async () => {
    getSession.mockResolvedValueOnce({ data: { session: null }, error: null });

    await expect(claimImport(IMPORT_ID, proposal, selections, INTO_DRAFT)).rejects.toThrow(
      /no signed-in user/,
    );
    expect(getBuildHeader).not.toHaveBeenCalled();
    expect(materialiseProposal).not.toHaveBeenCalled();
  });
});

describe("listClaimTargets", () => {
  it("reuses listDraftBuildsByCreator for the signed-in creator and adds each draft's counts by named columns", async () => {
    listDraftBuildsByCreator.mockResolvedValueOnce([
      { id: BUILD_ID, title: "Inbox triage agent", updated_at: "2026-09-16T10:00:00Z" },
      { id: OTHER_BUILD_ID, title: "Older notes", updated_at: "2026-09-12T10:00:00Z" },
    ]);
    answer({
      data: [
        { id: OTHER_BUILD_ID, build_nodes: [{ count: 0 }], build_events: [] },
        { id: BUILD_ID, build_nodes: [{ count: 4 }], build_events: [{ count: 12 }] },
      ],
      error: null,
    });

    const targets = await listClaimTargets();

    expect(listDraftBuildsByCreator).toHaveBeenCalledWith(USER_ID);
    expect(callOf("from")?.args).toEqual(["builds"]);
    const select = String(callOf("select")?.args[0]);
    expect(select).not.toContain("*");
    expect(select).toBe("id, build_nodes(count), build_events(count)");
    expect(callOf("in")?.args).toEqual(["id", [BUILD_ID, OTHER_BUILD_ID]]);
    expect(callOf("limit")?.args).toEqual([2]);

    // The drafts keep their order — most recently worked on first — whatever
    // order the counts came back in, and an absent count is zero.
    expect(targets).toEqual([
      { id: BUILD_ID, title: "Inbox triage agent", updated_at: "2026-09-16T10:00:00Z", part_count: 4, step_count: 12 },
      { id: OTHER_BUILD_ID, title: "Older notes", updated_at: "2026-09-12T10:00:00Z", part_count: 0, step_count: 0 },
    ]);
  });

  it("reads no counts when the creator has no drafts", async () => {
    await expect(listClaimTargets()).resolves.toEqual([]);
    expect(fromTable).not.toHaveBeenCalled();
  });
});

describe("discardImport", () => {
  it("marks the row expired while it is still parsed, then sweeps the owner's chunk folder", async () => {
    answer({ data: [{ user_id: USER_ID }], error: null });
    storageList.mockResolvedValueOnce({
      data: [
        { id: "o1", name: "1.txt" },
        { id: "o2", name: "2.txt" },
        // A folder placeholder, which storage lists with a null id.
        { id: null, name: "stray" },
      ],
      error: null,
    });

    await discardImport(IMPORT_ID);

    expect(callOf("update")?.args[0]).toMatchObject({ status: "expired" });
    const eqs = tableCalls.filter((call) => call.method === "eq").map((call) => call.args);
    expect(eqs).toEqual([
      ["id", IMPORT_ID],
      ["status", "parsed"],
    ]);
    expect(storageList).toHaveBeenCalledWith(`${USER_ID}/${IMPORT_ID}`, expect.anything());
    expect(storageRemove).toHaveBeenCalledWith([
      `${USER_ID}/${IMPORT_ID}/1.txt`,
      `${USER_ID}/${IMPORT_ID}/2.txt`,
    ]);
  });

  it("removes nothing when there is nothing left in the bucket", async () => {
    answer({ data: [{ user_id: USER_ID }], error: null });
    await discardImport(IMPORT_ID);
    expect(storageList).toHaveBeenCalledTimes(1);
    expect(storageRemove).not.toHaveBeenCalled();
  });

  it("leaves storage alone when no parsed row was found to expire", async () => {
    answer({ data: [], error: null });
    await discardImport(IMPORT_ID);
    expect(storageList).not.toHaveBeenCalled();
    expect(storageRemove).not.toHaveBeenCalled();
  });
});
