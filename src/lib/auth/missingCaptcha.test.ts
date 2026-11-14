// G7: with no token, join, sign in, reset request and resend verification are each refused, and the refusal comes back
// as our own sentence. The auth service is faked as it behaves with CAPTCHA protection on: any of these four requests
// without options.captchaToken is answered 400, code captcha_failed. (The live refusal needs the dashboard switch; see
// docs/security/auth-settings.md.)

import { beforeEach, describe, expect, it, vi } from "vitest";

const refusal = { name: "AuthApiError", status: 400, code: "captcha_failed", message: "captcha protection: request disallowed (no captcha response)" };
const captchaOf = (options?: { captchaToken?: string }) => options?.captchaToken;
const calls: Record<string, unknown[]> = {};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: async (args: { options?: { captchaToken?: string } }) => {
        calls.signInWithPassword = [args];
        return captchaOf(args.options) ? { data: { user: { id: "u-1" } }, error: null } : { data: { user: null }, error: refusal };
      },
      signUp: async (args: { options?: { captchaToken?: string } }) => {
        calls.signUp = [args];
        return captchaOf(args.options) ? { data: { session: null }, error: null } : { data: { session: null }, error: refusal };
      },
      resetPasswordForEmail: async (email: string, options?: { captchaToken?: string }) => {
        calls.resetPasswordForEmail = [email, options];
        return { error: captchaOf(options) ? null : refusal };
      },
      resend: async (args: { options?: { captchaToken?: string } }) => {
        calls.resend = [args];
        return { error: captchaOf(args.options) ? null : refusal };
      },
    },
  },
}));

import { messageFor } from "./authMessages";
import { resendSignupEmail } from "./emailLink";
import { requestPasswordReset } from "./passwordReset";
import { signInWithEmail } from "./signInWithEmail";
import { signUpWithEmail } from "./signUpWithEmail";

const VERIFY_FAILED = "Couldn't verify this request. Try again.";
const join = (captchaToken?: string) =>
  signUpWithEmail({ email: "ada@example.com", password: "Abcdefghij1!x", displayName: "Ada", username: "ada_l", emailRedirectTo: "https://x.example/verify-email", captchaToken });

beforeEach(() => {
  for (const key of Object.keys(calls)) delete calls[key];
});

describe("G7: no token, no request done", () => {
  it("sign in is refused, and the refusal reads as our sentence", async () => {
    const result = await signInWithEmail("ada@example.com", "hunter22", undefined);
    expect(result).toEqual({ outcome: "refused", refusal: "captcha" });
    expect(messageFor((result as { refusal: "captcha" }).refusal)).toBe(VERIFY_FAILED);
    expect(calls.signInWithPassword).toBeTruthy();
  });

  it("join is refused, and the refusal reads as our sentence", async () => {
    const result = await join(undefined);
    expect(result).toMatchObject({ outcome: "refused", refusal: "captcha" });
    expect(messageFor((result as { refusal: "captcha" }).refusal)).toBe(VERIFY_FAILED);
  });

  it("the reset request is refused, and the refusal reads as our sentence", async () => {
    const result = await requestPasswordReset("ada@example.com", "https://x.example/reset-password", undefined);
    expect(result).toEqual({ sent: false, refusal: "captcha" });
    expect(messageFor(result.refusal!)).toBe(VERIFY_FAILED);
  });

  it("resend verification is refused, and the refusal reads as our sentence", async () => {
    const result = await resendSignupEmail("ada@example.com", undefined);
    expect(result).toEqual({ sent: false, refusal: "captcha" });
    expect(messageFor(result.refusal!)).toBe(VERIFY_FAILED);
  });

  it("each goes through with a token", async () => {
    await expect(signInWithEmail("ada@example.com", "hunter22", "tok")).resolves.toEqual({ outcome: "signed-in", userId: "u-1" });
    await expect(join("tok")).resolves.toEqual({ outcome: "created", signedIn: false });
    await expect(requestPasswordReset("ada@example.com", "https://x.example/r", "tok")).resolves.toEqual({ sent: true });
    await expect(resendSignupEmail("ada@example.com", "tok")).resolves.toEqual({ sent: true });
  });
});
