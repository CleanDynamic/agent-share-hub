// UI-P36a — the auth actions the sign-in pages call, as named functions.
//
// They are the Supabase calls Login, Signup, ResetPassword and VerifyEmail make
// inline, moved out of the components with the same order, the same arguments
// and the same ways of failing. The client is stubbed and every call recorded,
// so the claims are about what is asked of it and in what order.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const signInWithPassword = vi.fn();
const signUp = vi.fn();
const resetPasswordForEmail = vi.fn();
const updateUser = vi.fn();
const signOut = vi.fn();
const verifyOtp = vi.fn();
const getSession = vi.fn();
const exchangeCodeForSession = vi.fn();
const resend = vi.fn();
const onAuthStateChange = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
      signUp: (...args: unknown[]) => signUp(...args),
      resetPasswordForEmail: (...args: unknown[]) => resetPasswordForEmail(...args),
      updateUser: (...args: unknown[]) => updateUser(...args),
      signOut: (...args: unknown[]) => signOut(...args),
      verifyOtp: (...args: unknown[]) => verifyOtp(...args),
      getSession: (...args: unknown[]) => getSession(...args),
      exchangeCodeForSession: (...args: unknown[]) => exchangeCodeForSession(...args),
      resend: (...args: unknown[]) => resend(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChange(...args),
    },
  },
}));

import { verifyEmailLink, resendSignupEmail } from "./emailLink";
import { onPasswordRecovery, requestPasswordReset, setNewPassword } from "./passwordReset";
import { signInWithEmailOrUsername } from "./signInWithEmailOrUsername";
import { signUpWithEmail } from "./signUpWithEmail";

beforeEach(() => {
  for (const fn of [
    rpc,
    signInWithPassword,
    signUp,
    resetPasswordForEmail,
    updateUser,
    signOut,
    verifyOtp,
    getSession,
    exchangeCodeForSession,
    resend,
    onAuthStateChange,
  ]) {
    fn.mockReset();
  }
  signOut.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("signInWithEmailOrUsername", () => {
  it("signs in with an email as typed, trimmed, and never looks a username up", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });

    await expect(signInWithEmailOrUsername("  ada@example.com ", "hunter22")).resolves.toEqual({
      outcome: "signed-in",
      userId: "u-1",
    });

    expect(rpc).not.toHaveBeenCalled();
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "ada@example.com", password: "hunter22" });
  });

  it("resolves a username to its email first, and signs in with that", async () => {
    rpc.mockResolvedValue({ data: "ada@example.com", error: null });
    signInWithPassword.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });

    await expect(signInWithEmailOrUsername("ada_l", "hunter22")).resolves.toEqual({ outcome: "signed-in", userId: "u-1" });

    expect(rpc).toHaveBeenCalledWith("get_email_by_username", { _username: "ada_l" });
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "ada@example.com", password: "hunter22" });
  });

  it("refuses a username that resolves to nothing, without trying the password", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(signInWithEmailOrUsername("nobody", "x")).resolves.toEqual({ outcome: "unknown-username" });

    rpc.mockResolvedValueOnce({ data: "ada@example.com", error: { message: "boom" } });
    await expect(signInWithEmailOrUsername("nobody", "x")).resolves.toEqual({ outcome: "unknown-username" });

    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("tells an unconfirmed email from any other refusal, whatever the case of the message", async () => {
    signInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: { message: "Email not confirmed" } });
    await expect(signInWithEmailOrUsername("ada@example.com", "x")).resolves.toEqual({ outcome: "email-not-confirmed" });

    signInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: { message: "EMAIL NOT CONFIRMED" } });
    await expect(signInWithEmailOrUsername("ada@example.com", "x")).resolves.toEqual({ outcome: "email-not-confirmed" });

    signInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: { message: "Invalid login credentials" } });
    await expect(signInWithEmailOrUsername("ada@example.com", "x")).resolves.toEqual({ outcome: "rejected" });
  });

  it("answers a null user id when the session came back without a user", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: null }, error: null });
    await expect(signInWithEmailOrUsername("ada@example.com", "x")).resolves.toEqual({ outcome: "signed-in", userId: null });
  });

  it("lets a thrown failure through, for the page's one 'something went wrong'", async () => {
    signInWithPassword.mockRejectedValue(new Error("network down"));
    await expect(signInWithEmailOrUsername("ada@example.com", "x")).rejects.toThrow("network down");
  });
});

describe("signUpWithEmail", () => {
  const input = {
    email: "ada@example.com",
    password: "Abcdefghij1!x",
    displayName: "Ada Lovelace",
    username: "ada_l",
    emailRedirectTo: "https://buildgallery.ai/verify-email",
  };

  it("sends the metadata the handle_new_user trigger reads, in snake case", async () => {
    signUp.mockResolvedValue({ data: { session: null }, error: null });

    await signUpWithEmail(input);

    expect(signUp).toHaveBeenCalledWith({
      email: "ada@example.com",
      password: "Abcdefghij1!x",
      options: {
        data: { display_name: "Ada Lovelace", username: "ada_l" },
        emailRedirectTo: "https://buildgallery.ai/verify-email",
      },
    });
  });

  it("is signed in only when the project returned a session", async () => {
    signUp.mockResolvedValueOnce({ data: { session: { access_token: "t" } }, error: null });
    await expect(signUpWithEmail(input)).resolves.toEqual({ outcome: "created", signedIn: true });

    signUp.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(signUpWithEmail(input)).resolves.toEqual({ outcome: "created", signedIn: false });
  });

  it.each([
    "User already registered",
    "A user with this email address has already been registered",
    "Email already exists",
  ])("knows %j as an address that already has an account", async (message) => {
    signUp.mockResolvedValue({ data: { session: null }, error: { message } });
    await expect(signUpWithEmail(input)).resolves.toEqual({ outcome: "already-registered", message });
  });

  it("passes any other refusal on in the client's own words", async () => {
    signUp.mockResolvedValue({ data: { session: null }, error: { message: "Email rate limit exceeded" } });
    await expect(signUpWithEmail(input)).resolves.toEqual({
      outcome: "refused",
      message: "Email rate limit exceeded",
    });
  });
});

describe("requestPasswordReset", () => {
  it("asks for the link to land on the page it names, and says whether it was accepted", async () => {
    resetPasswordForEmail.mockResolvedValueOnce({ error: null });
    await expect(requestPasswordReset("ada@example.com", "https://buildgallery.ai/reset-password")).resolves.toBe(true);
    expect(resetPasswordForEmail).toHaveBeenCalledWith("ada@example.com", {
      redirectTo: "https://buildgallery.ai/reset-password",
    });

    resetPasswordForEmail.mockResolvedValueOnce({ error: { message: "nope" } });
    await expect(requestPasswordReset("ada@example.com", "https://x")).resolves.toBe(false);
  });
});

describe("setNewPassword", () => {
  it("updates the password, then signs the recovery session out", async () => {
    const order: string[] = [];
    updateUser.mockImplementation(async () => {
      order.push("update");
      return { error: null };
    });
    signOut.mockImplementation(async () => {
      order.push("signOut");
      return { error: null };
    });

    await setNewPassword("Abcdefghij1!x");

    expect(updateUser).toHaveBeenCalledWith({ password: "Abcdefghij1!x" });
    expect(order).toEqual(["update", "signOut"]);
  });

  it("throws the client's error, and leaves the session alone, when the update is refused", async () => {
    const refusal = new Error("New password should be different from the old password.");
    updateUser.mockResolvedValue({ error: refusal });

    await expect(setNewPassword("same")).rejects.toBe(refusal);
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe("onPasswordRecovery", () => {
  it("calls back for a recovery session only, and returns the way to stop listening", () => {
    const unsubscribe = vi.fn();
    let listener: (event: string) => void = () => undefined;
    onAuthStateChange.mockImplementation((cb: (event: string) => void) => {
      listener = cb;
      return { data: { subscription: { unsubscribe } } };
    });

    const onRecovery = vi.fn();
    const stop = onPasswordRecovery(onRecovery);

    listener("SIGNED_IN");
    listener("TOKEN_REFRESHED");
    expect(onRecovery).not.toHaveBeenCalled();
    listener("PASSWORD_RECOVERY");
    expect(onRecovery).toHaveBeenCalledTimes(1);

    expect(unsubscribe).not.toHaveBeenCalled();
    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe("verifyEmailLink", () => {
  const link = (over: Partial<{ tokenHash: string; code: string; type: "email" | "recovery" | "signup" }> = {}) => ({
    tokenHash: "",
    code: "",
    type: "email" as const,
    ...over,
  });

  it("spends a token hash once, with the type the link is for, and looks for no session", async () => {
    verifyOtp.mockResolvedValue({ error: null });

    await expect(verifyEmailLink(link({ tokenHash: "abc", type: "recovery" }))).resolves.toBe(true);

    expect(verifyOtp).toHaveBeenCalledTimes(1);
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type: "recovery" });
    expect(getSession).not.toHaveBeenCalled();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("is a dead link when the token is refused, and does not fall back to a session", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "Email link is invalid or has expired" } });

    await expect(verifyEmailLink(link({ tokenHash: "abc" }))).resolves.toBe(false);
    expect(getSession).not.toHaveBeenCalled();
  });

  it("takes a session the client has already read out of the URL, without exchanging a code", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });

    await expect(verifyEmailLink(link({ code: "pkce" }))).resolves.toBe(true);

    expect(getSession).toHaveBeenCalledTimes(1);
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("exchanges a PKCE code on the first look that finds no session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    exchangeCodeForSession.mockResolvedValue({ error: null });

    await expect(verifyEmailLink(link({ code: "pkce" }))).resolves.toBe(true);

    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(exchangeCodeForSession).toHaveBeenCalledWith("pkce");
  });

  it("keeps looking, 200ms apart, when the exchange fails, and takes the session when it appears", async () => {
    vi.useFakeTimers();
    getSession
      .mockResolvedValueOnce({ data: { session: null } })
      .mockResolvedValueOnce({ data: { session: null } })
      .mockResolvedValue({ data: { session: { access_token: "t" } } });
    exchangeCodeForSession.mockResolvedValue({ error: { message: "already used" } });

    const done = verifyEmailLink(link({ code: "pkce" }));
    await vi.advanceTimersByTimeAsync(400);

    await expect(done).resolves.toBe(true);
    // The code is tried on the first look only.
    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(getSession).toHaveBeenCalledTimes(3);
  });

  it("gives up after twenty looks, so a link that produces nothing is a dead one", async () => {
    vi.useFakeTimers();
    getSession.mockResolvedValue({ data: { session: null } });

    const done = verifyEmailLink(link());
    await vi.advanceTimersByTimeAsync(20 * 200);

    await expect(done).resolves.toBe(false);
    expect(getSession).toHaveBeenCalledTimes(20);
  });

  it("stops looking when the page that asked has gone", async () => {
    vi.useFakeTimers();
    getSession.mockResolvedValue({ data: { session: null } });
    let gone = false;

    const done = verifyEmailLink(link(), () => gone);
    await vi.advanceTimersByTimeAsync(200);
    gone = true;
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(done).resolves.toBe(false);
    expect(getSession.mock.calls.length).toBeLessThan(5);
  });

  it("is a dead link when anything throws", async () => {
    getSession.mockRejectedValue(new Error("boom"));
    await expect(verifyEmailLink(link())).resolves.toBe(false);
  });
});

describe("resendSignupEmail", () => {
  it("asks for the signup email again, and says whether it went", async () => {
    resend.mockResolvedValueOnce({ error: null });
    await expect(resendSignupEmail("ada@example.com")).resolves.toBe(true);
    expect(resend).toHaveBeenCalledWith({ type: "signup", email: "ada@example.com" });

    resend.mockResolvedValueOnce({ error: { message: "rate limited" } });
    await expect(resendSignupEmail("ada@example.com")).resolves.toBe(false);
  });
});
