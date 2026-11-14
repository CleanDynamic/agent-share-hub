// The reset views of the sign-in dialog (was UI-P36's `/reset-password` and `/reset-password/:token` page, whose
// path token now arrives as `?token=`): every state, handler and rule of pages/ResetPassword.tsx, held to what
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

// G6: the dialog's one Turnstile widget, faked: every submission takes its token and resets it.
const captcha = vi.hoisted(() => ({ token: vi.fn(), reset: vi.fn() }));
vi.mock("@/lib/auth/turnstile", () => ({ useTurnstile: () => captcha }));
vi.mock("@/lib/auth/passwordReset", () => ({
  requestPasswordReset: (...args: unknown[]) => requestPasswordReset(...args),
  setNewPassword: (...args: unknown[]) => setNewPassword(...args),
  onPasswordRecovery: (...args: unknown[]) => onPasswordRecovery(...args),
}));
vi.mock("@/lib/auth/emailLink", () => ({ verifyEmailLink: (...args: unknown[]) => verifyEmailLink(...args) }));
vi.mock("sonner", () => ({ toast: { success: (...args: unknown[]) => toastSuccess(...args) } }));
// A finished reset shows the Sign in view, which asks who is signed in: nobody.
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isLoggedIn: false, user: null, session: null, loading: false }) }));

import { renderDialog, setViewport } from "./signinTest";

let stopListening = vi.fn();
let recovery: () => void = () => {};

beforeEach(() => {
  captcha.token.mockReset().mockResolvedValue({ token: "tok-1", failed: false });
  captcha.reset.mockReset();
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

/** The old address, as the redirect hands it to the dialog: the query kept, a path token carried as `?token=`. */
const open = (url = "/reset-password") => {
  const [path, query = ""] = url.split("?");
  const search = new URLSearchParams(query);
  const token = path.split("/")[2];
  if (token) search.set("token", token);
  return renderDialog("reset", search.toString());
};
const openLink = open;

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

  it("is the title and the way back in row 1, and has no Sign in · Join free switch", () => {
    open();
    expect(screen.queryByRole("button", { name: "Join free" })).toBeNull();
    // The dialog's way back is row 1's link alone (D3).
    expect(screen.getAllByRole("link", { name: "Back to sign in" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Back to sign in" }).getAttribute("href")).toBe("/?signin=login");
  });

  it("asks for the link to land back on this page, and says to check the inbox, naming the address", async () => {
    requestPasswordReset.mockResolvedValue(true);
    open();
    type("you@example.com", "  ada@example.com ");
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("heading", { level: 2, name: "Check your inbox" })).toBeTruthy();
    expect(requestPasswordReset).toHaveBeenCalledWith("ada@example.com", `${window.location.origin}/reset-password`, "tok-1");
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    // G6: the widget is reset after the submission.
    expect(captcha.reset).toHaveBeenCalledTimes(1);
  });

  it("G6: says the check failed, sends nothing and resets, when the widget has no token", async () => {
    captcha.token.mockResolvedValue({ token: undefined, failed: true });
    open();
    type("you@example.com", "ada@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByText("Couldn't verify this request. Try again.")).toBeTruthy();
    expect(requestPasswordReset).not.toHaveBeenCalled();
    expect(captcha.reset).toHaveBeenCalledTimes(1);
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
    // The words' status, beside the InlineLoader's own (G27).
    expect(screen.getAllByRole("status").find((region) => region.getAttribute("data-ui") !== "inline-loader")!.textContent).toContain("We're confirming the link is still valid.");
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

    // Close the dialog: the address loses the dialog and the link's parameters, and the view goes.
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(where.at()).toBe("/"));
    expect(stopListening).toHaveBeenCalledTimes(1);
    expect(isCancelled()).toBe(true);
  });

  it("offers a new link from the dead-link state: back to the request form, with the address cleaned", async () => {
    verifyEmailLink.mockResolvedValue(false);
    const where = openLink("/reset-password/abc?code=stale");
    await screen.findByRole("heading", { name: "This reset link doesn't work" });

    fireEvent.click(screen.getByRole("button", { name: "Request a new one" }));

    expect(await screen.findByRole("heading", { level: 2, name: "Reset your password" })).toBeTruthy();
    expect(where.at()).toBe("/?signin=reset");
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
    expect(where.at()).toBe("/?signin=login");
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
