// Mobile prompt 27 Part B: the sign-in dialog on a phone is the whole screen's water with a card fixed to the bottom.
// The desktop dialog (a centred 420 card with the Close at its top right) is not changed.

import { fireEvent, screen, within } from "@testing-library/react";
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

/* 29f, `13-sign-in-keyboard.jpg`. */
describe("on a phone (29f)", () => {
  it("switches Sign in and Sign up with the tab pattern: 44 tall, one word-wide Text indicator, not pills", () => {
    setViewport("phone");
    renderDialog("login");
    const tabs = screen.getByRole("tablist", { name: "Sign in or join" });
    expect(within(tabs).getAllByRole("tab").map((tab) => [tab.textContent, tab.getAttribute("aria-selected")])).toEqual([["Sign in", "true"], ["Sign up", "false"]]);
    expect((within(tabs).getAllByRole("tab")[0] as HTMLElement).style.height).toBe("44px");
    expect(screen.queryByRole("radiogroup", { name: "Sign in or join" })).toBeNull();
  });

  it("draws fields 48 tall on Card with no edge until focused, then an inset 1.5px Text ring", () => {
    setViewport("phone");
    renderDialog("login");
    const email = screen.getByLabelText("Email") as HTMLInputElement;
    const box = email.closest('[data-testid="auth-field-box"]') as HTMLElement;
    expect(box.style.height).toBe("48px");
    expect(box.style.borderRadius).toBe("12px");
    expect(box.style.boxShadow).toBe("none");
    fireEvent.focus(email);
    expect(box.style.boxShadow).toContain("1.5px");
    expect((email.style.fontSize)).toBe("16px");
  });

  it("shows no error, and no red edge, while typing: only the pressed form's error draws, and changing a field clears it", () => {
    setViewport("phone");
    renderDialog("login");
    const email = screen.getByLabelText("Email") as HTMLInputElement;
    const box = email.closest('[data-testid="auth-field-box"]') as HTMLElement;
    fireEvent.blur(email); // the dialog opens with the first field focused
    fireEvent.change(email, { target: { value: "not an address" } });
    expect(box.style.boxShadow).toBe("none");
    expect(screen.queryByText("Sign in with your email address.", { selector: '[data-testid="field-message"]' })).toBeNull();
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    const edge = () => (password.closest('[data-testid="auth-field-box"]') as HTMLElement).style.boxShadow;
    expect(edge()).toContain("danger");
    fireEvent.change(password, { target: { value: "secrets" } });
    expect(edge()).not.toContain("danger");
  });

  it("moves the beaver up and fades it out while a field is focused, and brings it back on blur", () => {
    setViewport("phone");
    renderDialog("login");
    const zone = screen.getByTestId("signin-beaver");
    const mover = zone.firstElementChild as HTMLElement;
    expect(mover.style.opacity).toBe("1");
    const email = screen.getByLabelText("Email");
    fireEvent.focus(email);
    expect(zone.hasAttribute("data-away")).toBe(true);
    expect(mover.style.opacity).toBe("0");
    expect(mover.style.transform).toBe("translateY(-200px)");
    expect(mover.style.transition).toContain("280ms");
    fireEvent.blur(email);
    expect(zone.hasAttribute("data-away")).toBe(false);
    expect(mover.style.opacity).toBe("1");
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
