// UI-P36 — `/signup` in the entrance's frame: every handler, validation and rule
// of pages/Signup.tsx, held to what it did — the username as it is typed and as
// it is checked, the email when it is left, the strength after a pause, the gate
// on the button, and the three ways a sign-up can end.
//
// The auth functions are stubbed and their calls counted, as the other pages'
// container tests do.

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ isLoggedIn: false }));
const signUp = vi.fn();
const checkUsernameAvailability = vi.fn();
const startOAuthSignIn = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoggedIn: auth.isLoggedIn, user: null, session: null, loading: false }),
}));
vi.mock("@/lib/auth/signUpWithEmail", () => ({ signUpWithEmail: (...args: unknown[]) => signUp(...args) }));
vi.mock("@/lib/auth/checkUsernameAvailability", () => ({
  checkUsernameAvailability: (...args: unknown[]) => checkUsernameAvailability(...args),
}));
vi.mock("@/lib/auth/oauth", () => ({ startOAuthSignIn: (...args: unknown[]) => startOAuthSignIn(...args) }));
vi.mock("@/lib/build/signals", () => ({ countReproducedToday: vi.fn().mockResolvedValue(48) }));
vi.mock("@/lib/build/gallery", () => ({ getGalleryStats: vi.fn().mockResolvedValue({ inGallery: 1284 }) }));

import { renderAt, setViewport } from "./signinTest";
import { SignupPage } from "./SignupPage";

beforeEach(() => {
  setViewport("desktop");
  auth.isLoggedIn = false;
  signUp.mockReset();
  checkUsernameAvailability.mockReset();
  checkUsernameAvailability.mockResolvedValue({ available: true });
  startOAuthSignIn.mockReset();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

const open = (url = "/signup") => renderAt(<SignupPage />, url, "/signup");

const type = (placeholder: string, value: string) => fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });

/** The whole form, filled the way the join spec fills it, with the terms ticked. */
async function fillAll(over: Partial<Record<"name" | "username" | "email" | "password", string>> = {}) {
  type("Your name", over.name ?? "Ada Lovelace");
  type("username", over.username ?? "ada_l");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
  type("you@example.com", over.email ?? "ada@example.com");
  type("At least 8 characters", over.password ?? "Abcdefghij1!x");
  fireEvent.click(document.querySelector('label[for="terms"] > div')!.lastElementChild!);
}

const create = () => screen.getByRole("button", { name: /^Create account$/ });

describe("the page", () => {
  it("is the join card: the title, no index, the switch on Join free", async () => {
    open();
    await waitFor(() => expect(document.title).toBe("Join buildgallery"));
    expect(screen.getByRole("link", { name: "Join free" }).getAttribute("aria-current")).toBe("page");
    expect(create()).toBeDisabled();
  });

  it("carries ?redirect= back to Sign in", () => {
    open("/signup?redirect=%2Fgallery");
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login?redirect=%2Fgallery");
  });

  it("is sent Home when the visitor is already signed in", async () => {
    auth.isLoggedIn = true;
    const where = open();
    await waitFor(() => expect(where.at()).toBe("/"));
  });
});

describe("the username", () => {
  beforeEach(() => vi.useFakeTimers());

  it("is lower-cased as it is typed", () => {
    open();
    type("username", "Ada_L");
    expect((screen.getByPlaceholderText("username") as HTMLInputElement).value).toBe("ada_l");
  });

  it("is told it is too short at once, with no check", () => {
    open();
    type("username", "ad");
    expect(screen.getByText("Username must be at least 3 characters")).toBeTruthy();
    expect(screen.getByPlaceholderText("username").getAttribute("aria-invalid")).toBe("true");
    expect(checkUsernameAvailability).not.toHaveBeenCalled();
  });

  it("is told what it may contain at once, with no check", () => {
    open();
    type("username", "ada-l!");
    expect(screen.getByText("Use lowercase letters, numbers and underscores only")).toBeTruthy();
    expect(checkUsernameAvailability).not.toHaveBeenCalled();
  });

  it("clears its message when it is emptied", () => {
    open();
    type("username", "ad");
    type("username", "");
    expect(screen.queryByText("Username must be at least 3 characters")).toBeNull();
  });

  it("is checked 400ms after the last key, and says it is available", async () => {
    open();
    type("username", "ada_l");
    expect(checkUsernameAvailability).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(399);
    });
    expect(checkUsernameAvailability).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(checkUsernameAvailability).toHaveBeenCalledWith("ada_l");
    expect(screen.getByText("Username available")).toBeTruthy();
    expect(screen.getByPlaceholderText("username").getAttribute("aria-invalid")).toBe("false");
  });

  it("offers a free one when it is taken, and says plainly when there is none to offer", async () => {
    checkUsernameAvailability.mockResolvedValueOnce({ available: false, suggestion: "ada_l417" });
    open();
    type("username", "ada_l");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(screen.getByText('Taken — try "ada_l417"')).toBeTruthy();

    checkUsernameAvailability.mockResolvedValueOnce({ available: false });
    type("username", "ada_la");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(screen.getByText("That username is taken")).toBeTruthy();
  });

  it("shows the address it will have", () => {
    open();
    type("username", "ada_l");
    expect(screen.getByText("buildgallery.ai/profile/ada_l")).toBeTruthy();
  });

  it("lets a newer key supersede an older check that comes back late", async () => {
    let answerFirst: (value: unknown) => void = () => {};
    checkUsernameAvailability
      .mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve)))
      .mockResolvedValueOnce({ available: true });
    open();

    type("username", "ada");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    type("username", "adal");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(screen.getByText("Username available")).toBeTruthy();

    // The first check, for "ada", answers now, and is no longer the one that counts.
    await act(async () => answerFirst({ available: false }));
    expect(screen.getByText("Username available")).toBeTruthy();
    expect(screen.queryByText("That username is taken")).toBeNull();
  });
});

describe("the email", () => {
  it("is checked when it is left, and the check clears when it is changed", () => {
    open();
    type("you@example.com", "not-an-email");
    expect(screen.queryByText("Please enter a valid email")).toBeNull();
    fireEvent.blur(screen.getByPlaceholderText("you@example.com"));
    expect(screen.getByText("Please enter a valid email")).toBeTruthy();
    expect(screen.getByPlaceholderText("you@example.com").getAttribute("aria-invalid")).toBe("true");

    type("you@example.com", "ada@example.com");
    expect(screen.queryByText("Please enter a valid email")).toBeNull();
    fireEvent.blur(screen.getByPlaceholderText("you@example.com"));
    expect(screen.queryByText("Please enter a valid email")).toBeNull();
    expect(screen.getByPlaceholderText("you@example.com").getAttribute("aria-invalid")).toBe("false");
  });

  it("is not checked when it is left empty", () => {
    open();
    fireEvent.blur(screen.getByPlaceholderText("you@example.com"));
    expect(screen.queryByText("Please enter a valid email")).toBeNull();
  });
});

describe("the password", () => {
  it("shows its strength 200ms after the last key", async () => {
    vi.useFakeTimers();
    open();
    type("At least 8 characters", "abcdefgh1");
    expect(screen.getByRole("img", { name: "Password strength: Weak" })).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(screen.getByRole("img", { name: "Password strength: Fair" })).toBeTruthy();
    type("At least 8 characters", "Abcdefghij1!x");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(screen.getByRole("img", { name: "Password strength: Strong" })).toBeTruthy();
  });
});

describe("the gate", () => {
  beforeEach(() => vi.useFakeTimers());

  it("holds until every field and the terms box are done, as the join spec finds it", async () => {
    open();
    type("Your name", "Ada Lovelace");
    type("username", "ada_l");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    type("you@example.com", "ada@example.com");
    type("At least 8 characters", "Abcdefghij1!x");
    expect(create()).toBeDisabled();

    fireEvent.click(document.querySelector('label[for="terms"] > div')!.lastElementChild!);
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(create()).toBeEnabled();
  });

  it("closes again for a short password, a taken username or a bad email", async () => {
    open();
    await fillAll();
    expect(create()).toBeEnabled();

    type("At least 8 characters", "short");
    expect(create()).toBeDisabled();
    type("At least 8 characters", "Abcdefghij1!x");
    expect(create()).toBeEnabled();

    checkUsernameAvailability.mockResolvedValueOnce({ available: false });
    type("username", "ada_la");
    // Still being checked: closed.
    expect(create()).toBeDisabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    // Taken: closed.
    expect(create()).toBeDisabled();
    type("username", "ada_lb");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(create()).toBeEnabled();

    type("you@example.com", "nope");
    fireEvent.blur(screen.getByPlaceholderText("you@example.com"));
    expect(create()).toBeDisabled();
  });
});

describe("creating the account", () => {
  beforeEach(() => vi.useFakeTimers());

  it("sends the trimmed address and name and the lower-cased username, with the verification page as the link's landing", async () => {
    signUp.mockResolvedValue({ outcome: "created", signedIn: false });
    open();
    await fillAll({ name: "  Ada Lovelace ", email: " ada@example.com " });
    fireEvent.click(create());
    await act(async () => {});

    expect(signUp).toHaveBeenCalledTimes(1);
    expect(signUp).toHaveBeenCalledWith({
      email: "ada@example.com",
      password: "Abcdefghij1!x",
      displayName: "Ada Lovelace",
      username: "ada_l",
      emailRedirectTo: `${window.location.origin}/verify-email`,
    });
  });

  it("goes to the pending page with the address, remembered, when the project wants the email verified", async () => {
    signUp.mockResolvedValue({ outcome: "created", signedIn: false });
    const where = open();
    await fillAll();
    fireEvent.click(create());
    await act(async () => {});

    expect(where.at()).toBe("/verify-email");
    expect(where.state()).toEqual({ email: "ada@example.com" });
    expect(window.sessionStorage.getItem("pending_verification_email")).toBe("ada@example.com");
  });

  it("goes straight to onboarding when the project returned a session", async () => {
    signUp.mockResolvedValue({ outcome: "created", signedIn: true });
    const where = open();
    await fillAll();
    fireEvent.click(create());
    await act(async () => {});

    expect(where.at()).toBe("/onboarding");
    expect(window.sessionStorage.getItem("pending_verification_email")).toBeNull();
  });

  it("says plainly that an address is taken, under the email and under the form", async () => {
    signUp.mockResolvedValue({ outcome: "already-registered", message: "User already registered" });
    open();
    await fillAll();
    fireEvent.click(create());
    await act(async () => {});

    expect(screen.getByText("An account with this email already exists")).toBeTruthy();
    expect(screen.getByText("That email is already registered — try signing in instead.")).toBeTruthy();
    expect(screen.getByPlaceholderText("you@example.com").getAttribute("aria-invalid")).toBe("true");
    // Closed again, until the email is changed.
    expect(create()).toBeDisabled();
  });

  it("passes any other refusal on in the client's own words", async () => {
    signUp.mockResolvedValue({ outcome: "refused", message: "Email rate limit exceeded" });
    open();
    await fillAll();
    fireEvent.click(create());
    await act(async () => {});

    const message = screen.getByText("Email rate limit exceeded");
    expect(message.getAttribute("aria-live")).toBe("polite");
    expect(create()).toBeEnabled();
  });

  it("says something went wrong when the request throws, and lets the reader try again", async () => {
    signUp.mockRejectedValue(new Error("network down"));
    open();
    await fillAll();
    fireEvent.click(create());
    await act(async () => {});

    expect(screen.getByText("Something went wrong. Please try again.")).toBeTruthy();
    expect(create()).toBeEnabled();
  });

  it("says it is creating the account while the request is out", async () => {
    signUp.mockReturnValue(new Promise(() => {}));
    open();
    await fillAll();
    fireEvent.click(create());
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Creating account..." })).toBeDisabled();
  });

  it("refuses an email with no domain before it asks anyone, under the email", async () => {
    open();
    await fillAll({ email: "ada@example" });
    fireEvent.click(create());
    await act(async () => {});

    expect(signUp).not.toHaveBeenCalled();
    expect(screen.getByText("Please enter a valid email")).toBeTruthy();
  });

  it("clears the form's message on the next key", async () => {
    signUp.mockResolvedValue({ outcome: "refused", message: "Email rate limit exceeded" });
    open();
    await fillAll();
    fireEvent.click(create());
    await act(async () => {});
    expect(screen.getByText("Email rate limit exceeded")).toBeTruthy();

    type("Your name", "Ada L");
    expect(screen.queryByText("Email rate limit exceeded")).toBeNull();
  });
});

describe("the providers", () => {
  it("start the one that was clicked, and give the buttons back when it could not start", async () => {
    startOAuthSignIn.mockResolvedValueOnce("Couldn't connect to google. Please try again.");
    open();
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(await screen.findByText("Couldn't connect to google. Please try again.")).toBeTruthy();
    expect(startOAuthSignIn).toHaveBeenCalledWith("google");
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled());
  });
});
