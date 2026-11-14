// G22: what reaches Sentry carries no password, token, captcha token or email address: not in the event, its tags,
// its exception values, its request or its breadcrumbs.

import { describe, expect, it } from "vitest";

import { scrubEvent } from "./scrub";

const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1LTEifQ.c2lnbmF0dXJl";

function hostileEvent() {
  return {
    message: "failed for ada@example.com with Bearer abc.def.ghi",
    tags: { route: "/b/abc", email: "ada@example.com", note: "grace@example.com", captchaToken: "0.turnstile-token" },
    exception: {
      values: [
        { type: "AuthApiError", value: `AuthApiError for ada@example.com token ${JWT}`, stacktrace: { frames: [{ function: "signIn", vars: { password: "hunter22", email: "ada@example.com" } }] } },
      ],
    },
    request: { url: "https://openbuilds.ai/?signin=reset&token_hash=abc123&code=xyz#access_token=secret-at&refresh_token=secret-rt", headers: { Authorization: "Bearer xyz", Cookie: "sb=1" } },
    extra: { body: { password: "hunter22", captcha_token: "tok", nested: { refresh_token: "rt", apikey: "k" } } },
    breadcrumbs: [
      { category: "fetch", message: "POST /auth/v1/token for ada@example.com", data: { url: "https://x.supabase.co/auth/v1/token?grant_type=password", body: '{"email":"ada@example.com","password":"hunter22","gotrue_meta_security":{"captcha_token":"tok"}}' } },
      // Free text is matched by shape only (emails, tokens, name=value pairs); a password typed into prose cannot be
      // recognised, which is why report.ts drops every breadcrumb before it is recorded.
      { category: "ui.input", message: "typed into the password field", data: { password: "hunter22" } },
    ],
    contexts: { os: { name: "Linux" } },
  };
}

describe("scrubEvent", () => {
  const scrubbed = JSON.stringify(scrubEvent(hostileEvent()));

  it.each(["hunter22", "ada@example.com", "grace@example.com", "0.turnstile-token", JWT, "secret-at", "secret-rt", "abc123", "xyz", "abc.def.ghi", '"tok"', '"rt"', '"k"'])(
    "leaves no %s anywhere in the event",
    (secret) => {
      expect(scrubbed).not.toContain(secret);
    },
  );

  it("keeps what triage needs: the route, the error's type, the function name, the context", () => {
    const event = scrubEvent(hostileEvent());
    expect(event.tags.route).toBe("/b/abc");
    expect(event.exception.values[0].type).toBe("AuthApiError");
    expect(event.exception.values[0].stacktrace.frames[0].function).toBe("signIn");
    expect(event.contexts.os.name).toBe("Linux");
  });

  it("marks what it took out", () => {
    const event = scrubEvent(hostileEvent());
    expect(event.tags.email).toBe("[redacted]");
    expect(event.tags.note).toBe("[email]");
    expect(event.exception.values[0].value).toBe("AuthApiError for [email] token [token]");
    expect(event.request.url).toBe("https://openbuilds.ai/?signin=reset&token_hash=[redacted]&code=[redacted]#access_token=[redacted]&refresh_token=[redacted]");
  });

  it("does not change the event it was given", () => {
    const original = hostileEvent();
    scrubEvent(original);
    expect(original.tags.email).toBe("ada@example.com");
  });

  it("copes with cycles and deep nesting", () => {
    const loop: Record<string, unknown> = { password: "hunter22" };
    loop.self = loop;
    expect(() => scrubEvent(loop)).not.toThrow();
    expect(JSON.stringify(scrubEvent({ a: { b: { c: { d: { e: { f: { g: { h: { i: { j: { k: "ada@example.com" } } } } } } } } } } }))).not.toContain("ada@example.com");
  });
});
