// CA-23 P2: offline is `navigator.onLine` false, or a write that got no response; back online is the `online` event, or a ping every 15 seconds.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createConnection, isNetworkFailure, PING_EVERY_MS, type ConnectionEnv } from "./connection";

function fake(online = true) {
  let on = online;
  let pings = 0;
  let reachable = online;
  const handlers: Record<"online" | "offline", Set<() => void>> = { online: new Set(), offline: new Set() };
  const env: ConnectionEnv = {
    onLine: () => on,
    ping: async () => {
      pings += 1;
      return reachable;
    },
    listen: (event, handler) => {
      handlers[event].add(handler);
      return () => void handlers[event].delete(handler);
    },
  };
  return {
    env,
    pings: () => pings,
    reach: (next: boolean) => void (reachable = next),
    browser: (next: boolean) => {
      on = next;
      for (const handler of [...handlers[next ? "online" : "offline"]]) handler();
    },
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("offline", () => {
  it("is offline when the browser says so", () => {
    const { env, browser } = fake(true);
    const connection = createConnection(env);
    const stop = connection.start();
    expect(connection.isOffline()).toBe(false);
    browser(false);
    expect(connection.isOffline()).toBe(true);
    browser(true);
    expect(connection.isOffline()).toBe(false);
    stop();
  });

  it("starts offline when the page opens with no connection", () => {
    const { env } = fake(false);
    expect(createConnection(env).isOffline()).toBe(true);
  });

  it("is offline when a write got no response, whatever the browser says", () => {
    const { env } = fake(true);
    const connection = createConnection(env);
    connection.noteNetworkFailure();
    expect(connection.isOffline()).toBe(true);
  });
});

describe("back online", () => {
  it("is the online event", async () => {
    const { env, browser } = fake(true);
    const connection = createConnection(env);
    connection.start();
    connection.noteNetworkFailure();
    const back = connection.whenOnline();
    browser(true);
    await expect(back).resolves.toBeUndefined();
    expect(connection.isOffline()).toBe(false);
  });

  it("is a ping that gets an answer, tried every 15 seconds while offline", async () => {
    const { env, pings, reach } = fake(true);
    reach(false);
    const connection = createConnection(env);
    connection.noteNetworkFailure();
    await vi.advanceTimersByTimeAsync(PING_EVERY_MS - 1);
    expect(pings()).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(pings()).toBe(1);
    expect(connection.isOffline()).toBe(true);
    await vi.advanceTimersByTimeAsync(PING_EVERY_MS);
    expect(pings()).toBe(2);
    reach(true);
    await vi.advanceTimersByTimeAsync(PING_EVERY_MS);
    expect(pings()).toBe(3);
    expect(connection.isOffline()).toBe(false);
    // No pinging while online.
    await vi.advanceTimersByTimeAsync(PING_EVERY_MS * 3);
    expect(pings()).toBe(3);
  });

  it("tells those who subscribed", () => {
    const { env } = fake(true);
    const connection = createConnection(env);
    const heard = vi.fn();
    connection.subscribe(heard);
    connection.noteNetworkFailure();
    connection.noteNetworkFailure();
    expect(heard).toHaveBeenCalledTimes(1);
  });
});

describe("isNetworkFailure", () => {
  it("is a fetch that got no answer, not one the database refused or the page cancelled", () => {
    expect(isNetworkFailure(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkFailure(new Error("Load failed"))).toBe(true);
    expect(isNetworkFailure({ message: "x", cause: new TypeError("NetworkError when attempting to fetch resource.") })).toBe(true);
    expect(isNetworkFailure(Object.assign(new Error("23514"), { code: "23514" }))).toBe(false);
    expect(isNetworkFailure(Object.assign(new DOMException("aborted", "AbortError")))).toBe(false);
    expect(isNetworkFailure(null)).toBe(false);
  });
});
