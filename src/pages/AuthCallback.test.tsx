// G16, G18, G19: the OAuth callback. It lands on the return address the provider carried back (checked again here),
// shows its failed state at once when the address carries an error, and within 3 seconds when no session appears.

import { act, render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const resolvePostAuthRoute = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: (...args: unknown[]) => getSession(...args) } },
}));
vi.mock("@/lib/auth/postAuthRoute", () => ({ resolvePostAuthRoute: (...args: unknown[]) => resolvePostAuthRoute(...args) }));
vi.mock("@/components/auth/AuthShell", () => ({ AuthShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/auth/AuthCallbackCard", () => ({
  AuthCallbackCard: ({ state }: { state: string }) => <p data-testid="card">{state}</p>,
}));

import AuthCallback from "./AuthCallback";

function Where() {
  const { pathname, search, hash } = useLocation();
  return <p data-testid="where">{pathname + search + hash}</p>;
}

function open(url: string) {
  const [path, rest = ""] = url.split("?");
  const [search, hash = ""] = rest.split("#");
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[{ pathname: path, search: search ? `?${search}` : "", hash: hash ? `#${hash}` : "" }]}>
        <Where />
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

const card = () => screen.queryByTestId("card")?.textContent;
const where = () => screen.getByTestId("where").textContent;
const session = { user: { id: "u-1" } };

beforeEach(() => {
  vi.useFakeTimers();
  getSession.mockReset();
  resolvePostAuthRoute.mockReset();
  resolvePostAuthRoute.mockResolvedValue("/onboarding");
});
afterEach(() => vi.useRealTimers());

describe("the OAuth callback", () => {
  it("G18: lands on the return address the provider carried back", async () => {
    getSession.mockResolvedValue({ data: { session } });
    open(`/auth/callback?provider=github&redirect=${encodeURIComponent("/library?view=saved#top")}`);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(where()).toBe("/library?view=saved#top");
    expect(resolvePostAuthRoute).not.toHaveBeenCalled();
  });

  it("G16, G18: checks the return again on the way back, and lands on / for one that leaves the site", async () => {
    getSession.mockResolvedValue({ data: { session } });
    open(`/auth/callback?provider=x&redirect=${encodeURIComponent("//example.com")}`);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(where()).toBe("/");
  });

  it("asks where next when no return was carried", async () => {
    getSession.mockResolvedValue({ data: { session } });
    open("/auth/callback?provider=google");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(where()).toBe("/onboarding");
    expect(resolvePostAuthRoute).toHaveBeenCalledWith("u-1");
  });

  it.each([
    ["the query", "/auth/callback?provider=google&error=access_denied"],
    ["the hash", "/auth/callback?provider=google#error=server_error&error_description=x"],
  ])("G19: shows the failed state at once when %s carries an error", async (_name, url) => {
    getSession.mockResolvedValue({ data: { session: null } });
    open(url);
    expect(card()).toBe("failed");
    expect(getSession).not.toHaveBeenCalled();
  });

  it("G19: shows the failed state within 3 seconds when no session appears", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    open("/auth/callback?provider=github");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_500);
    });
    expect(card()).toBe("pending");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(card()).toBe("failed");
  });
});
