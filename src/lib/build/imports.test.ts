// imports.ts — the browser's half of the extractive connector (EX-P09).
//
// What is under test is the ORDER and the CONDITIONS, because those are what
// the e2e stub cannot prove: that the draft is created before the import row
// is touched, that the row is marked claimed only while it is still parsed,
// that a claim that finds no row says so rather than writing twice, and that a
// discard sweeps whatever chunk objects finish_import left behind. The client
// is mocked at the one boundary this module talks through.

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
  for (const method of ["select", "eq", "neq", "order", "limit", "update", "maybeSingle"]) {
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

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => fromTable(table),
    storage: {
      from: () => ({
        list: (...args: unknown[]) => storageList(...args),
        remove: (...args: unknown[]) => storageRemove(...args),
      }),
    },
  },
}));

const createBuild = vi.fn();
vi.mock("./builds", () => ({
  createBuild: (...args: unknown[]) => createBuild(...args),
}));

const materialiseProposal = vi.fn();
vi.mock("./intake", () => ({
  materialiseProposal: (...args: unknown[]) => materialiseProposal(...args),
}));

import {
  claimImport,
  discardImport,
  listWaitingImports,
  loadImportProposal,
} from "./imports";

const IMPORT_ID = "11111111-0000-4000-8000-000000000001";
const USER_ID = "22222222-0000-4000-8000-000000000002";
const BUILD_ID = "33333333-0000-4000-8000-000000000003";

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
  materialiseProposal.mockReset();
  materialiseProposal.mockResolvedValue({ events: 1, nodes: 0 });
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

describe("claimImport", () => {
  it("creates the draft, writes it, then marks the row claimed — in that order", async () => {
    answer({ data: [{ id: IMPORT_ID }], error: null });

    const buildId = await claimImport(IMPORT_ID, proposal, selections);

    expect(buildId).toBe(BUILD_ID);
    expect(createBuild).toHaveBeenCalledWith({ title: "Untitled build" });
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
  });

  it("says so when the row was already claimed, instead of pretending", async () => {
    answer({ data: [], error: null });
    await expect(claimImport(IMPORT_ID, proposal, selections)).rejects.toThrow(/already claimed/);
  });

  it("does not touch the row when the write fails", async () => {
    materialiseProposal.mockRejectedValueOnce(new Error("insert refused"));
    await expect(claimImport(IMPORT_ID, proposal, selections)).rejects.toThrow(/insert refused/);
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
