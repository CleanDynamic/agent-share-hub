// UI-P36 — `/reset-password` and `/reset-password/:token` in the entrance's
// frame: every state, handler and rule of pages/ResetPassword.tsx, held to what
// it did — the request form, the three ways an emailed link arrives, the
// new-password form's checks, and the dead link.
//
// The auth functions are stubbed and their calls counted, as the other pages'
// container tests do.

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requestPasswordReset = vi.fn();
const setNewPassword = vi.fn();
const onPasswordRecovery = vi.fn();
const verifyEmailLink = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/lib/auth/passwordReset", () => ({
  requestPasswordReset: (...args: unknown[]) => requestPasswordReset(...args),
  setNewPassword: (...args: unknown[]) => setNewPassword(...args),
  onPasswordRecovery: (...args: unknown[]) => onPasswordRecovery(...args),
}));
vi.mock("@/lib/auth/emailLink", () => ({ verifyEmailLink: (...args: unknown[]) => verifyEmailLink(...args) }));
vi.mock("sonner", () => ({ toast: { success: (...args: unknown[]) => toastSuccess(...args) } }));
vi.mock("@/lib/build/signals", () => ({ countReproducedToday: vi.fn().mockResolvedValue(48) }));
vi.mock("@/lib/build/gallery", () => ({ getGalleryStats: vi.fn().mockResolvedValue({ inGallery: 1284 }) }));

import { ResetPasswordPage } from "./ResetPasswordPage";
import { renderAt, setViewport } from "./signinTest";

let stopListening = vi.fn();
let recovery: () => void = () => {};

beforeEach(() => {
  setViewport("desktop");
  for (const fn of [requestPasswordReset, setNewPassword, onPasswordRecovery, verifyEmailLink, toastSuccess]) fn.mockReset();
  stopListening = vi.fn();
  onPasswordRecovery.mockImplementation((callback: () => void) => {
    recovery = callback;
    return stopListening;
  });
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  vi.useRealTimers();
});

const open = (url = "/reset-password", pattern = "/reset-password") => renderAt(<ResetPasswordPage />, url, pattern);
const openLink = (url: string) => open(url, url.startsWith("/reset-password/") ? "/reset-password/:token" : "/reset-password");

const type = (placeholder: string, value: string) => fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });

describe("the request form", () => {
  it("is the card the entrance spec looks for, and starts no verification", () => {
    open();
    expect(screen.getByText(/Reset your password/)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Reset your password" })).toBeTruthy();
    expect(verifyEmailLink).not.toHaveBeenCalled();
    expect(onPasswordRecovery).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeDisabled();
  });

  it("is the title and the way back, and has no Sign in · Join free switch", async () => {
    open();
    await waitFor(() => expect(document.title).toBe("Reset your password — buildgallery"));
    expect(screen.queryByRole("link", { name: "Join free" })).toBeNull();
    expect(screen.getAllByRole("link", { name: "Back to sign in" })[0].getAttribute("href")).toBe("/login");
  });

  it("asks for the link to land back on this page, and says to check the inbox, naming the address", async () => {
    requestPasswordReset.mockResolvedValue(true);
    open();
    type("you@example.com", "  ada@example.com ");
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("heading", { level: 2, name: "Check your inbox" })).toBeTruthy();
    expect(requestPasswordReset).toHaveBeenCalledWith("ada@example.com", `${window.location.origin}/reset-password`);
    expect(screen.getByText("ada@example.com")).toBeTruthy();
  });

  it("refuses an address with no domain before it asks anyone, under the field", () => {
    open();
    type("you@example.com", "ada@example");
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    const message = screen.getByText("Please enter a valid email.");
    expect(message.getAttribute("aria-live")).toBe("polite");
    expect(requestPasswordReset).not.toHaveBeenCalled();

    type("you@example.com", "ada@example.com");
    expect(screen.queryByText("Please enter a valid email.")).toBeNull();
  });

  it.each([
    ["a refusal", () => requestPasswordReset.mockResolvedValue(false)],
    ["a throw", () => requestPasswordReset.mockRejectedValue(new Error("network down"))],
  ])("says something went wrong on %s, and lets the reader try again", async (_name, arrange) => {
    arrange();
    open();
    type("you@example.com", "ada@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText("Something went wrong. Please try again.")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: "Send reset link" })).toBeEnabled());
  });

  it("says it is sending while the request is out", async () => {
    requestPasswordReset.mockReturnValue(new Promise(() => {}));
    open();
    type("you@example.com", "ada@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("button", { name: "Sending..." })).toBeDisabled();
  });
});

describe("an emailed link", () => {
  it("in the path: checks it as a recovery link, says so while it does, and becomes the new-password form", async () => {
    let verified: (ok: boolean) => void = () => {};
    verifyEmailLink.mockReturnValue(new Promise((resolve) => (verified = resolve)));
    openLink("/reset-password/abc");

    expect(screen.getByRole("heading", { level: 2, name: "Checking your reset link…" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("We're confirming the link is still valid.");
    expect(verifyEmailLink).toHaveBeenCalledTimes(1);
    expect(verifyEmailLink.mock.calls[0][0]).toEqual({ tokenHash: "abc", code: "", type: "recovery" });

    await act(async () => verified(true));
    expect(await screen.findByRole("heading", { level: 2, name: "Choose a new password" })).toBeTruthy();
  });

  it("in the query: reads token_hash, and a PKCE code", async () => {
    verifyEmailLink.mockResolvedValue(true);
    openLink("/reset-password?token_hash=h1");
    await screen.findByRole("heading", { name: "Choose a new password" });
    expect(verifyEmailLink.mock.calls[0][0]).toEqual({ tokenHash: "h1", code: "", type: "recovery" });
  });

  it("with a PKCE code: passes it on", async () => {
    verifyEmailLink.mockResolvedValue(true);
    openLink("/reset-password?code=pkce");
    await screen.findByRole("heading", { name: "Choose a new password" });
    expect(verifyEmailLink.mock.calls[0][0]).toEqual({ tokenHash: "", code: "pkce", type: "recovery" });
  });

  it("is a dead link when it cannot be turned into a session", async () => {
    verifyEmailLink.mockResolvedValue(false);
    openLink("/reset-password/abc");
    expect(await screen.findByRole("heading", { level: 2, name: "This reset link doesn't work" })).toBeTruthy();
  });

  it("is a dead link at once, without being checked, when the address came back with an error", async () => {
    openLink("/reset-password?error=access_denied&error_description=Email+link+is+invalid+or+has+expired");
    expect(await screen.findByRole("heading", { level: 2, name: "This reset link doesn't work" })).toBeTruthy();
    expect(verifyEmailLink).not.toHaveBeenCalled();
  });

  it("becomes the new-password form when the client raises a recovery session, and listens only while it waits", async () => {
    verifyEmailLink.mockReturnValue(new Promise(() => {}));
    openLink("/reset-password/abc");
    expect(onPasswordRecovery).toHaveBeenCalledTimes(1);

    await act(async () => recovery());
    expect(await screen.findByRole("heading", { level: 2, name: "Choose a new password" })).toBeTruthy();
  });

  it("stops listening, and stops looking, when the page goes", async () => {
    verifyEmailLink.mockReturnValue(new Promise(() => {}));
    const where = openLink("/reset-password/abc");
    const isCancelled = verifyEmailLink.mock.calls[0][1] as () => boolean;
    expect(isCancelled()).toBe(false);

    // Leave the page: the router sends the visitor somewhere this route does not match.
    fireEvent.click(screen.getByRole("link", { name: "Back" }));
    await waitFor(() => expect(where.at()).toBe("/"));
    expect(stopListening).toHaveBeenCalledTimes(1);
    expect(isCancelled()).toBe(true);
  });

  it("offers a new link from the dead-link state: back to the request form, with the address cleaned", async () => {
    verifyEmailLink.mockResolvedValue(false);
    openLink("/reset-password/abc");
    await screen.findByRole("heading", { name: "This reset link doesn't work" });

    window.history.replaceState({}, "", "/reset-password/abc?code=stale");
    fireEvent.click(screen.getByRole("button", { name: "Request a new one" }));

    expect(await screen.findByRole("heading", { level: 2, name: "Reset your password" })).toBeTruthy();
    expect(window.location.pathname + window.location.search).toBe("/reset-password");
  });
});

describe("the new-password form", () => {
  beforeEach(() => {
    verifyEmailLink.mockResolvedValue(true);
  });

  const reach = async () => {
    const where = openLink("/reset-password/abc");
    await screen.findByRole("heading", { name: "Choose a new password" });
    return where;
  };
  const submit = () => fireEvent.submit(screen.getByRole("button", { name: "Update password" }).closest("form")!);
  const settle = (ms = 200) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });

  it("opens when the new password is eight characters and confirmed with something", async () => {
    await reach();
    expect(screen.getByRole("button", { name: "Update password" })).toBeDisabled();
    type("At least 8 characters", "Abcdefghij1!x");
    expect(screen.getByRole("button", { name: "Update password" })).toBeDisabled();
    type("Re-enter your password", "x");
    expect(screen.getByRole("button", { name: "Update password" })).toBeEnabled();
  });

  it("refuses a password under eight characters, under the form", async () => {
    await reach();
    type("At least 8 characters", "short");
    type("Re-enter your password", "short");
    submit();
    expect(screen.getByText("Password must be at least 8 characters.").getAttribute("aria-live")).toBe("polite");
    expect(setNewPassword).not.toHaveBeenCalled();
  });

  it("refuses a weak password once its strength is worked out", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await reach();
    type("At least 8 characters", "12345678");
    type("Re-enter your password", "12345678");
    await settle();
    submit();
    expect(screen.getByText("Please choose a stronger password.")).toBeTruthy();
    expect(setNewPassword).not.toHaveBeenCalled();
  });

  it("says the two do not match, under the confirmation", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await reach();
    type("At least 8 characters", "Abcdefghij1!x");
    type("Re-enter your password", "Abcdefghij1!y");
    await settle();
    submit();
    const message = screen.getByText("Passwords don't match");
    expect(message.getAttribute("aria-live")).toBe("polite");
    expect(screen.getByLabelText("Confirm password", { exact: true }).getAttribute("aria-invalid")).toBe("true");
    expect(setNewPassword).not.toHaveBeenCalled();

    type("Re-enter your password", "Abcdefghij1!x");
    expect(screen.queryByText("Passwords don't match")).toBeNull();
  });

  it("sets the password, says so, and sends the reader to sign in", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setNewPassword.mockResolvedValue(undefined);
    const where = await reach();
    type("At least 8 characters", "Abcdefghij1!x");
    type("Re-enter your password", "Abcdefghij1!x");
    await settle();
    submit();
    await settle(0);

    expect(setNewPassword).toHaveBeenCalledWith("Abcdefghij1!x");
    expect(toastSuccess).toHaveBeenCalledWith("Password updated. Sign in with your new password.");
    expect(where.at()).toBe("/login");
  });

  it("shows the client's own words when it refuses, and words a failure with no message", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setNewPassword.mockRejectedValueOnce(new Error("New password should be different from the old password."));
    await reach();
    type("At least 8 characters", "Abcdefghij1!x");
    type("Re-enter your password", "Abcdefghij1!x");
    await settle();
    submit();
    await settle(0);
    expect(screen.getByText("New password should be different from the old password.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Update password" })).toBeEnabled();
    expect(toastSuccess).not.toHaveBeenCalled();

    setNewPassword.mockRejectedValueOnce("odd");
    submit();
    await settle(0);
    expect(screen.getByText("Something went wrong. Please try again.")).toBeTruthy();
  });

  it("clears the messages on the next key", async () => {
    await reach();
    type("At least 8 characters", "short");
    type("Re-enter your password", "short");
    submit();
    expect(screen.getByText("Password must be at least 8 characters.")).toBeTruthy();
    type("At least 8 characters", "shorter");
    expect(screen.queryByText("Password must be at least 8 characters.")).toBeNull();
  });
});
