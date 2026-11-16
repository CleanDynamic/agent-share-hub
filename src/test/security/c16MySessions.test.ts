// G16: my-sessions lists the caller's own sessions and ends one at a time. The database half is proven by
// supabase/tests/sec-c16-my-sessions.sql; this holds the function's rules and its wiring.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { endSession, listSessions, SessionRefused, sessionIdOf, type SessionDeps, type SessionRow } from "../../../supabase/functions/my-sessions/core";

const ME = "u-me";
const HERE = "11111111-1111-4111-8111-111111111111";
const PHONE = "22222222-2222-4222-8222-222222222222";

function deps(over: Partial<SessionDeps> = {}) {
  const calls = { list: [] as string[], revoke: [] as [string, string][] };
  const rows: SessionRow[] = [
    { id: PHONE, created_at: "2026-11-10T10:00:00Z", last_active: "2026-11-16T09:00:00Z", user_agent: "iPhone Safari", aal: "aal1" },
    { id: HERE, created_at: "2026-11-15T10:00:00Z", last_active: "2026-11-16T08:00:00Z", user_agent: "Mac Chrome", aal: "aal1" },
  ];
  const value: SessionDeps = {
    userId: ME,
    currentSessionId: HERE,
    list: async (userId) => {
      calls.list.push(userId);
      return rows;
    },
    revoke: async (userId, id) => {
      calls.revoke.push([userId, id]);
      return id === PHONE;
    },
    ...over,
  };
  return { value, calls };
}

const tokenWith = (claims: object) => `h.${btoa(JSON.stringify(claims)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")}.s`;

describe("listSessions", () => {
  it("asks for the caller's own sessions only, and marks this device", async () => {
    const { value, calls } = deps();
    const sessions = await listSessions(value);
    expect(calls.list).toEqual([ME]);
    expect(sessions.map((s) => [s.id, s.current])).toEqual([[PHONE, false], [HERE, true]]);
  });

  it("sends no address and no token: only id, dates, the browser string and the mark", async () => {
    const { value } = deps();
    for (const session of await listSessions(value)) {
      expect(Object.keys(session).sort()).toEqual(["createdAt", "current", "id", "lastActive", "userAgent"]);
    }
  });
});

describe("endSession", () => {
  it("ends another of the caller's sessions, by the caller's own id", async () => {
    const { value, calls } = deps();
    await endSession(value, PHONE);
    expect(calls.revoke).toEqual([[ME, PHONE]]);
  });

  it("refuses this device: it signs out in the browser", async () => {
    const { value, calls } = deps();
    await expect(endSession(value, HERE)).rejects.toBeInstanceOf(SessionRefused);
    expect(calls.revoke).toEqual([]);
  });

  it("refuses text that is not a session id, before asking the database", async () => {
    const { value, calls } = deps();
    await expect(endSession(value, "'; drop table x")).rejects.toMatchObject({ status: 400 });
    expect(calls.revoke).toEqual([]);
  });

  it("says so when the session is not the caller's or has already ended", async () => {
    const { value } = deps();
    await expect(endSession(value, "33333333-3333-4333-8333-333333333333")).rejects.toMatchObject({ status: 404 });
  });
});

describe("sessionIdOf", () => {
  it("reads the session_id claim", () => {
    expect(sessionIdOf(tokenWith({ sub: ME, session_id: HERE }))).toBe(HERE);
  });

  it("is null for a token without one, a malformed one, or a claim that is not a uuid", () => {
    expect(sessionIdOf(tokenWith({ sub: ME }))).toBeNull();
    expect(sessionIdOf("not-a-token")).toBeNull();
    expect(sessionIdOf("a.%%%.b")).toBeNull();
    expect(sessionIdOf(tokenWith({ session_id: "x" }))).toBeNull();
  });
});

describe("the function's wiring", () => {
  const index = readFileSync("supabase/functions/my-sessions/index.ts", "utf8");
  const config = readFileSync("supabase/config.toml", "utf8");

  it("reads the member from the verified token, and never a user id from the body", () => {
    expect(index).toContain("await getCaller(req)");
    expect(index).toContain("userId: caller.id");
    expect(index).not.toMatch(/userId:\s*body/);
    expect(index).not.toMatch(/user_?id[^,\n]*body\.data/i);
  });

  it("reads the session id only after the caller is verified", () => {
    expect(index.indexOf("sessionIdOf(token)")).toBeGreaterThan(index.indexOf("if (!caller)"));
  });

  it("is verify_jwt = true", () => {
    expect(config).toMatch(/\[functions\.my-sessions\][^[]*verify_jwt = true/);
  });
});
