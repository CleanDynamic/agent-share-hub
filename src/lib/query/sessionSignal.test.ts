// G13: what counts as "the server refused this member's session", read from a request and its answer.
import { describe, expect, it } from "vitest";

import { isMemberToken, isSessionRefusal, refusedMemberRequest } from "./sessionSignal";

const jwt = (claims: Record<string, unknown>) => `${btoa(JSON.stringify({ alg: "HS256" }))}.${btoa(JSON.stringify(claims)).replace(/=+$/, "")}.sig`;
const MEMBER = jwt({ sub: "u1", role: "authenticated", exp: 9_999_999_999 });
const ANON = jwt({ role: "anon", iss: "supabase" });
const BASE = "https://project.supabase.co";
const headers = (token: string) => new Headers({ Authorization: `Bearer ${token}`, apikey: ANON });

describe("isMemberToken", () => {
  it("is a member's token, not the publishable key and not nonsense", () => {
    expect(isMemberToken(MEMBER)).toBe(true);
    expect(isMemberToken(ANON)).toBe(false);
    expect(isMemberToken("sb_publishable_abc")).toBe(false);
    expect(isMemberToken("")).toBe(false);
  });
});

describe("refusedMemberRequest", () => {
  it("is a data request sent with a member's token and answered 401", () => {
    expect(refusedMemberRequest(`${BASE}/rest/v1/builds`, headers(MEMBER), 401)).toBe(MEMBER);
    expect(refusedMemberRequest(`${BASE}/rest/v1/rpc/gallery_facets`, headers(MEMBER), 401)).toBe(MEMBER);
    expect(refusedMemberRequest(`${BASE}/functions/v1/my-sessions`, headers(MEMBER), 401)).toBe(MEMBER);
    expect(refusedMemberRequest(`${BASE}/storage/v1/object/sign/x`, headers(MEMBER), 401)).toBe(MEMBER);
  });

  it("is never a refusal for lack of permission (403)", () => {
    expect(refusedMemberRequest(`${BASE}/rest/v1/builds`, headers(MEMBER), 403)).toBeNull();
  });

  it("is never a request sent without a member's token", () => {
    expect(refusedMemberRequest(`${BASE}/rest/v1/builds`, headers(ANON), 401)).toBeNull();
    expect(refusedMemberRequest(`${BASE}/rest/v1/builds`, new Headers(), 401)).toBeNull();
  });

  it("is never the auth server's own answer (the confirming check goes there)", () => {
    expect(refusedMemberRequest(`${BASE}/auth/v1/user`, headers(MEMBER), 401)).toBeNull();
    expect(refusedMemberRequest(`${BASE}/auth/v1/token?grant_type=refresh_token`, headers(MEMBER), 400)).toBeNull();
  });

  it("reads plain header objects too", () => {
    expect(refusedMemberRequest(`${BASE}/rest/v1/builds`, { Authorization: `Bearer ${MEMBER}` }, 401)).toBe(MEMBER);
  });
});

describe("isSessionRefusal", () => {
  it("is a 401 or the JWT codes, anywhere on the chain; never 403 or 42501", () => {
    expect(isSessionRefusal({ status: 401 })).toBe(true);
    for (const code of ["PGRST301", "PGRST302", "PGRST303"]) expect(isSessionRefusal({ code })).toBe(true);
    expect(isSessionRefusal(Object.assign(new Error("listBuilds failed"), { cause: { code: "PGRST301" } }))).toBe(true);
    expect(isSessionRefusal({ status: 403 })).toBe(false);
    expect(isSessionRefusal({ code: "42501" })).toBe(false);
    expect(isSessionRefusal(new TypeError("Failed to fetch"))).toBe(false);
  });
});
