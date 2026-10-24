// CA-23 P2: one count of what the composer has not yet written, from every path; retries; the failed list.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPendingStore, RETRY_DELAYS_MS, StaleWriteError, trackWrite, withRetries } from "./pendingWrites";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const busy = () => Object.assign(new Error("busy"), { status: 503 });

describe("the count", () => {
  it("adds up every source: tasks and states alike", () => {
    const store = createPendingStore();
    store.set("header", 1);
    store.set("thread", 1);
    const endNode = store.begin("nodes");
    store.begin("nodes");
    store.begin("sessions");
    store.begin("making");
    store.begin("card");
    expect(store.total()).toBe(7);
    expect(store.of("nodes")).toBe(2);
    endNode();
    endNode();
    expect(store.of("nodes")).toBe(1);
    store.set("header", 0);
    expect(store.total()).toBe(5);
  });

  it("tells those who subscribed when it changes, and only then", () => {
    const store = createPendingStore();
    const heard = vi.fn();
    store.subscribe(heard);
    store.set("header", 1);
    store.set("header", 1);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("counts a tracked task from the call until it settles", async () => {
    const store = createPendingStore();
    let finish: (value: string) => void = () => undefined;
    const done = trackWrite("nodes", () => new Promise<string>((resolve) => void (finish = resolve)), { store });
    expect(store.total()).toBe(1);
    finish("ok");
    await expect(done).resolves.toBe("ok");
    expect(store.total()).toBe(0);
  });

  it("counts a task queued behind another from the moment it is queued", async () => {
    const store = createPendingStore();
    let open: () => void = () => undefined;
    const first = new Promise<void>((resolve) => void (open = resolve));
    const second = trackWrite("nodes", async () => "two", { store, after: first });
    expect(store.total()).toBe(1);
    open();
    await second;
    expect(store.total()).toBe(0);
  });
});

describe("retries", () => {
  it("tries a write that can pass later 3 times, after 1, 4 and 10 seconds, then gives up", async () => {
    const times: number[] = [];
    const task = vi.fn(async () => {
      times.push(Date.now());
      throw busy();
    });
    const outcome = withRetries(task).catch((cause: unknown) => cause);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await outcome).toBeInstanceOf(Error);
    expect(task).toHaveBeenCalledTimes(4);
    expect(times.slice(1).map((at, n) => at - times[n])).toEqual([...RETRY_DELAYS_MS]);
  });

  it("does not retry what the database refuses, a stale write or a network failure", async () => {
    for (const error of [Object.assign(new Error("no"), { code: "23514" }), new StaleWriteError("builds", "b1"), new TypeError("Failed to fetch")]) {
      const task = vi.fn(async () => {
        throw error;
      });
      await expect(withRetries(task)).rejects.toBe(error);
      expect(task).toHaveBeenCalledTimes(1);
    }
  });

  it("succeeds when a retry does", async () => {
    const task = vi.fn().mockRejectedValueOnce(busy()).mockResolvedValue("ok");
    const outcome = withRetries(task);
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(outcome).resolves.toBe("ok");
  });
});

describe("failed writes", () => {
  it("keeps one that stopped, and Retry runs it again in the order they stopped", async () => {
    const store = createPendingStore();
    const order: string[] = [];
    const bad = (name: string) => async () => {
      order.push(name);
      throw Object.assign(new Error(name), { code: "23514" });
    };
    await trackWrite("nodes", bad("one"), { store }).catch(() => undefined);
    await trackWrite("making", bad("two"), { store }).catch(() => undefined);
    expect(store.failed().map((write) => write.source)).toEqual(["nodes", "making"]);
    order.length = 0;
    await store.retryFailed();
    expect(order).toEqual(["one", "two"]);
  });

  it("puts a source's older failures right when it writes again", async () => {
    const store = createPendingStore();
    await trackWrite("nodes", async () => Promise.reject(Object.assign(new Error("x"), { code: "23514" })), { store }).catch(() => undefined);
    expect(store.failed()).toHaveLength(1);
    await trackWrite("nodes", async () => "ok", { store });
    expect(store.failed()).toHaveLength(0);
  });

  it("does not list a stale write: it goes to the clash window", async () => {
    const store = createPendingStore();
    await trackWrite("nodes", async () => Promise.reject(new StaleWriteError("build_nodes", "n1")), { store }).catch(() => undefined);
    expect(store.failed()).toHaveLength(0);
  });
});
