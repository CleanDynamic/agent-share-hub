// D3: the admin sign-in page uses the same email-only sign-in and the same invisible widget hook.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signIn = vi.fn();
const captcha = vi.hoisted(() => ({ token: vi.fn(), reset: vi.fn() }));
vi.mock("@/lib/auth/turnstile", () => ({ useTurnstile: () => captcha }));
vi.mock("@/lib/auth/signInWithEmail", () => ({ signInWithEmail: (...args: unknown[]) => signIn(...args) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {} } }));

import AdminLogin from "./AdminLogin";

function open() {
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/admin/login"]}>
        <Routes>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<p>admin home</p>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

const fill = (email: string) => {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "hunter22" } });
  fireEvent.submit(screen.getByRole("button", { name: "Sign In" }).closest("form")!);
};

beforeEach(() => {
  signIn.mockReset();
  captcha.token.mockReset().mockResolvedValue({ token: "tok-1", failed: false });
  captcha.reset.mockReset();
});

describe("AdminLogin (D3)", () => {
  it("signs in by email with the widget's token, resets the widget, and goes to /admin", async () => {
    signIn.mockResolvedValue({ outcome: "signed-in", userId: "u-1" });
    open();
    fill("admin@example.com");
    await waitFor(() => expect(screen.getByText("admin home")).toBeTruthy());
    expect(signIn).toHaveBeenCalledWith("admin@example.com", "hunter22", "tok-1");
    expect(captcha.reset).toHaveBeenCalledTimes(1);
  });

  it("answers text with no @ before any request", async () => {
    open();
    fill("admin");
    expect(await screen.findByText("Sign in with your email address.")).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("says the check failed, sends nothing and resets, when the widget has no token", async () => {
    captcha.token.mockResolvedValue({ token: undefined, failed: true });
    open();
    fill("admin@example.com");
    expect(await screen.findByText("Couldn't verify this request. Try again.")).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
    expect(captcha.reset).toHaveBeenCalledTimes(1);
  });

  it("keeps its one refusal for any other refusal, and resets the widget", async () => {
    signIn.mockResolvedValue({ outcome: "refused", refusal: "credentials" });
    open();
    fill("admin@example.com");
    expect(await screen.findByText("Invalid email or password. Please try again.")).toBeTruthy();
    expect(captcha.reset).toHaveBeenCalledTimes(1);
  });

  it("surfaces a refused token as the check's sentence", async () => {
    signIn.mockResolvedValue({ outcome: "refused", refusal: "captcha" });
    open();
    fill("admin@example.com");
    expect(await screen.findByText("Couldn't verify this request. Try again.")).toBeTruthy();
  });
});
