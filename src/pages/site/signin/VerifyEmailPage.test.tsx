// UI-P36 — `/verify-email` and `/verify-email/:token` in the entrance's frame:
// every state, handler and rule of pages/VerifyEmail.tsx, held to what it did —
// the pending card and its resend with a cooldown, the ways an emailed link
// arrives, and where "Continue" goes.
//
// The auth functions are stubbed and their calls counted, as the other pages'
// container tests do.

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ session: null as { user: { id: string } } | null }));
const verifyEmailLink = vi.fn();
const resendSignupEmail = vi.fn();
const resolvePostAuthRoute = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: auth.session, user: auth.session?.user ?? null, isLoggedIn: Boolean(auth.session), loading: false }),
}));
vi.mock("@/lib/auth/emailLink", () => ({
  verifyEmailLink: (...args: unknown[]) => verifyEmailLink(...args),
  resendSignupEmail: (...args: unknown[]) => resendSignupEmail(...args),
}));
vi.mock("@/lib/auth/postAuthRoute", () => ({ resolvePostAuthRoute: (...args: unknown[]) => resolvePostAuthRoute(...args) }));
vi.mock("@/lib/build/signals", () => ({ countReproducedToday: vi.fn().mockResolvedValue(48) }));
vi.mock("@/lib/build/gallery", () => ({ getGalleryStats: vi.fn().mockResolvedValue({ inGallery: 1284 }) }));

import { renderAt, setViewport } from "./signinTest";
import { VerifyEmailPage } from "./VerifyEmailPage";

beforeEach(() => {
  setViewport("desktop");
  auth.session = null;
  verifyEmailLink.mockReset();
  resendSignupEmail.mockReset();
  resolvePostAuthRoute.mockReset();
  resolvePostAuthRoute.mockResolvedValue("/");
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  vi.useRealTimers();
});

const open = (url = "/verify-email", state?: unknown) =>
  renderAt(<VerifyEmailPage />, url, url.startsWith("/verify-email/") ? "/verify-email/:token" : "/verify-email", state);

describe("the pending card", () => {
  it("is the card the entrance spec looks for, naming the address it sent to, and starts no verification", async () => {
    window.sessionStorage.setItem("pending_verification_email", "ada@example.com");
    open();
    expect(screen.getByText(/Check your inbox/)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Check your inbox" })).toBeTruthy();
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    expect(verifyEmailLink).not.toHaveBeenCalled();
    await waitFor(() => expect(document.title).toBe("Verify your email — buildgallery"));
    expect(screen.queryByRole("link", { name: "Join free" })).toBeNull();
  });

  it("prefers the address the sign-up carried in the router's state over the remembered one", () => {
    window.sessionStorage.setItem("pending_verification_email", "old@example.com");
    open("/verify-email", { email: "ada@example.com" });
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    expect(screen.queryByText("old@example.com")).toBeNull();
  });

  it("says 'your email' when it does not know the address", () => {
    open();
    expect(screen.getByText("your email")).toBeTruthy();
  });

  it("sends Sign up again back to the join page", async () => {
    const where = open();
    fireEvent.click(screen.getByRole("button", { name: "Sign up again" }));
    await waitFor(() => expect(where.at()).toBe("/signup"));
  });

  it("goes to the join page instead of resending when there is no address to send to", async () => {
    const where = open();
    fireEvent.click(screen.getByRole("button", { name: "Resend verification" }));
    await waitFor(() => expect(where.at()).toBe("/signup"));
    expect(resendSignupEmail).not.toHaveBeenCalled();
  });
});

describe("resending", () => {
  beforeEach(() => {
    window.sessionStorage.setItem("pending_verification_email", "ada@example.com");
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  const settle = (ms: number) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });

  it("sends it again, says so, and then makes the reader wait 45 seconds, counting down", async () => {
    resendSignupEmail.mockResolvedValue(true);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Resend verification" }));
    await settle(0);

    expect(resendSignupEmail).toHaveBeenCalledWith("ada@example.com");
    expect(screen.getByText("Sent again — it should arrive in a minute.")).toBeTruthy();

    await settle(2500);
    expect(screen.getByText("Resend available in 45s")).toBeTruthy();
    await settle(1000);
    expect(screen.getByText("Resend available in 44s")).toBeTruthy();
    await settle(44_000);
    expect(screen.getByRole("button", { name: "Resend verification" })).toBeTruthy();
  });

  it("says it is sending while the request is out", async () => {
    resendSignupEmail.mockReturnValue(new Promise(() => {}));
    open();
    fireEvent.click(screen.getByRole("button", { name: "Resend verification" }));
    await settle(0);
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
  });

  it("gives the button back when the email could not be sent", async () => {
    resendSignupEmail.mockResolvedValue(false);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Resend verification" }));
    await settle(0);
    expect(screen.getByRole("button", { name: "Resend verification" })).toBeEnabled();
    expect(screen.queryByText("Sent again — it should arrive in a minute.")).toBeNull();
  });
});

describe("an emailed link", () => {
  it("in the path: checks it as an email confirmation, says so while it does, and says the reader is in", async () => {
    let verified: (ok: boolean) => void = () => {};
    verifyEmailLink.mockReturnValue(new Promise((resolve) => (verified = resolve)));
    open("/verify-email/tok");

    expect(screen.getByRole("heading", { level: 2, name: "Verifying your email…" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("We're checking the link you opened.");
    expect(verifyEmailLink.mock.calls[0][0]).toEqual({ tokenHash: "tok", code: "", type: "email" });

    await act(async () => verified(true));
    expect(await screen.findByRole("heading", { level: 2, name: "You're in" })).toBeTruthy();
  });

  it("reads token_hash, the type the link says, and a PKCE code", async () => {
    verifyEmailLink.mockResolvedValue(true);
    open("/verify-email?token_hash=h1&type=signup");
    await screen.findByRole("heading", { name: "You're in" });
    expect(verifyEmailLink.mock.calls[0][0]).toEqual({ tokenHash: "h1", code: "", type: "signup" });
  });

  it("with a PKCE code: passes it on", async () => {
    verifyEmailLink.mockResolvedValue(true);
    open("/verify-email?code=pkce");
    await screen.findByRole("heading", { name: "You're in" });
    expect(verifyEmailLink.mock.calls[0][0]).toEqual({ tokenHash: "", code: "pkce", type: "email" });
  });

  it("is a dead link when it cannot be turned into a session", async () => {
    verifyEmailLink.mockResolvedValue(false);
    open("/verify-email/tok");
    expect(await screen.findByRole("heading", { level: 2, name: "This link doesn't work" })).toBeTruthy();
  });

  it("is a dead link at once, without being checked, when the address came back with an error", async () => {
    open("/verify-email?error=access_denied&error_description=Email+link+is+invalid+or+has+expired");
    expect(await screen.findByRole("heading", { level: 2, name: "This link doesn't work" })).toBeTruthy();
    expect(verifyEmailLink).not.toHaveBeenCalled();
  });

  it("stops looking when the page goes", async () => {
    verifyEmailLink.mockReturnValue(new Promise(() => {}));
    const where = open("/verify-email/tok");
    const isCancelled = verifyEmailLink.mock.calls[0][1] as () => boolean;
    expect(isCancelled()).toBe(false);

    fireEvent.click(screen.getByRole("link", { name: "Back" }));
    await waitFor(() => expect(where.at()).toBe("/"));
    expect(isCancelled()).toBe(true);
  });

  it("sends a new link from the dead-link card to the address it knows, and goes back to sign in when asked", async () => {
    window.sessionStorage.setItem("pending_verification_email", "ada@example.com");
    resendSignupEmail.mockResolvedValue(true);
    verifyEmailLink.mockResolvedValue(false);
    const where = open("/verify-email/tok");
    await screen.findByRole("heading", { name: "This link doesn't work" });

    fireEvent.click(screen.getByRole("button", { name: "Send a new link" }));
    await waitFor(() => expect(resendSignupEmail).toHaveBeenCalledWith("ada@example.com"));

    fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
    await waitFor(() => expect(where.at()).toBe("/login"));
  });
});

describe("Continue", () => {
  const reach = async () => {
    verifyEmailLink.mockResolvedValue(true);
    const where = open("/verify-email/tok");
    await screen.findByRole("heading", { name: "You're in" });
    return where;
  };

  it("goes where the signed-in reader's profile says: onboarding, or Home", async () => {
    auth.session = { user: { id: "u-1" } };
    resolvePostAuthRoute.mockResolvedValue("/onboarding/profile");
    const where = await reach();
    fireEvent.click(screen.getByRole("button", { name: "Continue to buildgallery" }));
    await waitFor(() => expect(where.at()).toBe("/onboarding/profile"));
    expect(resolvePostAuthRoute).toHaveBeenCalledWith("u-1");
  });

  it("goes to sign in when there is no session", async () => {
    const where = await reach();
    fireEvent.click(screen.getByRole("button", { name: "Continue to buildgallery" }));
    await waitFor(() => expect(where.at()).toBe("/login"));
    expect(resolvePostAuthRoute).not.toHaveBeenCalled();
  });
});
