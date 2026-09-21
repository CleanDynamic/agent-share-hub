// provenance.ts — how a build arrived (EX-P14).
//
// What is under test is the SHAPE and the SILENCE. The shape, because the three
// cases differ in exactly the way that matters — a new build states the whole
// record, an existing draft that had nothing gets the honest "mixed", and an
// existing draft that had something keeps every key it had. The silence,
// because this write runs after the creator's conversation is already safely in
// their draft, so a failure here must never surface as a failed claim, and must
// never put anything in a log but a code and an id.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Call {
  method: string;
  args: unknown[];
}

/** A recording query builder, awaited for `result`. The shape imports.test uses. */
function chain(result: { data?: unknown; error: unknown }, calls: Call[]) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "update", "maybeSingle"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

const tableCalls: Call[] = [];
let tableResults: { data?: unknown; error: unknown }[] = [];
const fromTable = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => fromTable(table) },
}));

import {
  getCreatedVia,
  nextCreatedVia,
  parseCreatedVia,
  recordCreatedVia,
  type ImportArrival,
} from "./provenance";

const BUILD_ID = "33333333-0000-4000-8000-000000000003";
const IMPORT_ID = "11111111-0000-4000-8000-000000000001";
const SECOND_IMPORT = "11111111-0000-4000-8000-000000000002";

const NEW_ARRIVAL: ImportArrival = {
  destination: "new",
  importId: IMPORT_ID,
  client: "claude-code",
  readerId: "claude",
};

const EXISTING_ARRIVAL: ImportArrival = {
  destination: "existing",
  importId: SECOND_IMPORT,
  client: "chatgpt",
  readerId: "transcript",
};

/** The patch the update was called with. */
function updatePatch(): Record<string, unknown> {
  const update = tableCalls.find((call) => call.method === "update");
  return (update?.args[0] ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
  tableCalls.length = 0;
  tableResults = [];
  fromTable.mockReset();
  fromTable.mockImplementation(() =>
    chain(tableResults.shift() ?? { data: null, error: null }, tableCalls),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

// -----------------------------------------------------------------------------

describe("nextCreatedVia — a new build", () => {
  it("states the whole record: source, client, reader and this one import", () => {
    expect(nextCreatedVia(null, NEW_ARRIVAL)).toEqual({
      source: "connector",
      client: "claude-code",
      reader_id: "claude",
      imports: [IMPORT_ID],
    });
  });

  it("carries nulls rather than dropping the keys when the caller said nothing", () => {
    expect(nextCreatedVia(null, { destination: "new", importId: IMPORT_ID })).toEqual({
      source: "connector",
      client: null,
      reader_id: null,
      imports: [IMPORT_ID],
    });
  });
});

describe("nextCreatedVia — an existing draft with nothing recorded", () => {
  it("is mixed, and names neither the client nor the reader", () => {
    expect(nextCreatedVia(null, EXISTING_ARRIVAL)).toEqual({
      source: "mixed",
      imports: [SECOND_IMPORT],
    });
  });

  it("treats a value that is not an object as nothing recorded", () => {
    for (const stored of ["connector", 7, true, [], null, undefined]) {
      expect(nextCreatedVia(stored, EXISTING_ARRIVAL)).toEqual({
        source: "mixed",
        imports: [SECOND_IMPORT],
      });
    }
  });
});

describe("nextCreatedVia — an existing draft that already has something", () => {
  const stored = {
    source: "connector",
    client: "claude-code",
    reader_id: "claude",
    imports: [IMPORT_ID],
  };

  it("appends the import and changes nothing else", () => {
    expect(nextCreatedVia(stored, EXISTING_ARRIVAL)).toEqual({
      source: "connector",
      client: "claude-code",
      reader_id: "claude",
      imports: [IMPORT_ID, SECOND_IMPORT],
    });
  });

  it("does not overwrite the source with the arriving one", () => {
    const next = nextCreatedVia(stored, EXISTING_ARRIVAL) as { source: string; client: string };
    expect(next.source).toBe("connector");
    expect(next.client).toBe("claude-code");
  });

  it("keeps a key this code has never heard of", () => {
    const next = nextCreatedVia({ ...stored, added_by_a_later_step: { a: 1 } }, EXISTING_ARRIVAL);
    expect(next.added_by_a_later_step).toEqual({ a: 1 });
  });

  it("does not add the same import twice", () => {
    const again = { destination: "existing", importId: IMPORT_ID } as const;
    expect(nextCreatedVia(stored, again)).toEqual(stored);
  });

  it("rebuilds an imports value that is not an array", () => {
    expect(nextCreatedVia({ source: "mixed", imports: "nonsense" }, EXISTING_ARRIVAL)).toEqual({
      source: "mixed",
      imports: [SECOND_IMPORT],
    });
  });

  it("drops entries in imports that are not ids", () => {
    const next = nextCreatedVia(
      { source: "mixed", imports: [IMPORT_ID, 4, null, { id: "x" }] },
      EXISTING_ARRIVAL,
    );
    expect(next.imports).toEqual([IMPORT_ID, SECOND_IMPORT]);
  });
});

describe("parseCreatedVia", () => {
  it("is null for anything that is not an object carrying imports", () => {
    for (const value of [null, undefined, "connector", 3, [], {}, { imports: [] }]) {
      expect(parseCreatedVia(value)).toBeNull();
    }
  });

  it("reads the four fields", () => {
    expect(
      parseCreatedVia({
        source: "connector",
        client: "cursor",
        reader_id: "transcript",
        imports: [IMPORT_ID],
      }),
    ).toEqual({
      source: "connector",
      client: "cursor",
      reader_id: "transcript",
      imports: [IMPORT_ID],
    });
  });

  it("calls any source that is not 'connector' mixed", () => {
    expect(parseCreatedVia({ source: "something-else", imports: [IMPORT_ID] })?.source).toBe(
      "mixed",
    );
  });

  it("nulls a client that is not a string rather than printing it", () => {
    const parsed = parseCreatedVia({ source: "mixed", client: { evil: true }, imports: [IMPORT_ID] });
    expect(parsed?.client).toBeNull();
  });
});

// -----------------------------------------------------------------------------

describe("getCreatedVia", () => {
  it("reads the one column, by id, for one build", async () => {
    tableResults = [{ data: { created_via: { source: "mixed", imports: [IMPORT_ID] } }, error: null }];

    const result = await getCreatedVia(BUILD_ID);

    expect(fromTable).toHaveBeenCalledWith("builds");
    expect(tableCalls[0]).toEqual({ method: "select", args: ["created_via"] });
    expect(tableCalls[1]).toEqual({ method: "eq", args: ["id", BUILD_ID] });
    expect(result).toEqual({
      source: "mixed",
      client: null,
      reader_id: null,
      imports: [IMPORT_ID],
    });
  });

  it("answers null for a build with nothing recorded", async () => {
    tableResults = [{ data: { created_via: null }, error: null }];
    expect(await getCreatedVia(BUILD_ID)).toBeNull();
  });

  it("answers null rather than throwing when the row cannot be read", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    tableResults = [{ data: null, error: { code: "42501", message: "permission denied for x" } }];

    expect(await getCreatedVia(BUILD_ID)).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.any(String), { code: "42501", buildId: BUILD_ID });
  });
});

describe("recordCreatedVia", () => {
  it("writes the connector record for a new build, without reading first", async () => {
    tableResults = [{ error: null }];

    await recordCreatedVia(BUILD_ID, NEW_ARRIVAL);

    expect(tableCalls.some((call) => call.method === "select")).toBe(false);
    expect(updatePatch()).toEqual({
      created_via: {
        source: "connector",
        client: "claude-code",
        reader_id: "claude",
        imports: [IMPORT_ID],
      },
    });
    expect(tableCalls.at(-1)).toEqual({ method: "eq", args: ["id", BUILD_ID] });
  });

  it("reads what a draft already has before appending to it", async () => {
    tableResults = [
      { data: { created_via: { source: "connector", client: "claude", imports: [IMPORT_ID] } }, error: null },
      { error: null },
    ];

    await recordCreatedVia(BUILD_ID, EXISTING_ARRIVAL);

    expect(tableCalls[0]).toEqual({ method: "select", args: ["created_via"] });
    expect(updatePatch()).toEqual({
      created_via: {
        source: "connector",
        client: "claude",
        imports: [IMPORT_ID, SECOND_IMPORT],
      },
    });
  });

  it("writes mixed when the draft had nothing recorded", async () => {
    tableResults = [{ data: { created_via: null }, error: null }, { error: null }];

    await recordCreatedVia(BUILD_ID, EXISTING_ARRIVAL);

    expect(updatePatch()).toEqual({
      created_via: { source: "mixed", imports: [SECOND_IMPORT] },
    });
  });

  it("never throws when the write fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    tableResults = [{ error: { code: "42501" } }];

    await expect(recordCreatedVia(BUILD_ID, NEW_ARRIVAL)).resolves.toBeUndefined();
  });

  it("never throws when the read fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    tableResults = [{ data: null, error: { code: "PGRST116" } }];

    await expect(recordCreatedVia(BUILD_ID, EXISTING_ARRIVAL)).resolves.toBeUndefined();
  });

  /**
   * The contract's ninth prohibition, on the browser side of the same feature:
   * sizes, counts, states and ids only. A log line is the wrong place to find a
   * database message, because a database message can quote a value.
   */
  it("logs a code and the build id, and nothing else", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    tableResults = [{ error: { code: "23514", message: "violates check constraint", details: "Failing row contains (…)" } }];

    await recordCreatedVia(BUILD_ID, NEW_ARRIVAL);

    expect(warn).toHaveBeenCalledTimes(1);
    const [, payload] = warn.mock.calls[0];
    expect(payload).toEqual({ code: "23514", buildId: BUILD_ID });
  });

  it("says 'unknown' when the failure carries no code", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    tableResults = [{ error: { message: "boom" } }];

    await recordCreatedVia(BUILD_ID, NEW_ARRIVAL);

    expect(warn.mock.calls[0][1]).toEqual({ code: "unknown", buildId: BUILD_ID });
  });
});
