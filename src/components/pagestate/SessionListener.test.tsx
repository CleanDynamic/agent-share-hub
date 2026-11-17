// G13: a member's refused request is confirmed once with the auth server; a confirmed end clears the local session
// exactly once and opens the sign-in dialog over the same page. A 403, or a request without a member's token, does nothing.
import { act, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));

import { noteAnswer, sessionPhase, setSessionPhase } from "@/lib/query/sessionSignal";
import { SessionListener } from "./SessionListener";

const jwt = (claims: Record<string, unknown>) => `${btoa(JSON.stringify({ alg: "HS256" }))}.${btoa(JSON.stringify(claims)).replace(/=+$/, "")}.sig`;
const MEMBER = jwt({ sub: "u1", role: "authenticated" });
const ANON = jwt({ role: "anon" });
const BASE = "https://project.supabase.co";
const refuse = (token: string, status = 401) => noteAnswer(`${BASE}/rest/v1/builds`, new Headers({ Authorization: `Bearer ${token}` }), status);

let seen: { pathname: string; search: string; hash: string; state: unknown };
function Probe() {
  const location = useLocation();
  seen = location;
  return null;
}

function mount(at = "/library?tab=saved#top") {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[at]}>
        <SessionListener />
        <Probe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

const flush = () => act(async () => { for (let i = 0; i < 5; i += 1) await Promise.resolve(); });

beforeEach(() => {
  setSessionPhase("live");
  auth.getSession.mockResolvedValue({ data: { session: { access_token: MEMBER } }, error: null });
  auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401, code: "bad_jwt" } });
  auth.signOut.mockResolvedValue({ error: null });
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
});
afterEach(() => vi.clearAllMocks());

describe("SessionListener (G13)", () => {
  it("confirms once, clears the local session once, and opens the dialog over the same page", async () => {
    mount();
    refuse(MEMBER);
    refuse(MEMBER);
    await flush();
    refuse(MEMBER);
    await flush();
    expect(auth.getUser).toHaveBeenCalledTimes(1);
    expect(auth.getUser).toHaveBeenCalledWith(MEMBER);
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(sessionPhase()).toBe("ended");
    expect(seen.pathname).toBe("/library");
    expect(new URLSearchParams(seen.search).get("signin")).toBe("login");
    expect(new URLSearchParams(seen.search).get("tab")).toBe("saved");
    expect(seen.hash).toBe("#top");
    expect(seen.state).toMatchObject({ signedOut: true, signinDepth: 1 });
  });

  it("does nothing when the auth server says the session is fine", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mount();
    refuse(MEMBER);
    await flush();
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(sessionPhase()).toBe("live");
    expect(seen.search).toBe("?tab=saved");
  });

  it("does nothing when the check itself cannot be made (the network, not the session)", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 0, name: "AuthRetryableFetchError" } });
    mount();
    refuse(MEMBER);
    await flush();
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(sessionPhase()).toBe("live");
  });

  it("does not confirm a token the client has already replaced", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: jwt({ sub: "u1", role: "authenticated", n: 2 }) } }, error: null });
    mount();
    refuse(MEMBER);
    await flush();
    expect(auth.getUser).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(sessionPhase()).toBe("live");
  });

  it("never starts on a 403 or on a request without a member's token", async () => {
    mount();
    refuse(MEMBER, 403);
    refuse(ANON);
    await flush();
    expect(auth.getSession).not.toHaveBeenCalled();
    expect(auth.getUser).not.toHaveBeenCalled();
    expect(sessionPhase()).toBe("live");
  });

  it("leaves the editor alone: no dialog there (its banner is Part D's)", async () => {
    mount("/compose/abc");
    refuse(MEMBER);
    await flush();
    expect(sessionPhase()).toBe("ended");
    expect(seen.search).toBe("");
  });
});

describe("signing back in (G14)", () => {
  it("puts the phase back to live and reads the page again", async () => {
    const client = mount();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    refuse(MEMBER);
    await flush();
    expect(sessionPhase()).toBe("ended");
    const onChange = auth.onAuthStateChange.mock.calls[0][0] as (event: string, session: unknown) => void;
    act(() => onChange("SIGNED_IN", { access_token: MEMBER }));
    expect(sessionPhase()).toBe("live");
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("an ordinary sign-in while live reads nothing again", async () => {
    const client = mount();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const onChange = auth.onAuthStateChange.mock.calls[0][0] as (event: string, session: unknown) => void;
    act(() => onChange("SIGNED_IN", { access_token: MEMBER }));
    act(() => onChange("TOKEN_REFRESHED", { access_token: MEMBER }));
    expect(invalidate).not.toHaveBeenCalled();
  });
});
