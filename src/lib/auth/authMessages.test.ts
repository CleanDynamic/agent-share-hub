// G14: every refusal maps to one of our own sentences; server text is never shown, and an unknown code is
// "Couldn't do that. Try again."

import { describe, expect, it } from "vitest";

import { AUTH_MESSAGES, messageFor, refusalOf } from "./authMessages";

describe("refusalOf", () => {
  it.each([
    [{ code: "captcha_failed", message: "captcha protection: request disallowed" }, "captcha"],
    [{ code: "invalid_credentials", message: "Invalid login credentials" }, "credentials"],
    [{ code: "email_not_confirmed", message: "Email not confirmed" }, "credentials"],
    [{ code: "over_request_rate_limit", message: "Request rate limit reached" }, "rate-limit"],
    [{ code: "over_email_send_rate_limit", message: "Email rate limit exceeded" }, "rate-limit"],
    [{ status: 429, message: "Too many requests" }, "rate-limit"],
    [{ code: "weak_password", message: "Password should be at least 12 characters." }, "weak-password"],
    [{ code: "same_password", message: "New password should be different from the old password." }, "same-password"],
    [{ code: "email_address_invalid", message: "Email address is invalid" }, "invalid-email"],
    [{ code: "validation_failed", message: "Unable to validate email address: invalid format" }, "invalid-email"],
    [{ code: "something_new", message: "A brand new server message" }, "unknown"],
    [{ message: "New password should be different from the old password." }, "same-password"],
    [{ message: "Email rate limit exceeded" }, "rate-limit"],
    [null, "unknown"],
    [undefined, "unknown"],
  ])("reads %j as %s", (error, kind) => {
    expect(refusalOf(error as never)).toBe(kind);
  });
});

describe("the sentences", () => {
  it("are ours, one for each kind, and an unknown code is Couldn't do that. Try again.", () => {
    expect(AUTH_MESSAGES).toEqual({
      captcha: "Couldn't verify this request. Try again.",
      credentials: "That email or password isn't right.",
      "rate-limit": "Too many tries. Wait a minute, then try again.",
      "weak-password": "Choose a stronger password.",
      "same-password": "Choose a password you haven't used before.",
      "invalid-email": "Enter a valid email address.",
      unknown: "Couldn't do that. Try again.",
    });
    expect(messageFor(refusalOf({ code: "something_new", message: "raw server words" }))).toBe("Couldn't do that. Try again.");
  });
});

describe("screenError (prompt 9, G4): no server or library text reaches the screen", () => {
  const fallback = "Couldn't join that space. Try again.";

  it("passes our own errors through", async () => {
    const { screenError, ShownError } = await import("./authMessages");
    const { SettingsError } = await import("@/lib/settings/useAction");
    expect(screenError(new SettingsError("Couldn't change your email. Try again."), fallback, false)).toBe("Couldn't change your email. Try again.");
    expect(screenError(new ShownError("Target: 200 characters max"), fallback, false)).toBe("Target: 200 characters max");
    // A graph refusal: buildLayerError wraps a ShownError, and the chain is read.
    const wrapped = Object.assign(new Error("addCheck failed: Test cases: 50 max"), { cause: new ShownError("Test cases: 50 max") });
    expect(screenError(wrapped, fallback, false)).toBe("Test cases: 50 max");
  });

  it("reads a raised exception through SQL_SENTENCES, and an unlisted one is the fallback", async () => {
    const { screenError } = await import("./authMessages");
    const { PostError } = await import("@/lib/openbuilds/types");
    expect(screenError(new PostError("createPost", "A topic or reply needs words or something attached.", "P0001", 400), fallback, false)).toBe(
      "Couldn't post that. Add words or attach something.",
    );
    expect(screenError({ code: "P0001", message: "A profile holds 3 pins. Unpin one first." }, fallback, false)).toBe(
      "Couldn't pin that. A profile holds 3 pins, so unpin one first.",
    );
    expect(screenError(new PostError("createPost", "bounty 7 does not exist", "P0001", 400), fallback, false)).toBe(fallback);
    expect(screenError(new PostError("joinSpace", "joinSpace failed (23505)", "23505", 409), fallback, false)).toBe(fallback);
    expect(screenError(new PostError("createPost", "Sign in to post.", null, 401), fallback, false)).toBe("Sign in to post.");
  });

  it("reads an auth refusal by its code, and a dropped connection as one", async () => {
    const { screenError } = await import("./authMessages");
    expect(screenError({ name: "AuthApiError", code: "weak_password", message: "Password should be at least 12 characters." }, fallback, false)).toBe(
      "Choose a stronger password.",
    );
    expect(screenError(new TypeError("Failed to fetch"), fallback, false)).toBe("Couldn't reach OpenBuilds.ai. Check your connection and try again.");
  });

  it("never shows anything else, and reports it without its message", async () => {
    const { screenError } = await import("./authMessages");
    const { clearRecentErrors, recentErrors } = await import("@/lib/errors/report");
    clearRecentErrors();
    expect(screenError(new Error('duplicate key value violates unique constraint "space_members_pkey"'), fallback)).toBe(fallback);
    expect(screenError({ message: "JWT expired", code: "PGRST301" })).toBe("Couldn't do that. Try again.");
    expect(screenError("a string")).toBe("Couldn't do that. Try again.");
    const kept = recentErrors();
    expect(kept.length).toBe(3);
    expect(JSON.stringify(kept)).not.toMatch(/duplicate key|JWT expired|a string/);
  });

  it("every SQL sentence follows the error pattern or is a sign-in prompt", async () => {
    const { SQL_SENTENCES } = await import("./authMessages");
    for (const [, sentence] of SQL_SENTENCES) expect(sentence).toMatch(/^(Couldn't [a-z].*\. [A-Z].*\.|Sign in to [a-z ]+\.)$/);
  });
});
