import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render } from "@testing-library/react";

/* UI-P40 — the header, the dock and every other badge share one count: one
   read, one pair of realtime channels, nothing on window focus. */

const reads = vi.fn();
const channels = vi.fn();
const removed = vi.fn();
const insertSubs = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoggedIn: true, user: { id: "u1" } }),
}));

vi.mock("@/lib/notifications/realtime", () => ({
  subscribeToNewNotifications: (...args: unknown[]) => {
    insertSubs(...args);
    return () => removed("insert");
  },
}));

vi.mock("@/integrations/supabase/client", () => {
  const query = {
    select: () => query,
    eq: () => query,
    then: (resolve: (v: { count: number }) => void) => {
      reads();
      resolve({ count: 3 });
    },
  };
  const channel = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      from: () => query,
      channel: (name: string) => {
        channels(name);
        return channel;
      },
      removeChannel: () => removed("update"),
    },
  };
});

import { refreshUnreadNotifications, useUnreadNotifications } from "./useUnreadNotifications";

function Badge({ id }: { id: string }) {
  const { count } = useUnreadNotifications();
  return <span data-testid={id}>{count}</span>;
}

beforeEach(() => {
  reads.mockClear();
  channels.mockClear();
  removed.mockClear();
  insertSubs.mockClear();
});

describe("useUnreadNotifications", () => {
  it("reads once and opens one pair of channels for every badge on the page", async () => {
    const view = render(
      <>
        <Badge id="header" />
        <Badge id="dock" />
        <Badge id="shell" />
      </>,
    );
    await act(async () => {});
    expect(reads).toHaveBeenCalledTimes(1);
    expect(channels).toHaveBeenCalledTimes(1);
    expect(insertSubs).toHaveBeenCalledTimes(1);
    expect(view.getByTestId("header").textContent).toBe("3");
    expect(view.getByTestId("dock").textContent).toBe("3");
    view.unmount();
    expect(removed).toHaveBeenCalledTimes(2);
  });

  it("does not read again when the window regains focus", async () => {
    const view = render(<Badge id="header" />);
    await act(async () => {});
    reads.mockClear();
    window.dispatchEvent(new Event("focus"));
    await act(async () => {});
    expect(reads).not.toHaveBeenCalled();
    view.unmount();
  });

  it("reads again, once, when asked after rows are marked read", async () => {
    const view = render(
      <>
        <Badge id="header" />
        <Badge id="dock" />
      </>,
    );
    await act(async () => {});
    reads.mockClear();
    await act(async () => refreshUnreadNotifications());
    expect(reads).toHaveBeenCalledTimes(1);
    view.unmount();
  });
});
