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

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoggedIn: auth.isLoggedIn, user: null, session: null, loading: false }),
}));
vi.mock("@/lib/auth/signInWithEmailOrUsername", () => ({
  signInWithEmailOrUsername: (...args: unknown[]) => signIn(...args),
}));
vi.mock("@/lib/auth/postAuthRoute", () => ({ resolvePostAuthRoute: (...args: unknown[]) => resolvePostAuthRoute(...args) }));
vi.mock("@/lib/auth/oauth", () => ({ startOAuthSignIn: (...args: unknown[]) => startOAuthSignIn(...args) }));

import { renderDialog, setViewport } from "./signinTest";

beforeEach(() => {
  setViewport("desktop");
  auth.isLoggedIn = false;
  signIn.mockReset();
  resolvePostAuthRoute.mockReset();
  startOAuthSignIn.mockReset();
  resolvePostAuthRoute.mockResolvedValue("/");
});

/** The old address's query, on the dialog's Sign in view over Home. */
const open = (url = "/login") => renderDialog("login", url.split("?")[1] ?? "");
/** The form's primary: the switch's "Sign in" is a button too. */
const primary = () => document.querySelector<HTMLButtonElement>('[data-variant="signin-primary"]')!;

const fill = (identifier = "ada@example.com", password = "hunter22") => {
  fireEvent.change(screen.getByPlaceholderText("Email or username"), { target: { value: identifier } });
  fireEvent.change(screen.getByPlaceholderText("Enter your password"), { target: { value: password } });
};
const submit = () => fireEvent.click(primary());

describe("the gate", () => {
  it("opens when both fields have something in them, as the existing spec finds it", () => {
    open();
    expect(primary()).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("Email or username"), { target: { value: "ada@example.com" } });
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
    expect(signIn).toHaveBeenCalledWith("  ada@example.com ", "hunter22");
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
    await act(async () => finish({ outcome: "rejected" }));
    await waitFor(() => expect(primary()).toBeEnabled());
    expect(primary().textContent).toBe("Sign in");
  });
});

describe("the refusals", () => {
  it.each(["rejected", "unknown-username"])(
    "says Wrong email or password for %s, under the password, announced politely",
    async (outcome) => {
      signIn.mockResolvedValue({ outcome });
      open();
      fill();
      submit();

      const message = await screen.findByText("Wrong email or password");
      expect(message.getAttribute("aria-live")).toBe("polite");
      expect(screen.getByPlaceholderText("Enter your password").getAttribute("aria-invalid")).toBe("true");
      expect(primary()).toBeEnabled();
    },
  );

  it("says to verify the email when it has not been confirmed", async () => {
    signIn.mockResolvedValue({ outcome: "email-not-confirmed" });
    open();
    fill();
    submit();
    expect(await screen.findByText("Please verify your email before signing in — check your inbox.")).toBeTruthy();
  });

  it("says something went wrong when the request throws, and lets the reader try again", async () => {
    signIn.mockRejectedValue(new Error("network down"));
    open();
    fill();
    submit();
    expect(await screen.findByText("Something went wrong. Please try again.")).toBeTruthy();
    expect(primary()).toBeEnabled();
  });

  it("clears the message on the next key in either field", async () => {
    signIn.mockResolvedValue({ outcome: "rejected" });
    open();
    fill();
    submit();
    await screen.findByText("Wrong email or password");

    fireEvent.change(screen.getByPlaceholderText("Enter your password"), { target: { value: "hunter23" } });
    expect(screen.queryByText("Wrong email or password")).toBeNull();

    submit();
    await screen.findByText("Wrong email or password");
    fireEvent.change(screen.getByPlaceholderText("Email or username"), { target: { value: "grace@example.com" } });
    expect(screen.queryByText("Wrong email or password")).toBeNull();
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

    await waitFor(() => expect(startOAuthSignIn).toHaveBeenCalledWith("github"));
    // G12: the one that was clicked now says it is opening.
    for (const name of ["Continue with Google", "Opening GitHub", "Continue with X"]) {
      await waitFor(() => expect(screen.getByRole("button", { name })).toBeDisabled());
    }
  });

  it("names each provider to the function that starts it", async () => {
    startOAuthSignIn.mockResolvedValue(null);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    await waitFor(() => expect(startOAuthSignIn).toHaveBeenLastCalledWith("google"));
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
