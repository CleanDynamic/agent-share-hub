// The Sign in view of the sign-in dialog (was UI-P36's `/login` page): every handler, validation, provider and
// ?redirect= behaviour of pages/Login.tsx, held to what it did, now with the dialog over Home.
//
// The auth functions are stubbed and their calls counted, as the other pages'
// container tests do. What is claimed is what the container asks of them, what
// it says back, and where it sends the visitor.

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ isLoggedIn: false }));
const signIn = vi.fn();
const resolvePostAuthRoute = vi.fn();
const startOAuthSignIn = vi.fn();

// G6: the dialog's one Turnstile widget, faked: every submission takes its token and resets it.
const captcha = vi.hoisted(() => ({ token: vi.fn(), reset: vi.fn() }));
vi.mock("@/lib/auth/turnstile", () => ({ useTurnstile: () => captcha }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoggedIn: auth.isLoggedIn, user: null, session: null, loading: false }),
}));
vi.mock("@/lib/auth/signInWithEmail", () => ({
  signInWithEmail: (...args: unknown[]) => signIn(...args),
}));
const resendSignupEmail = vi.fn();
vi.mock("@/lib/auth/emailLink", () => ({ resendSignupEmail: (...args: unknown[]) => resendSignupEmail(...args) }));
vi.mock("@/lib/auth/postAuthRoute", () => ({ resolvePostAuthRoute: (...args: unknown[]) => resolvePostAuthRoute(...args) }));
vi.mock("@/lib/auth/oauth", () => ({ startOAuthSignIn: (...args: unknown[]) => startOAuthSignIn(...args) }));

import { renderDialog, setViewport } from "./signinTest";

beforeEach(() => {
  captcha.token.mockReset().mockResolvedValue({ token: "tok-1", failed: false });
  captcha.reset.mockReset();
  setViewport("desktop");
  auth.isLoggedIn = false;
  signIn.mockReset();
  resendSignupEmail.mockReset().mockResolvedValue({ sent: true });
  resolvePostAuthRoute.mockReset();
  startOAuthSignIn.mockReset();
  resolvePostAuthRoute.mockResolvedValue("/");
});

/** The old address's query, on the dialog's Sign in view over Home. */
const open = (url = "/login") => renderDialog("login", url.split("?")[1] ?? "");
/** The form's primary: the switch's "Sign in" is a button too. */
const primary = () => document.querySelector<HTMLButtonElement>('[data-variant="signin-primary"]')!;

const fill = (identifier = "ada@example.com", password = "hunter22") => {
  fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: identifier } });
  fireEvent.change(screen.getByPlaceholderText("Enter your password"), { target: { value: password } });
};
const submit = () => fireEvent.click(primary());

describe("the gate", () => {
  it("opens when both fields have something in them, as the existing spec finds it", () => {
    open();
    expect(primary()).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "ada@example.com" } });
    expect(primary()).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("Enter your password"), { target: { value: "hunter22" } });
    expect(primary()).toBeEnabled();
  });

  it("is a modal dialog over the page, labelled by the tagline", () => {
    open();
    const dialog = screen.getByRole("dialog", { name: "Publish, reproduce and fork AI-assisted workflows." });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });
});

describe("signing in", () => {
  it("sends what was typed, and goes where the profile says when there is no redirect", async () => {
    signIn.mockResolvedValue({ outcome: "signed-in", userId: "u-1" });
    resolvePostAuthRoute.mockResolvedValue("/onboarding");
    const where = open();
    fill("  ada@example.com ", "hunter22");
    submit();

    await waitFor(() => expect(where.at()).toBe("/onboarding"));
    expect(signIn).toHaveBeenCalledWith("  ada@example.com ", "hunter22", "tok-1");
    expect(resolvePostAuthRoute).toHaveBeenCalledWith("u-1");
  });

  it("with ?redirect=/gallery lands on the gallery, and never asks where next", async () => {
    signIn.mockResolvedValue({ outcome: "signed-in", userId: "u-1" });
    const where = open("/login?redirect=%2Fgallery");
    fill();
    submit();

    await waitFor(() => expect(where.at()).toBe("/gallery"));
    expect(resolvePostAuthRoute).not.toHaveBeenCalled();
  });

  it("takes an unencoded redirect the same way", async () => {
    signIn.mockResolvedValue({ outcome: "signed-in", userId: "u-1" });
    const where = open("/login?redirect=/gallery");
    fill();
    submit();
    await waitFor(() => expect(where.at()).toBe("/gallery"));
  });

  it("honours returnTo", async () => {
    signIn.mockResolvedValue({ outcome: "signed-in", userId: "u-1" });
    const where = open("/login?returnTo=%2Fb2%2Finvoice-triage-agent");
    fill();
    submit();
    await waitFor(() => expect(where.at()).toBe("/b2/invoice-triage-agent"));
  });

  it.each([
    ["an absolute address", "https%3A%2F%2Fexample.com"],
    ["a protocol-relative address", "%2F%2Fexample.com"],
    ["a slash-backslash address", "%2F%5Cexample.com"],
  ])("G16: lands on / for %s in redirect, and never asks where next", async (_name, value) => {
    signIn.mockResolvedValue({ outcome: "signed-in", userId: "u-1" });
    const where = open(`/login?redirect=${value}`);
    fill();
    submit();
    await waitFor(() => expect(where.at()).toBe("/"));
    expect(resolvePostAuthRoute).not.toHaveBeenCalled();
  });

  it("G17: lands on the exact address the guard carried: path, query and hash", async () => {
    signIn.mockResolvedValue({ outcome: "signed-in", userId: "u-1" });
    const where = open(`/login?redirect=${encodeURIComponent("/library?view=saved#top")}`);
    fill();
    submit();
    await waitFor(() => expect(where.at()).toBe("/library?view=saved"));
    expect(where.hash()).toBe("#top");
  });

  it("G16: lands on / for a hostile returnTo", async () => {
    signIn.mockResolvedValue({ outcome: "signed-in", userId: "u-1" });
    const where = open("/login?returnTo=javascript%3Aalert(1)");
    fill();
    submit();
    await waitFor(() => expect(where.at()).toBe("/"));
  });

  it("goes Home when the session came back without a user", async () => {
    signIn.mockResolvedValue({ outcome: "signed-in", userId: null });
    const where = open();
    fill();
    submit();
    await waitFor(() => expect(where.at()).toBe("/"));
    expect(resolvePostAuthRoute).not.toHaveBeenCalled();
  });

  it("says it is signing in while the request is out, and the button waits", async () => {
    let finish: (value: unknown) => void = () => {};
    signIn.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    open();
    fill();
    submit();

    const busy = await screen.findByRole("button", { name: "Signing in" });
    expect(busy).toBeDisabled();
    await act(async () => finish({ outcome: "refused", refusal: "credentials" }));
    await waitFor(() => expect(primary()).toBeEnabled());
    expect(primary().textContent).toBe("Sign in");
  });
});

describe("the bot check (G6)", () => {
  it("sends the widget's token with the sign-in, and resets the widget after a success", async () => {
    signIn.mockResolvedValue({ outcome: "signed-in", userId: "u-1" });
    open("/login?redirect=%2Fgallery");
    fill();
    submit();
    await waitFor(() => expect(signIn).toHaveBeenCalledWith("ada@example.com", "hunter22", "tok-1"));
    await waitFor(() => expect(captcha.reset).toHaveBeenCalledTimes(1));
  });

  it("resets the widget after a refusal and after a thrown failure", async () => {
    signIn.mockResolvedValueOnce({ outcome: "refused", refusal: "credentials" }).mockRejectedValueOnce(new Error("network down"));
    open();
    fill();
    submit();
    await waitFor(() => expect(captcha.reset).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(primary()).toBeEnabled());
    submit();
    await waitFor(() => expect(captcha.reset).toHaveBeenCalledTimes(2));
  });

  it("says the check failed, sends nothing and resets, when the widget has no token", async () => {
    captcha.token.mockResolvedValue({ token: undefined, failed: true });
    open();
    fill();
    submit();
    expect(await screen.findByText("Couldn't verify this request. Try again.")).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
    expect(captcha.reset).toHaveBeenCalledTimes(1);
    expect(primary()).toBeEnabled();
  });
});

describe("the refusals", () => {
  it("G7: surfaces the server's refusal of a missing or bad token as our sentence", async () => {
    signIn.mockResolvedValue({ outcome: "refused", refusal: "captcha" });
    open();
    fill();
    submit();
    expect(await screen.findByText("Couldn't verify this request. Try again.")).toBeTruthy();
  });

  it.each(["credentials"])(
    "says Wrong email or password for %s, under the password, announced politely",
    async (refusal) => {
      signIn.mockResolvedValue({ outcome: "refused", refusal });
      open();
      fill();
      submit();

      const message = await screen.findByText("That email or password isn't right.");
      expect(message.getAttribute("aria-live")).toBe("polite");
      expect(screen.getByPlaceholderText("Enter your password").getAttribute("aria-invalid")).toBe("true");
      expect(primary()).toBeEnabled();
    },
  );

  it("G4: asks for an email address when there is no @, before any request is sent", async () => {
    open();
    fill("ada_l", "hunter22");
    submit();
    expect(await screen.findByText("Sign in with your email address.")).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
    expect(primary()).toBeEnabled();
  });

  it("G12: says the same for an unconfirmed email as for a wrong password, and never asks to verify", async () => {
    signIn.mockResolvedValue({ outcome: "refused", refusal: "credentials" });
    open();
    fill();
    submit();
    expect(await screen.findByText("That email or password isn't right.")).toBeTruthy();
    expect(screen.queryByText(/verify your email/i)).toBeNull();
  });

  it("says something went wrong when the request throws, and lets the reader try again", async () => {
    signIn.mockRejectedValue(new Error("network down"));
    open();
    fill();
    submit();
    expect(await screen.findByText("Couldn't do that. Try again.")).toBeTruthy();
    expect(primary()).toBeEnabled();
  });

  it("clears the message on the next key in either field", async () => {
    signIn.mockResolvedValue({ outcome: "refused", refusal: "credentials" });
    open();
    fill();
    submit();
    await screen.findByText("That email or password isn't right.");

    fireEvent.change(screen.getByPlaceholderText("Enter your password"), { target: { value: "hunter23" } });
    expect(screen.queryByText("That email or password isn't right.")).toBeNull();

    submit();
    await screen.findByText("That email or password isn't right.");
    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "grace@example.com" } });
    expect(screen.queryByText("That email or password isn't right.")).toBeNull();
  });
});

describe("Resend verification email (G12)", () => {
  const resend = () => fireEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
  const ANSWER = "If that address needs verifying, we've sent a link.";

  it("sends to the address typed, with the widget's token, and answers the one sentence", async () => {
    open();
    fill("ada@example.com", "");
    resend();
    expect(await screen.findByText(ANSWER)).toBeTruthy();
    expect(resendSignupEmail).toHaveBeenCalledWith("ada@example.com", "tok-1");
    expect(captcha.reset).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["refused", () => resendSignupEmail.mockResolvedValue({ sent: false, refusal: "unknown" })],
    ["thrown", () => resendSignupEmail.mockRejectedValue(new Error("network down"))],
  ])("answers the same sentence when the request is %s", async (_name, arrange) => {
    arrange();
    open();
    fill("nobody@example.com", "");
    resend();
    expect(await screen.findByText(ANSWER)).toBeTruthy();
  });

  it("answers the same sentence without sending when the field holds no address", async () => {
    open();
    fill("ada_l", "");
    resend();
    expect(await screen.findByText(ANSWER)).toBeTruthy();
    expect(resendSignupEmail).not.toHaveBeenCalled();
  });

  it("says the check failed when the widget has no token, and sends nothing", async () => {
    captcha.token.mockResolvedValue({ token: undefined, failed: true });
    open();
    fill("ada@example.com", "");
    resend();
    expect(await screen.findByText("Couldn't verify this request. Try again.")).toBeTruthy();
    expect(resendSignupEmail).not.toHaveBeenCalled();
  });

  it("is offered again once the address changes", async () => {
    open();
    fill("ada@example.com", "");
    resend();
    await screen.findByText(ANSWER);
    fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "grace@example.com" } });
    expect(screen.queryByText(ANSWER)).toBeNull();
    expect(screen.getByRole("button", { name: "Resend verification email" })).toBeTruthy();
  });
});

describe("a visitor who is already signed in", () => {
  it("is sent Home at once", async () => {
    auth.isLoggedIn = true;
    const where = open("/login");
    await waitFor(() => expect(where.at()).toBe("/"));
  });

  it("G16: is sent to / when the redirect leaves the site", async () => {
    auth.isLoggedIn = true;
    const where = open("/login?redirect=https%3A%2F%2Fexample.com");
    await waitFor(() => expect(where.at()).toBe("/"));
  });

  it("is sent to the redirect when there is one", async () => {
    auth.isLoggedIn = true;
    const where = open("/login?redirect=%2Fgallery");
    await waitFor(() => expect(where.at()).toBe("/gallery"));
  });
});

describe("the providers", () => {
  it("starts the one that was clicked, and leaves every button waiting: the page is about to leave", async () => {
    startOAuthSignIn.mockResolvedValue(null);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Continue with GitHub" }));

    await waitFor(() => expect(startOAuthSignIn).toHaveBeenCalledWith("github", null));
    // G12: the one that was clicked now says it is opening.
    for (const name of ["Continue with Google", "Opening GitHub", "Continue with X"]) {
      await waitFor(() => expect(screen.getByRole("button", { name })).toBeDisabled());
    }
  });

  it("names each provider to the function that starts it", async () => {
    startOAuthSignIn.mockResolvedValue(null);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    await waitFor(() => expect(startOAuthSignIn).toHaveBeenLastCalledWith("google", null));
  });

  it("G18: carries the return address to the provider, through the gate", async () => {
    startOAuthSignIn.mockResolvedValue(null);
    open(`/login?redirect=${encodeURIComponent("/library?view=saved#top")}`);
    fireEvent.click(screen.getByRole("button", { name: "Continue with X" }));
    await waitFor(() => expect(startOAuthSignIn).toHaveBeenLastCalledWith("x", "/library?view=saved#top"));
  });

  it("says why it could not start, and gives the buttons back to try again", async () => {
    startOAuthSignIn.mockResolvedValueOnce("Couldn't connect to x. Please try again.").mockResolvedValue(null);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Continue with X" }));

    expect(await screen.findByText("Couldn't connect to x. Please try again.")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue with X" })).toBeEnabled());

    fireEvent.click(screen.getByRole("button", { name: "Continue with X" }));
    await waitFor(() => expect(startOAuthSignIn).toHaveBeenCalledTimes(2));
  });
});

describe("the rest of the dialog", () => {
  it("carries ?redirect= across to Join free, and back, on the same page", async () => {
    const where = open("/login?redirect=%2Fgallery");
    fireEvent.click(screen.getByRole("button", { name: "Join free" }));
    await waitFor(() => expect(where.at()).toBe("/?redirect=%2Fgallery&signin=signup"));
    fireEvent.click(screen.getAllByRole("button", { name: "Sign in" })[0]);
    await waitFor(() => expect(where.at()).toBe("/?redirect=%2Fgallery&signin=login"));
  });

  it("points Forgot password? at the reset view on the same page, and Close takes the dialog off", async () => {
    const where = open("/login?redirect=%2Fgallery");
    expect(screen.getByRole("link", { name: "Forgot password?" }).getAttribute("href")).toBe("/?redirect=%2Fgallery&signin=reset");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(where.at()).toBe("/"));
  });
});
