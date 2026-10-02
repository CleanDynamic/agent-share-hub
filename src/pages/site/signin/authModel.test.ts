// UI-P36 — what the switch carries, what an emailed link carried, and when each form may be sent.

import { describe, expect, it } from "vitest";

import {
  carriedSearch,
  loginCanSubmit,
  readEmailLink,
  resetConfirmCanSubmit,
  resetRequestCanSubmit,
  signupCanSubmit,
  type SignupGate,
} from "./authModel";

const params = (query: string) => new URLSearchParams(query);

describe("carriedSearch", () => {
  it("carries the address the visitor was heading for, encoded", () => {
    expect(carriedSearch(params("redirect=/gallery"))).toBe("?redirect=%2Fgallery");
    expect(carriedSearch(params("redirect=%2Fb2%2Finvoice-triage-agent%3Ftab%3Dparts"))).toBe(
      "?redirect=%2Fb2%2Finvoice-triage-agent%3Ftab%3Dparts",
    );
  });

  it("carries the returnTo alias under the name the rest of the app writes", () => {
    expect(carriedSearch(params("returnTo=/gallery"))).toBe("?redirect=%2Fgallery");
  });

  it("prefers redirect over returnTo, as Login does", () => {
    expect(carriedSearch(params("returnTo=/b&redirect=/a"))).toBe("?redirect=%2Fa");
  });

  it("carries nothing else, and nothing when there is no destination", () => {
    expect(carriedSearch(params(""))).toBe("");
    expect(carriedSearch(params("frame=site&token=abc"))).toBe("");
    expect(carriedSearch(params("redirect="))).toBe("");
    expect(carriedSearch(params("frame=site&redirect=/gallery"))).toBe("?redirect=%2Fgallery");
  });
});

describe("readEmailLink", () => {
  it("reads a token from the path first, then token_hash, then token", () => {
    expect(readEmailLink("from-path", params("token_hash=h&token=t"), "").tokenHash).toBe("from-path");
    expect(readEmailLink(undefined, params("token_hash=h&token=t"), "").tokenHash).toBe("h");
    expect(readEmailLink(undefined, params("token=t"), "").tokenHash).toBe("t");
  });

  it("reads a PKCE code, an error (its description first) and the type", () => {
    const link = readEmailLink(undefined, params("code=pkce&error=denied&error_description=Link+expired&type=recovery"), "");
    expect(link.code).toBe("pkce");
    expect(link.urlError).toBe("Link expired");
    expect(link.otpType).toBe("recovery");
    expect(readEmailLink(undefined, params("error=denied"), "").urlError).toBe("denied");
  });

  it("takes a confirmation for an 'email' link unless the link says otherwise", () => {
    expect(readEmailLink(undefined, params(""), "").otpType).toBe("email");
    expect(readEmailLink(undefined, params("type=signup"), "").otpType).toBe("signup");
  });

  it("notices an implicit-flow session or error in the hash", () => {
    expect(readEmailLink(undefined, params(""), "#access_token=abc&type=recovery").hashHasAuth).toBe(true);
    expect(readEmailLink(undefined, params(""), "#error=access_denied").hashHasAuth).toBe(true);
    expect(readEmailLink(undefined, params(""), "#section").hashHasAuth).toBe(false);
  });

  it("says an email was the way in when any of those is there, and not otherwise", () => {
    expect(readEmailLink(undefined, params(""), "").present).toBe(false);
    expect(readEmailLink(undefined, params("redirect=/gallery"), "").present).toBe(false);
    expect(readEmailLink("tok", params(""), "").present).toBe(true);
    expect(readEmailLink(undefined, params("token_hash=h"), "").present).toBe(true);
    expect(readEmailLink(undefined, params("code=c"), "").present).toBe(true);
    expect(readEmailLink(undefined, params("error=denied"), "").present).toBe(true);
    expect(readEmailLink(undefined, params(""), "#access_token=a").present).toBe(true);
  });
});

describe("the gates", () => {
  it("sends Sign in when both fields have something in them, and trims first", () => {
    expect(loginCanSubmit("", "")).toBe(false);
    expect(loginCanSubmit("ada@example.com", "")).toBe(false);
    expect(loginCanSubmit("", "hunter22")).toBe(false);
    expect(loginCanSubmit("   ", "hunter22")).toBe(false);
    expect(loginCanSubmit("ada@example.com", "   ")).toBe(false);
    expect(loginCanSubmit("ada@example.com", "hunter22")).toBe(true);
  });

  const ready: SignupGate = {
    displayName: "Ada Lovelace",
    username: "ada_l",
    email: "ada@example.com",
    password: "Abcdefghij1!x",
    agreedToTerms: true,
    usernameValidation: { state: "valid", message: "Username available" },
    emailValidation: { state: "idle" },
  };

  it("sends Join only when every field is filled, the password is eight characters, the terms are ticked and nothing is invalid or being checked", () => {
    expect(signupCanSubmit(ready)).toBe(true);
    expect(signupCanSubmit({ ...ready, displayName: " " })).toBe(false);
    expect(signupCanSubmit({ ...ready, username: "" })).toBe(false);
    expect(signupCanSubmit({ ...ready, email: "" })).toBe(false);
    expect(signupCanSubmit({ ...ready, password: "short" })).toBe(false);
    expect(signupCanSubmit({ ...ready, password: "12345678" })).toBe(true);
    expect(signupCanSubmit({ ...ready, agreedToTerms: false })).toBe(false);
    expect(signupCanSubmit({ ...ready, usernameValidation: { state: "invalid", message: "Taken" } })).toBe(false);
    expect(signupCanSubmit({ ...ready, usernameValidation: { state: "checking" } })).toBe(false);
    expect(signupCanSubmit({ ...ready, emailValidation: { state: "invalid", message: "Please enter a valid email" } })).toBe(false);
    expect(signupCanSubmit({ ...ready, emailValidation: { state: "valid" } })).toBe(true);
    expect(signupCanSubmit({ ...ready, usernameValidation: { state: "idle" } })).toBe(true);
  });

  it("sends the reset request when there is an email, and the new password when it is eight characters and confirmed with something", () => {
    expect(resetRequestCanSubmit("")).toBe(false);
    expect(resetRequestCanSubmit("  ")).toBe(false);
    expect(resetRequestCanSubmit("ada@example.com")).toBe(true);
    expect(resetConfirmCanSubmit("short", "short")).toBe(false);
    expect(resetConfirmCanSubmit("longenough", "")).toBe(false);
    expect(resetConfirmCanSubmit("longenough", "x")).toBe(true);
  });
});
