// G1: the calls behind Settings' Two-step sign-in group.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mfa = vi.hoisted(() => ({
  listFactors: vi.fn(),
  enroll: vi.fn(),
  unenroll: vi.fn(),
  challengeAndVerify: vi.fn(),
}));
const auth = vi.hoisted(() => ({ signInWithPassword: vi.fn() }));
const invoke = vi.hoisted(() => vi.fn());
const markSessionRecovered = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { ...auth, mfa }, functions: { invoke } } }));
vi.mock("@/lib/auth/codeStep", () => ({ markSessionRecovered: () => markSessionRecovered() }));
vi.mock("@/lib/auth/turnstile", () => ({ oneShotCaptchaToken: async () => ({ token: "tok-1", failed: false }) }));

import {
  MFA_COPY,
  cleanCode,
  backupCodesLeft,
  confirmAuthenticator,
  confirmIdentity,
  createBackupCodes,
  redeemBackupCode,
  removeLostAuthenticator,
  listAuthenticators,
  removeAuthenticator,
  startAuthenticator,
  type Authenticator,
} from "./mfa";

const phone: Authenticator = { id: "f1", name: "Phone", createdAt: "2026-11-01T10:00:00Z" };

beforeEach(() => {
  for (const fn of [...Object.values(mfa), ...Object.values(auth), invoke, markSessionRecovered]) fn.mockReset();
});

describe("cleanCode", () => {
  it("takes six digits, with or without the space a phone shows in the middle", () => {
    expect(cleanCode("123456")).toBe("123456");
    expect(cleanCode("123 456")).toBe("123456");
    expect(cleanCode("12345")).toBeNull();
    expect(cleanCode("12345a")).toBeNull();
    expect(cleanCode("1234567")).toBeNull();
  });
});

describe("listAuthenticators", () => {
  it("lists verified authenticators only, oldest first, with their names and dates", async () => {
    mfa.listFactors.mockResolvedValue({
      data: {
        all: [],
        totp: [
          { id: "f2", friendly_name: "Tablet", status: "verified", created_at: "2026-11-05T10:00:00Z" },
          { id: "f1", friendly_name: "Phone", status: "verified", created_at: "2026-11-01T10:00:00Z" },
          { id: "f3", friendly_name: "", status: "verified", created_at: "2026-11-06T10:00:00Z" },
        ],
      },
      error: null,
    });
    expect(await listAuthenticators()).toEqual([
      { id: "f1", name: "Phone", createdAt: "2026-11-01T10:00:00Z" },
      { id: "f2", name: "Tablet", createdAt: "2026-11-05T10:00:00Z" },
      { id: "f3", name: "Authenticator app", createdAt: "2026-11-06T10:00:00Z" },
    ]);
  });
});

describe("confirmIdentity (G1: the password again, or a fresh code when a factor exists)", () => {
  it("with no factor, checks the password by signing in with it, with the bot check", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    await confirmIdentity({ email: "ada@example.com", factors: [], password: "secret-pass" });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "ada@example.com", password: "secret-pass", options: { captchaToken: "tok-1" } });
    expect(mfa.challengeAndVerify).not.toHaveBeenCalled();
  });

  it("with no factor, refuses a wrong password in our words", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials", code: "invalid_credentials" } });
    await expect(confirmIdentity({ email: "ada@example.com", factors: [], password: "nope" })).rejects.toThrow(MFA_COPY.wrongPassword);
  });

  it("with a factor, asks for a fresh code from it, and never the password", async () => {
    mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
    await confirmIdentity({ email: "ada@example.com", factors: [phone], password: "ignored", code: "123 456" });
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "f1", code: "123456" });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("with a factor, refuses a code that is not six digits before asking the server", async () => {
    await expect(confirmIdentity({ email: "ada@example.com", factors: [phone], code: "12" })).rejects.toThrow(MFA_COPY.codeShape);
    expect(mfa.challengeAndVerify).not.toHaveBeenCalled();
  });

  it("with a factor, says a wrong code plainly", async () => {
    mfa.challengeAndVerify.mockResolvedValue({ data: null, error: { code: "mfa_verification_failed", message: "Invalid TOTP code entered" } });
    await expect(confirmIdentity({ email: "ada@example.com", factors: [phone], code: "000000" })).rejects.toThrow(MFA_COPY.wrongCode);
  });
});

describe("adding and removing", () => {
  it("clears a half-finished authenticator, then enrols a TOTP one and returns its QR code and key", async () => {
    mfa.listFactors.mockResolvedValue({ data: { all: [{ id: "old", status: "unverified" }, { id: "f1", status: "verified" }], totp: [] }, error: null });
    mfa.unenroll.mockResolvedValue({ error: null });
    mfa.enroll.mockResolvedValue({ data: { id: "new", totp: { qr_code: "data:image/svg+xml;utf-8,<svg/>", secret: "JBSWY3DPEHPK3PXP", uri: "otpauth://x" } }, error: null });
    expect(await startAuthenticator("  My phone ")).toEqual({ factorId: "new", qrCode: "data:image/svg+xml;utf-8,<svg/>", secret: "JBSWY3DPEHPK3PXP" });
    expect(mfa.unenroll).toHaveBeenCalledTimes(1);
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: "old" });
    expect(mfa.enroll).toHaveBeenCalledWith({ factorType: "totp", friendlyName: "My phone" });
  });

  it("names it Authenticator app when no name is given", async () => {
    mfa.listFactors.mockResolvedValue({ data: { all: [], totp: [] }, error: null });
    mfa.enroll.mockResolvedValue({ data: { id: "new", totp: { qr_code: "q", secret: "s", uri: "u" } }, error: null });
    await startAuthenticator("   ");
    expect(mfa.enroll).toHaveBeenCalledWith({ factorType: "totp", friendlyName: "Authenticator app" });
  });

  it("says when the name is taken", async () => {
    mfa.listFactors.mockResolvedValue({ data: { all: [], totp: [] }, error: null });
    mfa.enroll.mockResolvedValue({ data: null, error: { code: "mfa_factor_name_conflict", message: "A factor with the friendly name already exists" } });
    await expect(startAuthenticator("Phone")).rejects.toThrow(MFA_COPY.nameTaken);
  });

  it("finishes with one code from the new authenticator", async () => {
    mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
    await confirmAuthenticator("new", "654321");
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "new", code: "654321" });
  });

  it("removes a verified authenticator", async () => {
    mfa.unenroll.mockResolvedValue({ error: null });
    await removeAuthenticator("f1");
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: "f1" });
  });
});

describe("G5: the backup-code calls (mfa-recovery reads who from the token; nothing here names a user)", () => {
  it("makes a new set", async () => {
    invoke.mockResolvedValue({ data: { codes: ["AAAAA-BBBBB"] }, error: null });
    expect(await createBackupCodes()).toEqual(["AAAAA-BBBBB"]);
    expect(invoke).toHaveBeenCalledWith("mfa-recovery", { method: "POST", body: { action: "create" } });
  });

  it("counts what is left", async () => {
    invoke.mockResolvedValue({ data: { left: 4 }, error: null });
    expect(await backupCodesLeft()).toBe(4);
  });

  it("redeems one, then notes this session as verified so the dialog does not ask again", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await redeemBackupCode("abcde-fghjk");
    expect(invoke).toHaveBeenCalledWith("mfa-recovery", { method: "POST", body: { action: "redeem", code: "abcde-fghjk" } });
    expect(markSessionRecovered).toHaveBeenCalledTimes(1);
  });

  it("passes on the function's sentence when it refuses, and marks nothing", async () => {
    invoke.mockResolvedValue({ data: null, error: { context: { status: 401, json: async () => ({ error: "That backup code didn't work." }) } } });
    await expect(redeemBackupCode("abcde-fghjk")).rejects.toThrow("That backup code didn't work.");
    expect(markSessionRecovered).not.toHaveBeenCalled();
  });

  it("removes a lost authenticator through the server", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await removeLostAuthenticator("f1");
    expect(invoke).toHaveBeenCalledWith("mfa-recovery", { method: "POST", body: { action: "remove_factor", factorId: "f1" } });
  });
});
