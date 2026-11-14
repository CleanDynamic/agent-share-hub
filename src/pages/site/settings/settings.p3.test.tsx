// UX-15 P3: Account. Each form's four states, the last-sign-in-method rule, the global sign-out and its confirmation, and the calls.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUserIdentities: vi.fn(),
  updateUser: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  linkIdentity: vi.fn(),
  unlinkIdentity: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth, rpc: vi.fn(), from: vi.fn() } }));
vi.mock("@/lib/errors/report", () => ({ reportError: vi.fn() }));
// The bot check's one-shot widget, faked: the current-password check carries its token.
vi.mock("@/lib/auth/turnstile", () => ({ oneShotCaptchaToken: async () => ({ token: "tok-1", failed: false }) }));

import {
  COPY,
  canUnlink,
  changeEmail,
  changePassword,
  emailProblem,
  friendlyAuthError,
  linkableFor,
  methodsOf,
  passwordProblem,
  signOutEverywhere,
  unlinkMethod,
  type SignInMethod,
} from "@/lib/settings/account";
import { SettingsError } from "@/lib/settings/useAction";

import { AccountView, type AccountViewProps } from "./AccountView";
import { AccountSection } from "./containers";

const email: SignInMethod = { id: "i1", provider: "email", label: "Email and password", email: "ada@example.com" };
const google: SignInMethod = { id: "i2", provider: "google", label: "Google", email: "ada@gmail.com" };

function props(over: Partial<AccountViewProps> = {}): AccountViewProps {
  return {
    email: "ada@example.com",
    methods: [email, google],
    onChangeEmail: vi.fn(async () => undefined),
    onChangePassword: vi.fn(async () => undefined),
    onLink: vi.fn(async () => undefined),
    onUnlink: vi.fn(async () => undefined),
    onSignOutEverywhere: vi.fn(async () => undefined),
    ...over,
  };
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("the pure rules", () => {
  it("lists email and password first, then providers", () => {
    const methods = methodsOf([
      { id: "g", provider: "google", identity_data: { email: "g@x.com" } },
      { id: "e", provider: "email", identity_data: { email: "e@x.com" } },
    ]);
    expect(methods.map((m) => [m.provider, m.label, m.email])).toEqual([
      ["email", "Email and password", "e@x.com"],
      ["google", "Google", "g@x.com"],
    ]);
  });

  it("lets a method go only while another way to sign in is left", () => {
    expect(canUnlink([email])).toBe(false);
    expect(canUnlink([email, google])).toBe(true);
  });

  it("offers the providers the account does not have", () => {
    expect(linkableFor([email, google]).map((p) => p.label)).toEqual(["GitHub", "X"]);
  });

  it("says a rate limit in words, and nothing for an error it does not know", () => {
    expect(friendlyAuthError({ status: 429 })).toMatch(/Too many requests/);
    expect(friendlyAuthError({ code: "over_email_send_rate_limit" })).toMatch(/Too many requests/);
    expect(friendlyAuthError({ code: "something_new" })).toBeNull();
  });

  it("checks an address and a password with the rules sign-up uses", () => {
    expect(emailProblem("", null)).toMatch(/Enter/);
    expect(emailProblem("nope", null)).toMatch(/doesn't look right/);
    expect(emailProblem("ADA@example.com", "ada@example.com")).toMatch(/already/);
    expect(emailProblem("new@example.com", "ada@example.com")).toBeNull();
    expect(passwordProblem("short", null)).toBe("Password must be at least 8 characters.");
    expect(passwordProblem("longenough", "longenough")).toMatch(/haven't used/);
    expect(passwordProblem("longenough1", "longenough")).toBeNull();
  });
});

describe("the email form", () => {
  it("goes idle, sending, sent: the sentence names both inboxes", async () => {
    let finish!: () => void;
    const onChangeEmail = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<AccountView {...props({ onChangeEmail })} />);
    expect(screen.queryByLabelText("New email address")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Change email" }));
    fireEvent.change(screen.getByLabelText("New email address"), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("button", { name: "Sending" })).toBeDisabled();
    expect(onChangeEmail).toHaveBeenCalledWith("new@example.com");
    finish();
    expect(await screen.findByText(COPY.emailSent)).toBeTruthy();
    expect(COPY.emailSent).toBe("Check both inboxes. The change finishes when you confirm from the new address.");
  });

  it("shows a refusal in the form's error style, and keeps the field", async () => {
    const onChangeEmail = vi.fn(async () => { throw new SettingsError("Too many requests. Wait a few minutes and try again."); });
    render(<AccountView {...props({ onChangeEmail })} />);
    fireEvent.click(screen.getByRole("button", { name: "Change email" }));
    fireEvent.change(screen.getByLabelText("New email address"), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const message = await screen.findByText("Too many requests. Wait a few minutes and try again.");
    expect(message.getAttribute("data-testid")).toBe("field-message");
    expect((screen.getByLabelText("New email address") as HTMLInputElement).value).toBe("new@example.com");
  });
});

describe("the password form", () => {
  it("asks for the current password and a new one, and says what happens to other devices", async () => {
    const onChangePassword = vi.fn(async () => undefined);
    render(<AccountView {...props({ onChangePassword })} />);
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "old-password" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-password-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Password changed. Other devices stay signed in until you sign out everywhere.")).toBeTruthy();
    expect(onChangePassword).toHaveBeenCalledWith({ current: "old-password", next: "new-password-1" });
  });

  it("reads Set a password, with no current-password field, for someone who signs in through a provider", async () => {
    const onChangePassword = vi.fn(async () => undefined);
    render(<AccountView {...props({ methods: [google], onChangePassword })} />);
    expect(screen.queryByRole("button", { name: "Change password" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Set a password" }));
    expect(screen.queryByLabelText("Current password")).toBeNull();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-password-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onChangePassword).toHaveBeenCalledWith({ current: null, next: "new-password-1" }));
  });

  it("shows an error without losing what was typed", async () => {
    const onChangePassword = vi.fn(async () => { throw new SettingsError("That isn't your current password."); });
    render(<AccountView {...props({ onChangePassword })} />);
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "wrong" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-password-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("That isn't your current password.")).toBeTruthy();
    expect((screen.getByLabelText("New password") as HTMLInputElement).value).toBe("new-password-1");
  });
});

describe("sign-in methods", () => {
  it("disables Unlink on the only method, and says why", () => {
    render(<AccountView {...props({ methods: [email] })} />);
    const unlink = screen.getByRole("button", { name: "Unlink Email and password" });
    expect(unlink).toBeDisabled();
    expect(screen.getByText(/This is the only way you can sign in/)).toBeTruthy();
  });

  it("unlinks one of two, and offers Link for the rest", async () => {
    const onUnlink = vi.fn(async () => undefined);
    const onLink = vi.fn(async () => undefined);
    render(<AccountView {...props({ onUnlink, onLink })} />);
    fireEvent.click(screen.getByRole("button", { name: "Unlink Google" }));
    await waitFor(() => expect(onUnlink).toHaveBeenCalledWith("i2"));
    fireEvent.click(screen.getByRole("button", { name: "Link GitHub" }));
    await waitFor(() => expect(onLink).toHaveBeenCalledWith("github"));
    expect(screen.queryByRole("button", { name: "Link Google" })).toBeNull();
  });

  it("says linking is off when Supabase refuses", async () => {
    const onLink = vi.fn(async () => { throw new SettingsError(COPY.linkingOff); });
    render(<AccountView {...props({ onLink })} />);
    fireEvent.click(screen.getByRole("button", { name: "Link GitHub" }));
    expect(await screen.findByText(COPY.linkingOff)).toBeTruthy();
  });
});

describe("Sign out everywhere", () => {
  it("asks once, and does nothing until confirmed", async () => {
    const onSignOutEverywhere = vi.fn(async () => undefined);
    render(<AccountView {...props({ onSignOutEverywhere })} />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out everywhere" }));
    const ask = screen.getByRole("group", { name: "Confirm" });
    expect(within(ask).getByText("Sign out on every device, including this one?")).toBeTruthy();
    expect(onSignOutEverywhere).not.toHaveBeenCalled();
    fireEvent.click(within(ask).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("group", { name: "Confirm" })).toBeNull();
    expect(onSignOutEverywhere).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sign out everywhere" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Confirm" })).getByRole("button", { name: "Sign out everywhere" }));
    await waitFor(() => expect(onSignOutEverywhere).toHaveBeenCalledTimes(1));
  });
});

describe("the calls", () => {
  it("signs out with scope global", async () => {
    auth.signOut.mockResolvedValue({ error: null });
    await signOutEverywhere();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it("checks the current password before it sets the new one, and sets nothing when the check fails", async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ error: { message: "Invalid login credentials", status: 400, code: "invalid_credentials" } });
    await expect(changePassword({ email: "ada@example.com", current: "bad", next: "new-password-1", hasPassword: true })).rejects.toThrow("That isn't your current password.");
    expect(auth.updateUser).not.toHaveBeenCalled();
    auth.signInWithPassword.mockResolvedValueOnce({ error: null });
    auth.updateUser.mockResolvedValueOnce({ error: null });
    await changePassword({ email: "ada@example.com", current: "good-one", next: "new-password-1", hasPassword: true });
    expect(auth.signInWithPassword).toHaveBeenLastCalledWith({ email: "ada@example.com", password: "good-one", options: { captchaToken: "tok-1" } });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "new-password-1" });
  });

  it("sets a first password without a current one", async () => {
    auth.updateUser.mockResolvedValueOnce({ error: null });
    await changePassword({ email: "ada@example.com", current: null, next: "new-password-1", hasPassword: false });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "new-password-1" });
  });

  it("asks Supabase to change the email and turns a rate limit into words", async () => {
    auth.updateUser.mockResolvedValueOnce({ error: { status: 429, code: "over_email_send_rate_limit", message: "x" } });
    await expect(changeEmail("new@example.com", "ada@example.com")).rejects.toThrow(/Too many requests/);
    auth.updateUser.mockResolvedValueOnce({ error: null });
    await changeEmail("new@example.com", "ada@example.com");
    expect(auth.updateUser).toHaveBeenLastCalledWith({ email: "new@example.com" }, expect.objectContaining({ emailRedirectTo: expect.stringContaining("/settings/account") }));
  });

  it("refuses to unlink the last identity before asking Supabase", async () => {
    auth.getUserIdentities.mockResolvedValueOnce({ data: { identities: [{ id: "i1", provider: "email" }] }, error: null });
    await expect(unlinkMethod("i1")).rejects.toThrow(COPY.onlyMethod);
    expect(auth.unlinkIdentity).not.toHaveBeenCalled();
  });
});

describe("the container", () => {
  it("signs out everywhere and lands on /login", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { email: "ada@example.com" } }, error: null });
    auth.getUserIdentities.mockResolvedValue({ data: { identities: [{ id: "i1", provider: "email", identity_data: { email: "ada@example.com" } }] }, error: null });
    auth.signOut.mockResolvedValue({ error: null });
    function Where() {
      return <span data-testid="where">{useLocation().pathname}</span>;
    }
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/settings/account"]}>
          <Routes>
            <Route path="/settings/account" element={<AccountSection />} />
            <Route path="/login" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Sign out everywhere" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Confirm" })).getByRole("button", { name: "Sign out everywhere" }));
    expect((await screen.findByTestId("where")).textContent).toBe("/login");
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "global" });
  });
});
