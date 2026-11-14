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
