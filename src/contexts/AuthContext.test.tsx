import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const USER = { id: "user-1" };
let resolveProfile: (value: { data: unknown }) => void = () => {};
const profileReads = vi.fn();
let authListener: (event: string, session: unknown) => void = () => {};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { user: USER } } })),
      onAuthStateChange: vi.fn((listener: (event: string, session: unknown) => void) => {
        authListener = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signOut: vi.fn(async () => ({})),
    },
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => {
            profileReads();
            return new Promise((resolve) => {
              resolveProfile = resolve;
            });
          },
        }),
      }),
    })),
  },
}));

import { AuthProvider, useAuth } from "./AuthContext";

function Probe() {
  const auth = useAuth();
  return (
    <p data-testid="state">
      {[auth.loading ? "loading" : "session", auth.profileLoading ? "profile-loading" : "profile-done", auth.isCreator ? "creator" : "reader"].join(" ")}
    </p>
  );
}

const state = () => screen.getByTestId("state").textContent;

beforeEach(() => {
  profileReads.mockClear();
});

describe("AuthProvider", () => {
  it("ends loading as soon as the stored session is known, with the profile still on its way", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(state()).toBe("session profile-loading reader"));

    await act(async () => resolveProfile({ data: { id: "user-1", is_creator: true } }));
    await waitFor(() => expect(state()).toBe("session profile-done creator"));
  });

  it("asks for the profile once when the session and the auth event arrive together", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(state()).toContain("session"));
    await act(async () => authListener("INITIAL_SESSION", { user: USER }));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
    expect(profileReads).toHaveBeenCalledTimes(1);
  });

  it("refreshing for the same user does not put the profile back to loading", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(state()).toContain("session"));
    await act(async () => resolveProfile({ data: { id: "user-1", is_creator: true } }));
    await waitFor(() => expect(state()).toBe("session profile-done creator"));

    await act(async () => authListener("TOKEN_REFRESHED", { user: USER }));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
    expect(state()).toBe("session profile-done creator");
  });

  it("a signed-out reader has no profile to wait for", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({ data: { session: null } } as never);
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(state()).toBe("session profile-done reader"));
  });
});
