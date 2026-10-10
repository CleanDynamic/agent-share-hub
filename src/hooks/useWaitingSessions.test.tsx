import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";

/* The sessions in no build are read again on every opening of a panel, every
   return to the tab and every WAITING_REFRESH_MS while one is open, however
   recently they were read: a connector adds to them from outside the browser. */

const listSessions = vi.fn();

vi.mock("@/lib/build/sessions", () => ({
  listSessions: (...args: unknown[]) => listSessions(...args),
}));

import { useWaitingSessions, WAITING_REFRESH_MS } from "./useWaitingSessions";

function Panel() {
  const { data } = useWaitingSessions();
  return <span data-testid="count">{data === undefined ? "loading" : data.length}</span>;
}

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

function open(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <Panel />
    </QueryClientProvider>,
  );
}

const count = (panel: ReturnType<typeof open>) => panel.getByTestId("count").textContent;

beforeEach(() => {
  listSessions.mockReset();
});

afterEach(() => {
  focusManager.setFocused(undefined);
  vi.useRealTimers();
});

describe("useWaitingSessions", () => {
  it("asks only for the sessions in no build", async () => {
    listSessions.mockResolvedValue([]);
    const panel = open(client());
    await waitFor(() => expect(count(panel)).toBe("0"));
    expect(listSessions).toHaveBeenCalledWith({ includeAttached: false });
  });

  it("reads again when a panel opens, however recently the list was read", async () => {
    const queryClient = client();
    listSessions.mockResolvedValueOnce([]).mockResolvedValue([{ id: "parked" }]);

    const drafts = open(queryClient);
    await waitFor(() => expect(count(drafts)).toBe("0"));
    drafts.unmount();

    const composer = open(queryClient);
    await waitFor(() => expect(count(composer)).toBe("1"));
    expect(listSessions).toHaveBeenCalledTimes(2);
  });

  it("reads again when the reader comes back to the tab", async () => {
    listSessions.mockResolvedValueOnce([]).mockResolvedValue([{ id: "parked" }]);
    const panel = open(client());
    await waitFor(() => expect(count(panel)).toBe("0"));

    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(count(panel)).toBe("1"));
    expect(listSessions).toHaveBeenCalledTimes(2);
  });

  it("reads again while a panel stays open", async () => {
    vi.useFakeTimers();
    listSessions.mockResolvedValueOnce([]).mockResolvedValue([{ id: "parked" }]);
    const panel = open(client());
    await act(() => vi.advanceTimersByTimeAsync(10));
    expect(count(panel)).toBe("0");

    await act(() => vi.advanceTimersByTimeAsync(WAITING_REFRESH_MS));
    await act(() => vi.advanceTimersByTimeAsync(10));
    expect(listSessions).toHaveBeenCalledTimes(2);
    expect(count(panel)).toBe("1");
  });
});
