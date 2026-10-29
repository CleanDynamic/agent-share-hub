// SV-07 P1: saves can't overwrite each other. Every write of `making` reads it, changes its own path and writes it in one step
// of the build's write queue, so two saves started together both survive. On supabase-js with only the network faked.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("./__audit__/fakeSupabase")).clientModule);

import { REPO_SCHEMA, startAuditBackend, tableRows, type Delay, type Row } from "./__audit__/fakeSupabase";
import { getBuild } from "./builds";
import { patchMaking, setPartOpen, setSessionMeta, setSessionOpen, setWorkstreams } from "./making";
import { setSessionOrder } from "./sessionLayout";
import { flatNodes, noteRecord, watchBuild, type RawClash } from "./staleWrites";

const DRAFT = "0d0d0d0d-0000-4000-8000-000000000001";

const meta = (title: string, workstream?: string) => ({ tool: null, date: "2026-10-24", title, ...(workstream ? { workstream } : null) });

function open(delays: Delay[] = []) {
  startAuditBackend({
    schema: REPO_SCHEMA,
    delays,
    seed: (rows) => {
      const draft = rows.builds.find((row) => row.id === DRAFT) as Row;
      draft.making = {
        sessions_meta: { "typed-s5": meta("Five", "ws-3") },
        workstreams: [{ key: "ws-1", name: "" }, { key: "ws-2", name: "" }, { key: "ws-3", name: "" }],
        session_order: ["typed-s5"],
      };
      // The order lives in `making` alone here, so only `making` is under test.
      rows.build_sessions = rows.build_sessions.filter((row) => row.build_id !== DRAFT);
    },
  });
}

const clashes: RawClash[] = [];
let stop = () => undefined as void;

async function watch() {
  stop = watchBuild(DRAFT, (clash) => void clashes.push(clash));
  const record = await getBuild(DRAFT);
  if (!record) throw new Error("no record");
  noteRecord(DRAFT, { build: record.build as unknown as Record<string, unknown>, tree: flatNodes(record.tree) });
}

const making = () => (tableRows("builds").find((row) => row.id === DRAFT) as Row).making as Record<string, unknown>;

beforeEach(() => {
  clashes.length = 0;
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  stop();
  stop = () => undefined;
  vi.restoreAllMocks();
});

// Writes slow and out of step, so the second read would answer before the first write lands if the read sat outside the queue.
const SLOW: Delay[] = [{ method: "PATCH", path: /\/builds/, delayMs: 40 }];

describe.each([
  ["open in the composer", true],
  ["not watched", false],
])("making, %s", (_label, watched) => {
  beforeEach(async () => {
    open(SLOW);
    if (watched) await watch();
  });

  it("two writes started together, to two sessions' entries, both survive", async () => {
    await Promise.all([setSessionMeta(DRAFT, "typed-s6", meta("Six", "ws-3")), setSessionMeta(DRAFT, "typed-s7", meta("Seven", "ws-1"))]);
    const entries = making().sessions_meta as Record<string, { title?: string; workstream?: string }>;
    expect(Object.keys(entries).sort()).toEqual(["typed-s5", "typed-s6", "typed-s7"]);
    expect(clashes).toHaveLength(0);
  });

  it("a write to session_order and one to sessions_meta started together both survive", async () => {
    await Promise.all([setSessionOrder(DRAFT, ["typed-s5", "typed-s6"]), setSessionMeta(DRAFT, "typed-s6", meta("Six", "ws-3"))]);
    expect(making().session_order).toEqual(["typed-s5", "typed-s6"]);
    expect(Object.keys(making().sessions_meta as object).sort()).toEqual(["typed-s5", "typed-s6"]);
  });

  it("the recorded case: Session 5 stays in Part 3 when Session 6 is added to Part 3 straight after", async () => {
    // Session 5's own save (its part) is still on its way when Session 6's entry and the new order are written.
    await Promise.all([
      setSessionMeta(DRAFT, "typed-s5", meta("Five", "ws-3")),
      setSessionMeta(DRAFT, "typed-s6", meta("Six", "ws-3")),
      setSessionOrder(DRAFT, ["typed-s5", "typed-s6"]),
      patchMaking(DRAFT, { sessions_collapsed: [] }),
    ]);
    const entries = making().sessions_meta as Record<string, { workstream?: string }>;
    expect(entries["typed-s5"].workstream).toBe("ws-3");
    expect(entries["typed-s6"].workstream).toBe("ws-3");
    expect(making().session_order).toEqual(["typed-s5", "typed-s6"]);
  });

  it("parts and a session's entry written together both survive", async () => {
    await Promise.all([
      setWorkstreams(DRAFT, [{ key: "ws-1", name: "" }, { key: "ws-2", name: "" }, { key: "ws-3", name: "" }, { key: "ws-4", name: "" }]),
      setSessionMeta(DRAFT, "typed-s6", meta("Six", "ws-4")),
    ]);
    expect((making().workstreams as unknown[]).length).toBe(4);
    expect(Object.keys(making().sessions_meta as object)).toContain("typed-s6");
  });
});

describe("SV-21: a session or a part opened as a request", () => {
  beforeEach(() => {
    open(SLOW);
  });

  it("marks one session and one part, together with a title written at the same moment, and loses neither", async () => {
    await Promise.all([
      setSessionOpen(DRAFT, "typed-s5", { problem: "  Deploy the worker to Vercel  " }),
      setPartOpen(DRAFT, "ws-2", { problem: "No tests yet" }),
      setSessionMeta(DRAFT, "typed-s5", (current) => ({ ...(current as object), tool: null, date: "2026-10-24", title: "Five!" })),
    ]);
    const entries = making().sessions_meta as Record<string, { title?: string; open?: { problem: string } }>;
    expect(entries["typed-s5"]).toMatchObject({ title: "Five!", open: { problem: "Deploy the worker to Vercel" } });
    const parts = making().workstreams as { key: string; open?: { problem: string } }[];
    expect(parts.map((part) => [part.key, part.open?.problem ?? null])).toEqual([["ws-1", null], ["ws-2", "No tests yet"], ["ws-3", null]]);
  });

  it("takes the request away without touching the rest of the entry", async () => {
    await setSessionOpen(DRAFT, "typed-s5", { problem: "Why" });
    await setSessionOpen(DRAFT, "typed-s5", null);
    const entry = (making().sessions_meta as Record<string, Record<string, unknown>>)["typed-s5"];
    expect(entry.open).toBeUndefined();
    expect(entry.title).toBe("Five");
    await setPartOpen(DRAFT, "ws-1", { problem: "Why" });
    await setPartOpen(DRAFT, "ws-1", null);
    expect((making().workstreams as Record<string, unknown>[])[0]).not.toHaveProperty("open");
  });

  it("refuses a request with no words, and one that is too long", async () => {
    await expect(setSessionOpen(DRAFT, "typed-s5", { problem: "   " })).rejects.toThrow(/Say what the request is for/);
    await expect(setPartOpen(DRAFT, "ws-1", { problem: "x".repeat(501) })).rejects.toThrow(/500 characters/);
  });
});

describe("another tab changes making between this tab's read and its write", () => {
  it("keeps both: the stamp check refuses the stale write, and the merge keeps the other tab's entry", async () => {
    open([{ method: "PATCH", path: /\/builds/, delayMs: 60 }]);
    await watch();
    const writing = setSessionMeta(DRAFT, "typed-s6", meta("Six", "ws-3"));
    // This tab has read `making` and its write is on the way: the other tab writes its own session meanwhile.
    await new Promise((resolve) => setTimeout(resolve, 20));
    const row = tableRows("builds").find((candidate) => candidate.id === DRAFT) as Row;
    const theirs = { ...(row.making as Record<string, unknown>) };
    theirs.sessions_meta = { ...(theirs.sessions_meta as object), "typed-s9": meta("Nine", "ws-1") };
    Object.assign(row, { making: theirs, updated_at: new Date(Date.now() + 5_000).toISOString() });
    await writing;
    expect(Object.keys(making().sessions_meta as object).sort()).toEqual(["typed-s5", "typed-s6", "typed-s9"]);
    expect(clashes).toHaveLength(0);
  });
});
