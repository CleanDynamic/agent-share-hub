// SV-21 P2: claims. A stand-in for supabase-js records what each call asks for.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Call {
  op: string;
  args: unknown[];
}
let calls: Call[][] = [];
let answer: { data?: unknown; error?: unknown } | ((own: Call[]) => { data?: unknown; error?: unknown }) = { data: [] };

function builder() {
  const own: Call[] = [];
  calls.push(own);
  const self: Record<string, unknown> = {};
  for (const op of ["select", "insert", "update", "delete", "eq", "in", "gt", "lte", "order", "limit"]) {
    self[op] = (...args: unknown[]) => {
      own.push({ op, args });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve()
      .then(() => {
        const result = typeof answer === "function" ? answer(own) : answer;
        return { data: result.data ?? null, error: result.error ?? null };
      })
      .then(resolve, reject);
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => builder() } }));

import { claimDaysLeft, claimRequest, listActiveClaims, listMyClaims, releaseClaim } from "@/lib/bounty/claims";

const NOW = Date.parse("2026-11-01T12:00:00Z");
const ops = (n: number) => calls[n].map((call) => call.op);

beforeEach(() => {
  calls = [];
  answer = { data: [] };
});

describe("claimDaysLeft", () => {
  it("rounds up to whole days and never says 0 while a claim stands", () => {
    expect(claimDaysLeft("2026-11-04T12:00:00Z", NOW)).toBe(3);
    expect(claimDaysLeft("2026-11-03T13:00:00Z", NOW)).toBe(3);
    expect(claimDaysLeft("2026-11-02T12:00:00Z", NOW)).toBe(1);
    expect(claimDaysLeft("2026-11-01T12:30:00Z", NOW)).toBe(1);
  });
});

describe("listActiveClaims", () => {
  it("asks once, for claims that have not run out, and maps who holds them", async () => {
    answer = { data: [{ request_id: "q1", user_id: "u1", expires_at: "2026-11-03T12:00:00Z", fork_build_id: "f1", profiles: { username: "kit" } }] };
    const claims = await listActiveClaims(["q1", "q2"], NOW);
    expect(calls).toHaveLength(1);
    expect(calls[0].find((call) => call.op === "gt")?.args).toEqual(["expires_at", "2026-11-01T12:00:00.000Z"]);
    expect(claims.get("q1")).toEqual({ requestId: "q1", userId: "u1", handle: "kit", expiresAt: "2026-11-03T12:00:00Z", forkBuildId: "f1" });
    expect(claims.has("q2")).toBe(false);
  });

  it("asks nothing for no requests, and answers no claims before the migration is applied", async () => {
    expect((await listActiveClaims([], NOW)).size).toBe(0);
    expect(calls).toHaveLength(0);
    answer = { error: { code: "PGRST205" } };
    expect((await listActiveClaims(["q1"], NOW)).size).toBe(0);
  });
});

describe("listMyClaims", () => {
  it("reads the reader's open, unexpired claims soonest first, with the build and gap", async () => {
    answer = { data: [{ request_id: "q1", expires_at: "2026-11-02T12:00:00Z", fork_build_id: null, bounties: { status: "open", builds: { slug: "invoice", title: "Invoice agent" }, build_nodes: { title: " Retry " } } }] };
    expect(await listMyClaims("u1", NOW)).toEqual([{ requestId: "q1", build: { slug: "invoice", title: "Invoice agent" }, gapTitle: "Retry", expiresAt: "2026-11-02T12:00:00Z", forkBuildId: null }]);
    expect(calls[0].find((call) => call.op === "eq" && call.args[0] === "user_id")?.args[1]).toBe("u1");
    expect(calls[0].find((call) => call.op === "order")?.args).toEqual(["expires_at", { ascending: true }]);
  });
});

describe("claimRequest", () => {
  it("clears a claim that has run out, then inserts the reader's", async () => {
    expect(await claimRequest({ requestId: "q1", userId: "u1", forkBuildId: "f1" }, NOW)).toBe(true);
    expect(ops(0)).toEqual(["delete", "eq", "lte"]);
    expect(calls[0][2].args).toEqual(["expires_at", "2026-11-01T12:00:00.000Z"]);
    expect(calls[1].find((call) => call.op === "insert")?.args[0]).toEqual({ request_id: "q1", user_id: "u1", fork_build_id: "f1" });
  });

  it("says so, in words, when someone else holds it", async () => {
    answer = (own) => (own.some((call) => call.op === "insert") ? { error: { code: "23505" } } : { data: null });
    await expect(claimRequest({ requestId: "q1", userId: "u1" }, NOW)).rejects.toThrow("Someone else is already working on this request");
  });

  it("claims nothing, and does not break, before the migration is applied", async () => {
    answer = { error: { code: "42P01" } };
    expect(await claimRequest({ requestId: "q1", userId: "u1" }, NOW)).toBe(false);
    expect(calls).toHaveLength(1);
  });
});

describe("releaseClaim", () => {
  it("deletes only the reader's own", async () => {
    await releaseClaim({ requestId: "q1", userId: "u1" });
    expect(calls[0].filter((call) => call.op === "eq").map((call) => call.args)).toEqual([["request_id", "q1"], ["user_id", "u1"]]);
  });
});
