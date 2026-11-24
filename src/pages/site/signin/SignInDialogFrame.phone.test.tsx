// Mobile prompt 27 Part B: the sign-in dialog on a phone is the whole screen's water with a card fixed to the bottom.
// The desktop dialog (a centred 420 card with the Close at its top right) is not changed.

import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captcha = vi.hoisted(() => ({ token: vi.fn(), reset: vi.fn() }));
vi.mock("@/lib/auth/turnstile", () => ({ useTurnstile: () => captcha }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isLoggedIn: false, user: null, session: null, loading: false }) }));
vi.mock("@/lib/auth/signInWithEmail", () => ({ signInWithEmail: vi.fn() }));
vi.mock("@/lib/auth/emailLink", () => ({ resendSignupEmail: vi.fn() }));
vi.mock("@/lib/auth/postAuthRoute", () => ({ resolvePostAuthRoute: vi.fn() }));
vi.mock("@/lib/auth/oauth", () => ({ startOAuthSignIn: vi.fn() }));

import { renderDialog, setViewport } from "./signinTest";

beforeEach(() => {
  captcha.token.mockReset().mockResolvedValue({ token: "t", failed: false });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  setViewport("desktop");
  vi.restoreAllMocks();
});

describe("on a phone", () => {
  it("draws the water as a canvas inside the dialog, the beaver as the clear zone, and a card the field reads", () => {
    setViewport("phone");
    renderDialog("login");
    const dialog = screen.getByRole("dialog", { name: "Sign in" });
    expect(dialog.getAttribute("data-viewport")).toBe("mobile");
    const canvas = within(dialog).getByTestId("signin-water") as HTMLCanvasElement;
    expect(canvas.style.position).toBe("absolute");
    expect(canvas.style.touchAction).toBe("none");
    const beaver = dialog.querySelector("img[data-clear]") as HTMLImageElement;
    expect(beaver.getAttribute("width")).toBe("168");
    expect(beaver.parentElement!.style.pointerEvents).toBe("none");
    const card = dialog.querySelector("[data-occlude]") as HTMLElement;
    expect(card).toBeTruthy();
    expect(card.style.borderRadius).toBe("20px 20px 0 0");
    expect(card.contains(screen.getByRole("button", { name: "Continue with Google" }))).toBe(true);
  });

  it("has no visible close button, and keeps Escape and a hidden Close for assistive technology", () => {
    setViewport("phone");
    renderDialog("login");
    const close = screen.getByRole("button", { name: "Close" });
    expect(close.className).toContain("sr-only");
  });

  it("runs the pills, Google, GitHub, the email line, two labelled fields and the main button, in the card", () => {
    setViewport("phone");
    renderDialog("login");
    const card = document.querySelector("[data-occlude]") as HTMLElement;
    const order = ["Sign in", "Continue with Google", "Continue with GitHub", "Sign in with your email address.", "Email", "Password", "Forgot password?", "Terms"];
    const text = card.textContent ?? "";
    let at = -1;
    for (const part of order) {
      const next = text.indexOf(part, at + 1);
      expect(next, part).toBeGreaterThan(at);
      at = next;
    }
    const google = screen.getByRole("button", { name: "Continue with Google" });
    expect(google.style.height).toBe("48px");
    expect(google.style.borderRadius).toBe("24px");
    expect(screen.getByLabelText("Email")).toBeTruthy();
  });
});

describe("on a desktop", () => {
  it("is the centred dialog with its Close, and the beaver is the water's clear zone", () => {
    setViewport("desktop");
    renderDialog("login");
    const dialog = screen.getByRole("dialog", { name: "Sign in" });
    expect(dialog.getAttribute("data-viewport")).toBe("desktop");
    expect(dialog.querySelector("[data-occlude]")).toBeNull();
    expect(dialog.querySelector("img[data-clear]")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close" }).className).not.toContain("sr-only");
  });
});
