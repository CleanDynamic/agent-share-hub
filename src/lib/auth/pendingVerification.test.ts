// Prompt 9, G16: pending_verification_email goes when verification completes, on sign-out, and when the dialog closes.

import { beforeEach, describe, expect, it } from "vitest";

import { PENDING_VERIFICATION_KEY, forgetOnAuthEvent, forgetPendingVerification, pendingVerificationEmail, rememberPendingVerification } from "./pendingVerification";

describe("the address kept for Check your inbox", () => {
  beforeEach(() => sessionStorage.clear());

  it("is kept in this tab's sessionStorage under its one key, and read back", () => {
    rememberPendingVerification("ada@example.com");
    expect(sessionStorage.getItem(PENDING_VERIFICATION_KEY)).toBe("ada@example.com");
    expect(pendingVerificationEmail()).toBe("ada@example.com");
  });

  it("is removed by forgetPendingVerification", () => {
    rememberPendingVerification("ada@example.com");
    forgetPendingVerification();
    expect(sessionStorage.getItem(PENDING_VERIFICATION_KEY)).toBeNull();
    expect(pendingVerificationEmail()).toBe("");
  });

  it("is removed when verification completes (the session it opens is a SIGNED_IN) and on sign-out", () => {
    for (const event of ["SIGNED_IN", "SIGNED_OUT"]) {
      rememberPendingVerification("ada@example.com");
      forgetOnAuthEvent(event);
      expect(sessionStorage.getItem(PENDING_VERIFICATION_KEY), event).toBeNull();
    }
  });

  it("stays through events that are not a sign-in or a sign-out", () => {
    rememberPendingVerification("ada@example.com");
    for (const event of ["INITIAL_SESSION", "TOKEN_REFRESHED", "USER_UPDATED", "PASSWORD_RECOVERY"]) forgetOnAuthEvent(event);
    expect(sessionStorage.getItem(PENDING_VERIFICATION_KEY)).toBe("ada@example.com");
  });
});
