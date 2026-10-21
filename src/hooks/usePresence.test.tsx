// CA-10 (CA-09 F10): presence writes once per real change, not once per focus, blur and visibility event.

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn(async () => ({ error: null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ upsert }) } }));
let auth = { isLoggedIn: true, user: { id: "u1" } as { id: string } | null };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

import { PRESENCE_SETTLE_MS, usePresence } from "./usePresence";

const hidden = (value: boolean) => Object.defineProperty(document, "hidden", { configurable: true, get: () => value });
const writes = () => upsert.mock.calls.map((call) => (call as unknown as [{ is_online: boolean }])[0].is_online);

beforeEach(() => {
  vi.useFakeTimers();
  upsert.mockClear();
  hidden(false);
  auth = { isLoggedIn: true, user: { id: "u1" } };
});
afterEach(() => vi.useRealTimers());

describe("usePresence", () => {
  it("writes once on leaving and once on coming back, however many events arrive", async () => {
    renderHook(() => usePresence());
    expect(writes()).toEqual([true]);
    act(() => {
      hidden(true);
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("blur"));
    });
    await act(() => vi.advanceTimersByTimeAsync(PRESENCE_SETTLE_MS));
    act(() => {
      hidden(false);
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
    await act(() => vi.advanceTimersByTimeAsync(PRESENCE_SETTLE_MS));
    expect(writes()).toEqual([true, false, true]);
  });

  it("does not write again when the auth client hands out a new user object for the same user", async () => {
    const hook = renderHook(() => usePresence());
    auth = { isLoggedIn: true, user: { id: "u1" } };
    hook.rerender();
    await act(() => vi.advanceTimersByTimeAsync(PRESENCE_SETTLE_MS));
    expect(writes()).toEqual([true]);
  });
});
