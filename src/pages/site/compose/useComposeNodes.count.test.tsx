// CA-23 P2: the node queue's share of the pending count: each task counts from the moment it is queued; a failure waits for Retry.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pendingWrites } from "@/lib/build/pendingWrites";

import { useComposeNodes } from "./useComposeNodes";

const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;

beforeEach(() => {
  vi.useFakeTimers();
  pendingWrites.reset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  pendingWrites.reset();
});

describe("the node queue", () => {
  it("counts each queued task from the moment it is queued, and runs them in order", async () => {
    const { result } = renderHook(() => useComposeNodes("b1", []), { wrapper });
    const order: string[] = [];
    let open: () => void = () => undefined;
    const first = result.current.run(
      () =>
        new Promise<void>((resolve) => {
          open = () => {
            order.push("one");
            resolve();
          };
        }),
    );
    const second = result.current.run(async () => void order.push("two"));
    expect(pendingWrites.of("nodes")).toBe(2);
    await act(async () => undefined);
    await act(async () => open());
    await act(async () => void (await Promise.all([first, second])));
    expect(order).toEqual(["one", "two"]);
    expect(pendingWrites.of("nodes")).toBe(0);
  });

  it("keeps a task that stopped for Retry, which sends it through the queue again", async () => {
    const { result } = renderHook(() => useComposeNodes("b1", []), { wrapper });
    const task = vi.fn().mockRejectedValueOnce(Object.assign(new Error("no"), { code: "23514" })).mockResolvedValue("ok");
    await act(async () => void (await result.current.run(task).catch(() => undefined)));
    expect(pendingWrites.failed()).toHaveLength(1);
    await act(async () => void (await pendingWrites.retryFailed()));
    expect(task).toHaveBeenCalledTimes(2);
    expect(pendingWrites.failed()).toHaveLength(0);
  });

  it("tries a task that can pass later again by itself before it counts as failed", async () => {
    const { result } = renderHook(() => useComposeNodes("b1", []), { wrapper });
    const task = vi.fn().mockRejectedValueOnce(Object.assign(new Error("busy"), { status: 503 })).mockResolvedValue("ok");
    const done = result.current.run(task);
    await act(async () => void (await vi.advanceTimersByTimeAsync(1_000)));
    await expect(done).resolves.toBe("ok");
    expect(task).toHaveBeenCalledTimes(2);
    expect(pendingWrites.failed()).toHaveLength(0);
  });
});
