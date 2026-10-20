// CA-08 Part 2, cause 4 — does the client refuse before any request is made?
//
// The real sessionMetaRefusal, extrasRefusal, extrasOf, newSessionKey, isTypedSession, todayDay and setSessionMeta,
// on exactly what onNewSession passes (SandboxPage.tsx:435-436): `{ tool, date: todayDay() }` under `newSessionKey()`.
// Every test here passes, and so says the refusal is not the cause.

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("./fakeSupabase")).clientModule);

import { extrasOf, extrasRefusal } from "../sessionFacts";
import { isTypedSession, newSessionKey, SESSION_TOOL_MAX, sessionMetaRefusal, sessionsMetaOf, setSessionMeta, todayDay, type SessionMeta } from "../making";
import { REPO_SCHEMA, requests, startAuditBackend, tableRows } from "./fakeSupabase";
import { TYPED_TOOL_MAX } from "@/pages/site/compose/toolPickerModel";

/** making.ts:150, the same pattern. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const zones = ["UTC", "Europe/London", "America/Los_Angeles", "Pacific/Kiritimati", "Pacific/Pago_Pago", "Asia/Kolkata", "Australia/Lord_Howe"];
/** Around Europe/London's midnights in BST, the BST change on 25 October 2026 (02:00 BST -> 01:00 GMT), and the year's end. */
const instants = [
  "2026-10-20T22:59:59Z", "2026-10-20T23:00:00Z", "2026-10-20T23:30:00Z", "2026-10-24T23:00:00Z", "2026-10-25T00:30:00Z",
  "2026-10-25T00:59:59Z", "2026-10-25T01:00:00Z", "2026-10-25T01:30:00Z", "2026-10-25T23:59:59Z", "2026-12-31T23:59:59Z",
  "2027-03-28T00:30:00Z", "2027-03-28T01:30:00Z",
];

const originalTz = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalTz;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("CA-08 · cause 4: what onNewSession passes is never refused", () => {
  it("newSessionKey() is a typed session's key, never a legacy one, for 2,000 keys", () => {
    for (let n = 0; n < 2000; n++) {
      const key = newSessionKey();
      expect(isTypedSession(key)).toBe(true);
      expect(key.startsWith("typed-legacy-")).toBe(false);
    }
  });

  it("…and so is the key made without crypto.randomUUID (the fallback branch)", () => {
    vi.stubGlobal("crypto", {});
    const key = newSessionKey();
    expect(key).toMatch(/^typed-[0-9a-f]+-[0-9a-f]+$/);
    expect(isTypedSession(key)).toBe(true);
  });

  it("todayDay() is always YYYY-MM-DD, in every zone, around midnight and across the BST change", () => {
    for (const zone of zones) {
      process.env.TZ = zone;
      for (const at of instants) {
        vi.useFakeTimers({ now: new Date(at) });
        const day = todayDay();
        expect(day, `${zone} at ${at}`).toMatch(ISO_DAY);
        expect(sessionMetaRefusal(newSessionKey(), { tool: null, date: day }), `${zone} at ${at}`).toBeNull();
        vi.useRealTimers();
      }
    }
  });

  it("todayDay() is the UTC day: for the first hour after midnight in BST it names yesterday (not a refusal; a wrong label)", () => {
    vi.useFakeTimers({ now: new Date("2026-10-20T23:30:00Z") });
    const london = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    expect(london).toBe("2026-10-21");
    expect(todayDay()).toBe("2026-10-20");
  });

  it("a null tool, a tool id and a typed name all pass; the picker cannot type more than the limit", () => {
    const key = newSessionKey();
    for (const tool of [null, "claude-code", "lovable", "My own tool", "x".repeat(SESSION_TOOL_MAX)]) {
      expect(sessionMetaRefusal(key, { tool, date: todayDay() })).toBeNull();
    }
    expect(TYPED_TOOL_MAX).toBe(SESSION_TOOL_MAX);
  });

  it("extrasOf and extrasRefusal ask nothing of an entry that has no extras", () => {
    // Typed as sessionMetaRefusal hands it on (making.ts:430).
    const meta: SessionMeta = { tool: null, date: todayDay() };
    expect(extrasOf(meta)).toEqual({});
    expect(extrasRefusal(meta)).toBeNull();
    expect(extrasRefusal({})).toBeNull();
  });

  it("an old-shaped sessions_meta does not make the write refuse: only the new entry is checked", async () => {
    const old = {
      "typed-old": { tool: "claude-code", date: "2026-10-12" },
      "0e0e0e0e-0000-4000-8000-000000000002": { goal: { condition: "the tests pass" } },
      "typed-bad-day": { tool: null, date: "12/10/2026" },
      "typed-odd": { tool: 7, date: "2026-10-13", colour: "teal", cost: "lots", parallelWith: "typed-old", runs: { how: "loop" } },
      junk: 5,
      empty: null,
      listed: [1, 2],
    };
    startAuditBackend({ schema: REPO_SCHEMA, seed: (rows) => void (rows.builds[0].making = { sessions: [], excluded_models: [], sessions_meta: old }) });
    const id = String(tableRows("builds")[0].id);
    const key = newSessionKey();
    const entries = await setSessionMeta(id, key, { tool: null, date: todayDay() });
    expect(requests().map((r) => `${r.method} ${r.status}`)).toEqual(["GET 200", "PATCH 200"]);
    expect(entries[key]).toEqual({ tool: null, date: todayDay() });
    // What survives the rewrite (sessionsMetaOf, making.ts:153-175): the readable entries, cleaned.
    const saved = sessionsMetaOf(tableRows("builds")[0].making);
    expect(Object.keys(saved).sort()).toEqual(["0e0e0e0e-0000-4000-8000-000000000002", key, "typed-odd", "typed-old"].sort());
    expect(saved["typed-odd"]).toEqual({ tool: null, date: "2026-10-13", runs: { how: "loop" } });
    // FINDING (not the cause): an entry the reader cannot read is not kept as it was but deleted on the next write.
    const raw = (tableRows("builds")[0].making as { sessions_meta: Record<string, unknown> }).sessions_meta;
    expect(raw["typed-bad-day"]).toBeUndefined();
    expect(raw.junk).toBeUndefined();
  });
});
