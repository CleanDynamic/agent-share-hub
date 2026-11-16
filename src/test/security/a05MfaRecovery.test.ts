// Part A, G5: mfa-recovery's rules. Codes stored only as salted hashes, compared in constant time, spent once, a new
// set voiding the old; creating needs a code entered in the last ten minutes; a lost authenticator can be removed from
// a session a backup code verified in the last ten minutes. The database half: supabase/tests/sec-a05-backup-codes.sql.

import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  ALPHABET,
  CODES_PER_SET,
  claimsOf,
  codesLeft,
  constantTimeEqual,
  createCodes,
  generateCodes,
  hasFreshCode,
  normaliseCode,
  RecoveryRefused,
  redeemCode,
  removeFactor,
  type Candidate,
  type Claims,
  type RecoveryDeps,
} from "../../../supabase/functions/mfa-recovery/core";

const NOW = 1_800_000_000_000;
const SESSION = "11111111-1111-4111-8111-111111111111";
const fresh: Claims = { session_id: SESSION, aal: "aal2", amr: [{ method: "password", timestamp: NOW / 1000 - 3000 }, { method: "totp", timestamp: NOW / 1000 - 60 }] };

function store(over: Partial<RecoveryDeps> = {}, claims: Claims = fresh) {
  const state = { rows: [] as (Candidate & { used: boolean; user: string })[], nextId: 1, hits: 0, deleted: [] as string[], marked: [] as string[] };
  const deps: RecoveryDeps = {
    userId: "u1",
    claims,
    now: () => NOW,
    random: (n) => new Uint8Array(randomBytes(n)),
    sha256Hex: async (text) => createHash("sha256").update(text).digest("hex"),
    replace: async (userId, salts, hashes) => {
      state.rows = state.rows.filter((r) => r.user !== userId);
      salts.forEach((salt, i) => state.rows.push({ id: state.nextId++, salt, code_hash: hashes[i], used: false, user: userId }));
    },
    candidates: async (userId) => state.rows.filter((r) => r.user === userId && !r.used).map(({ id, salt, code_hash }) => ({ id, salt, code_hash })),
    spend: async (userId, id, sessionId) => {
      const row = state.rows.find((r) => r.id === id && r.user === userId && !r.used);
      if (!row) return false;
      row.used = true;
      state.marked.push(sessionId);
      return true;
    },
    left: async (userId) => state.rows.filter((r) => r.user === userId && !r.used).length,
    recoveredAt: async () => null,
    verifiedFactorIds: async () => ["f1"],
    deleteFactor: async (_userId, factorId) => {
      state.deleted.push(factorId);
    },
    hit: async () => ++state.hits <= 10,
    ...over,
  };
  return { deps, state };
}

describe("the codes", () => {
  it("are ten, all different, ten characters from an alphabet with no 0, 1, I or O, shown as XXXXX-XXXXX", () => {
    expect(ALPHABET).toHaveLength(32);
    expect(ALPHABET).not.toMatch(/[01IO]/);
    const codes = generateCodes((n) => new Uint8Array(randomBytes(n)));
    expect(codes).toHaveLength(CODES_PER_SET);
    expect(new Set(codes).size).toBe(CODES_PER_SET);
    for (const code of codes) expect(code).toMatch(/^[2-9A-HJ-NP-Z]{5}-[2-9A-HJ-NP-Z]{5}$/);
  });

  it("are read without case, spaces or the dash", () => {
    expect(normaliseCode(" abcde-fghjk ")).toBe("ABCDEFGHJK");
    expect(normaliseCode("ABCDE FGHJK")).toBe("ABCDEFGHJK");
    expect(normaliseCode("ABCDE-FGHJ")).toBeNull();
    expect(normaliseCode("ABCDE-FGHJ0")).toBeNull();
  });

  it("compare in constant time: every character is looked at", () => {
    expect(constantTimeEqual("abcd", "abcd")).toBe(true);
    expect(constantTimeEqual("abcd", "abce")).toBe(false);
    expect(constantTimeEqual("abcd", "abc")).toBe(false);
  });
});

describe("createCodes", () => {
  it("stores only salted hashes, one salt per code, and returns the codes once", async () => {
    const { deps, state } = store();
    const codes = await createCodes(deps);
    expect(state.rows).toHaveLength(10);
    expect(new Set(state.rows.map((r) => r.salt)).size).toBe(10);
    for (const row of state.rows) {
      expect(row.code_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(codes.some((code) => row.code_hash.includes(code) || row.salt.includes(code))).toBe(false);
    }
    const stored = JSON.stringify(state.rows);
    for (const code of codes) expect(stored).not.toContain(code.replace("-", ""));
  });

  it("voids the old set when a new one is made", async () => {
    const { deps } = store();
    const first = await createCodes(deps);
    await createCodes(deps);
    await expect(redeemCode(deps, first[0])).rejects.toMatchObject({ status: 401 });
  });

  it("needs a code entered in the last ten minutes", async () => {
    const stale: Claims = { ...fresh, amr: [{ method: "totp", timestamp: NOW / 1000 - 601 }] };
    await expect(createCodes(store({}, stale).deps)).rejects.toBeInstanceOf(RecoveryRefused);
    await expect(createCodes(store({}, { session_id: SESSION, aal: "aal1", amr: [{ method: "password", timestamp: NOW / 1000 }] }).deps)).rejects.toMatchObject({ status: 403 });
  });
});

describe("redeemCode", () => {
  it("works once, and is refused the second time", async () => {
    const { deps, state } = store();
    const codes = await createCodes(deps);
    const signIn = store({ ...deps, claims: { session_id: SESSION, aal: "aal1" } }).deps;
    Object.assign(signIn, { replace: deps.replace, candidates: deps.candidates, spend: deps.spend, left: deps.left });
    await redeemCode(signIn, codes[3].toLowerCase());
    expect(state.marked).toEqual([SESSION]);
    expect(await codesLeft(deps)).toBe(9);
    await expect(redeemCode(signIn, codes[3])).rejects.toMatchObject({ status: 401, message: "That backup code didn't work." });
  });

  it("refuses a wrong code, and text that cannot be a code", async () => {
    const { deps } = store();
    await createCodes(deps);
    await expect(redeemCode(deps, "ZZZZZ-ZZZZZ")).rejects.toMatchObject({ status: 401 });
    await expect(redeemCode(deps, "hello")).rejects.toMatchObject({ status: 400 });
  });

  it("is limited per member: past the limit it is refused before any code is looked at", async () => {
    const looked: string[] = [];
    const { deps } = store({ hit: async () => false, candidates: async () => (looked.push("x"), []) });
    await expect(redeemCode(deps, "ABCDE-FGHJK")).rejects.toMatchObject({ status: 429 });
    expect(looked).toEqual([]);
  });

  it("needs the session from the token", async () => {
    const { deps } = store({}, { aal: "aal1" });
    await expect(redeemCode(deps, "ABCDE-FGHJK")).rejects.toMatchObject({ status: 401 });
  });
});

describe("removeFactor", () => {
  it("removes one of the member's authenticators with a fresh code", async () => {
    const { deps, state } = store();
    await removeFactor(deps, "f1");
    expect(state.deleted).toEqual(["f1"]);
  });

  it("removes a lost authenticator from a session a backup code verified in the last ten minutes", async () => {
    const { deps, state } = store({ recoveredAt: async () => new Date(NOW - 5 * 60_000).toISOString() }, { session_id: SESSION, aal: "aal1" });
    await removeFactor(deps, "f1");
    expect(state.deleted).toEqual(["f1"]);
  });

  it("refuses after ten minutes, and with neither", async () => {
    await expect(removeFactor(store({ recoveredAt: async () => new Date(NOW - 11 * 60_000).toISOString() }, { session_id: SESSION, aal: "aal1" }).deps, "f1")).rejects.toMatchObject({ status: 403 });
    await expect(removeFactor(store({}, { session_id: SESSION, aal: "aal1" }).deps, "f1")).rejects.toMatchObject({ status: 403 });
  });

  it("refuses a factor that is not the member's", async () => {
    await expect(removeFactor(store().deps, "someone-elses")).rejects.toMatchObject({ status: 404 });
  });
});

describe("claims", () => {
  it("reads session_id, aal and amr from a verified token's payload", () => {
    const token = `h.${Buffer.from(JSON.stringify(fresh)).toString("base64url")}.s`;
    expect(claimsOf(token)).toEqual(fresh);
    expect(claimsOf("garbage")).toEqual({});
    expect(hasFreshCode(fresh, NOW / 1000)).toBe(true);
    expect(hasFreshCode({ ...fresh, aal: "aal1" }, NOW / 1000)).toBe(false);
  });
});

describe("the function's wiring", () => {
  const index = readFileSync("supabase/functions/mfa-recovery/index.ts", "utf8");
  const config = readFileSync("supabase/config.toml", "utf8");

  it("reads the member from the verified token, and claims only after", () => {
    expect(index).toContain("userId: caller.id");
    expect(index.indexOf("claimsOf(token)")).toBeGreaterThan(index.indexOf("if (!caller)"));
    expect(index).not.toMatch(/userId:\s*body/);
  });

  it("refuses a redeem when the limit's store fails, rather than letting it through", () => {
    expect(index).toMatch(/catch \{\s*\/\/[^\n]*\n\s*return false;/);
  });

  it("logs nothing", () => {
    expect(index).not.toMatch(/console\.(log|info|warn|error)/);
    expect(readFileSync("supabase/functions/mfa-recovery/core.ts", "utf8")).not.toMatch(/console\./);
  });

  it("is verify_jwt = true", () => {
    expect(config).toMatch(/\[functions\.mfa-recovery\][^[]*verify_jwt = true/);
  });
});
