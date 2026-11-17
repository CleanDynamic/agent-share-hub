// G13: a member's refused request is confirmed once with the auth server; a confirmed end clears the local session
// exactly once and opens the sign-in dialog over the same page. A 403, or a request without a member's token, does nothing.
import { act, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* The listener wraps auth.signOut while mounted (G17), so the stub it calls through is kept here as `signOut`. */
const signOut = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  signOut: (() => undefined) as unknown,
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
  const navigate = useNavigate();
  seen = location;
  return (
    <button type="button" onClick={() => navigate(-1)}>
      close
    </button>
  );
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
  signOut.mockReset().mockResolvedValue({ error: null });
  auth.signOut = signOut;
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
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
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
    expect(signOut).not.toHaveBeenCalled();
    expect(sessionPhase()).toBe("live");
    expect(seen.search).toBe("?tab=saved");
  });

  it("does nothing when the check itself cannot be made (the network, not the session)", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 0, name: "AuthRetryableFetchError" } });
    mount();
    refuse(MEMBER);
    await flush();
    expect(signOut).not.toHaveBeenCalled();
    expect(sessionPhase()).toBe("live");
  });

  it("does not confirm a token the client has already replaced", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: jwt({ sub: "u1", role: "authenticated", n: 2 }) } }, error: null });
    mount();
    refuse(MEMBER);
    await flush();
    expect(auth.getUser).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    expect(sessionPhase()).toBe("live");
  });

  it("a session the client dropped while checking (its refresh was refused) is ended too", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mount();
    refuse(MEMBER);
    await flush();
    expect(sessionPhase()).toBe("ended");
    expect(new URLSearchParams(seen.search).get("signin")).toBe("login");
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
  it("puts the phase back to live and reads the page again: refused reads from their skeleton, the rest in place", async () => {
    const client = mount();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const reset = vi.spyOn(client, "resetQueries");
    refuse(MEMBER);
    await flush();
    expect(sessionPhase()).toBe("ended");
    const onChange = auth.onAuthStateChange.mock.calls[0][0] as (event: string, session: unknown) => void;
    act(() => onChange("SIGNED_IN", { access_token: MEMBER }));
    expect(sessionPhase()).toBe("live");
    expect(reset).toHaveBeenCalledTimes(1);
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

describe("a sign-out nobody asked for (G17)", () => {
  const changes = () => auth.onAuthStateChange.mock.calls[0][0] as (event: string, session: unknown) => void;

  it("the client dropping a member's session (a refused refresh) opens the dialog the same way", async () => {
    mount();
    act(() => changes()("INITIAL_SESSION", { access_token: MEMBER }));
    act(() => changes()("SIGNED_OUT", null));
    await flush();
    expect(sessionPhase()).toBe("ended");
    expect(signOut).not.toHaveBeenCalled();
    expect(new URLSearchParams(seen.search).get("signin")).toBe("login");
    expect(seen.state).toMatchObject({ signedOut: true });
  });

  it("a sign-out the member asked for (any caller of auth.signOut) opens nothing", async () => {
    mount();
    act(() => changes()("INITIAL_SESSION", { access_token: MEMBER }));
    signOut.mockImplementation(async () => {
      changes()("SIGNED_OUT", null);
      return { error: null };
    });
    const { supabase } = await import("@/integrations/supabase/client");
    await act(async () => {
      await supabase.auth.signOut();
    });
    expect(sessionPhase()).toBe("live");
    expect(seen.search).toBe("?tab=saved");
  });

  it("a visitor who was never signed in is never asked", async () => {
    mount();
    act(() => changes()("INITIAL_SESSION", null));
    act(() => changes()("SIGNED_OUT", null));
    await flush();
    expect(sessionPhase()).toBe("live");
    expect(seen.search).toBe("?tab=saved");
  });
});

describe("back from a provider (G15)", () => {
  it("puts the page back where it was scrolled, once", async () => {
    const { keepPlace } = await import("./returnPlace");
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    keepPlace("/library?tab=saved#top", 640);
    mount();
    await flush();
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 640 }));
    expect(sessionStorage.length).toBe(0);
  });
});

describe("closing the dialog without signing in (G16)", () => {
  it("the page is read again as a visitor's: the phase is live and what failed loads from its skeleton", async () => {
    const client = mount();
    const reset = vi.spyOn(client, "resetQueries");
    refuse(MEMBER);
    await flush();
    expect(new URLSearchParams(seen.search).get("signin")).toBe("login");
    const { fireEvent, screen } = await import("@testing-library/react");
    fireEvent.click(screen.getByText("close"));
    await flush();
    expect(seen.search).toBe("?tab=saved");
    expect(sessionPhase()).toBe("live");
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

describe("the session check has a time limit", () => {
  afterEach(() => vi.useRealTimers());

  it("a check that does not finish within READ_TIMEOUT_MS leaves the session live, so held failures show", async () => {
    vi.useFakeTimers();
    const { READ_TIMEOUT_MS } = await import("@/lib/query/readLimit");
    auth.getSession.mockReturnValue(new Promise(() => undefined));
    mount();
    refuse(MEMBER);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS - 1);
    });
    expect(sessionPhase()).toBe("checking");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(sessionPhase()).toBe("live");
    expect(signOut).not.toHaveBeenCalled();
    expect(seen.search).toBe("?tab=saved");
  });
});
