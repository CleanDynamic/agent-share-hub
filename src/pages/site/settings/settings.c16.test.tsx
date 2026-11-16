// G16: Settings, Account lists the member's sessions (device, browser, last active, this device marked), each with
// Sign out, and Sign out everywhere; the Devices text says in plain words that a signed-out device can keep working
// for up to an hour.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ signOut: vi.fn() }));
const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth, functions: { invoke }, rpc: vi.fn(), from: vi.fn() } }));
vi.mock("@/lib/errors/report", () => ({ reportError: vi.fn() }));
vi.mock("@/lib/auth/turnstile", () => ({ oneShotCaptchaToken: async () => ({ token: "tok-1", failed: false }) }));

import { COPY, describeDevice, lastActiveLabel, listMySessions, signOutDevice, type DeviceSession } from "@/lib/settings/account";

import { AccountView, type AccountViewProps } from "./AccountView";

const here: DeviceSession = {
  id: "11111111-1111-4111-8111-111111111111",
  createdAt: "2026-11-15T10:00:00Z",
  lastActive: "2026-11-16T08:00:00Z",
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  current: true,
};
const phone: DeviceSession = {
  id: "22222222-2222-4222-8222-222222222222",
  createdAt: "2026-11-10T10:00:00Z",
  lastActive: "2026-11-16T09:00:00Z",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  current: false,
};

function props(over: Partial<AccountViewProps> = {}): AccountViewProps {
  return {
    email: "ada@example.com",
    methods: [{ id: "i1", provider: "email", label: "Email and password", email: "ada@example.com" }],
    onChangeEmail: vi.fn(async () => undefined),
    onChangePassword: vi.fn(async () => undefined),
    onLink: vi.fn(async () => undefined),
    onUnlink: vi.fn(async () => undefined),
    onSignOutEverywhere: vi.fn(async () => undefined),
    sessions: [phone, here],
    onSignOutDevice: vi.fn(async () => undefined),
    ...over,
  };
}

const devices = () => screen.getByRole("region", { name: "Devices" });
const view = (p: AccountViewProps) => render(<MemoryRouter><AccountView {...p} /></MemoryRouter>);

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("describeDevice", () => {
  it.each([
    [here.userAgent, "Chrome on macOS"],
    [phone.userAgent, "Safari on iPhone"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0", "Edge on Windows"],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0", "Firefox on Linux"],
    ["Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36", "Chrome on Android"],
    [null, "Unknown device"],
    ["curl/8.0", "Unknown device"],
  ])("%s is %s", (ua, label) => {
    expect(describeDevice(ua)).toBe(label);
  });

  it("says when the last activity is not known", () => {
    expect(lastActiveLabel(null)).toBe("Last active: not known");
    expect(lastActiveLabel("2026-11-16T09:05:00Z")).toMatch(/^Last active 16 Nov, \d\d:\d\d$/);
  });
});

describe("the calls", () => {
  it("lists through my-sessions, asking only for a list (the function reads who from the token)", async () => {
    invoke.mockResolvedValueOnce({ data: { sessions: [phone, here] }, error: null });
    expect(await listMySessions()).toEqual([phone, here]);
    expect(invoke).toHaveBeenCalledWith("my-sessions", { method: "POST", body: { action: "list" } });
  });

  it("signs another device out through my-sessions, by its session id", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    await signOutDevice(phone);
    expect(invoke).toHaveBeenCalledWith("my-sessions", { method: "POST", body: { action: "revoke", sessionId: phone.id } });
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it("signs this device out in the browser, and no other", async () => {
    auth.signOut.mockResolvedValueOnce({ error: null });
    await signOutDevice(here);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("passes on the function's own sentence when it refuses", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { context: { status: 404, json: async () => ({ error: "That device is already signed out." }) } } });
    await expect(signOutDevice(phone)).rejects.toThrow("That device is already signed out.");
  });
});

describe("the Devices group", () => {
  it("lists each session with its device and browser, when it was last active, and marks this device", () => {
    view(props());
    const group = devices();
    expect(within(group).getByText("Safari on iPhone")).toBeTruthy();
    expect(within(group).getByText("Chrome on macOS")).toBeTruthy();
    expect(within(group).getAllByText(/^Last active \d+ Nov, \d\d:\d\d$/)).toHaveLength(2);
    expect(within(group).getAllByText(COPY.thisDevice)).toHaveLength(1);
  });

  it("says in plain words that a signed-out device can keep working for up to an hour", () => {
    view(props());
    expect(within(devices()).getByText(COPY.devicesHour)).toBeTruthy();
  });

  it("gives every session its own Sign out, which asks once and then signs out that one", async () => {
    const onSignOutDevice = vi.fn(async () => undefined);
    view(props({ onSignOutDevice }));
    fireEvent.click(within(devices()).getByRole("button", { name: "Sign out Safari on iPhone" }));
    expect(screen.getByText(COPY.signOutDevice("Safari on iPhone"))).toBeTruthy();
    fireEvent.click(within(screen.getByRole("group", { name: "Confirm" })).getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(onSignOutDevice).toHaveBeenCalledWith(phone));
  });

  it("says what signing out this device means", () => {
    view(props());
    fireEvent.click(within(devices()).getByRole("button", { name: "Sign out Chrome on macOS" }));
    expect(screen.getByText(COPY.signOutThisDevice)).toBeTruthy();
  });

  it("keeps Sign out everywhere", () => {
    view(props());
    expect(within(devices()).getByRole("button", { name: "Sign out everywhere" })).toBeTruthy();
  });

  it("says so in one line when the list could not be loaded, and still offers Sign out everywhere", () => {
    view(props({ sessions: null }));
    expect(within(devices()).getByText(COPY.devicesUnavailable)).toBeTruthy();
    expect(within(devices()).getByRole("button", { name: "Sign out everywhere" })).toBeTruthy();
  });
});
