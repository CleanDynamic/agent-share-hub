import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loads = vi.hoisted(() => ({ home: vi.fn(async () => ({})), gallery: vi.fn(async () => ({})), drafts: vi.fn(async () => ({})), library: vi.fn(async () => ({})), build: vi.fn(async () => ({})), create: vi.fn(async () => ({})), bounties: vi.fn(async () => ({})) }));
vi.mock("./routeTable", () => ({ ROUTE_TABLE: Object.fromEntries(Object.entries(loads).map(([key, load]) => [key, { load }])) }));

import { loadChunksWhenIdle, resetIdleLoad, startIdleLoad } from "./idleLoad";
import { PAGE_READY_ATTRIBUTE, markPageReady } from "./pageReady";

const setSaveData = (on: boolean) => Object.defineProperty(navigator, "connection", { value: { saveData: on }, configurable: true });

beforeEach(() => {
  vi.useFakeTimers();
  for (const load of Object.values(loads)) load.mockClear();
  resetIdleLoad();
  setSaveData(false);
});
afterEach(() => {
  vi.useRealTimers();
  document.documentElement.removeAttribute(PAGE_READY_ATTRIBUTE);
  Reflect.deleteProperty(window, "requestIdleCallback");
});

describe("idle loading", () => {
  it("loads Home, Builds, Drafts, Library and the build page, and the composer when signed in, after the first page is ready", () => {
    const stop = startIdleLoad(() => true);
    vi.advanceTimersByTime(50);
    expect(loads.home).not.toHaveBeenCalled();
    markPageReady("home");
    vi.advanceTimersByTime(50);
    for (const key of ["home", "gallery", "drafts", "library", "build", "create"] as const) expect(loads[key], key).toHaveBeenCalledTimes(1);
    expect(loads.bounties).not.toHaveBeenCalled();
    stop();
  });

  it("leaves the composer out for a reader who is signed out", () => {
    loadChunksWhenIdle(false);
    vi.advanceTimersByTime(50);
    expect(loads.library).toHaveBeenCalled();
    expect(loads.create).not.toHaveBeenCalled();
  });

  it("does nothing when the reader asked for less data", () => {
    setSaveData(true);
    loadChunksWhenIdle(true);
    vi.advanceTimersByTime(50);
    for (const load of Object.values(loads)) expect(load).not.toHaveBeenCalled();
  });

  it("uses requestIdleCallback when there is one, and a 1 ms timeout when there is not", () => {
    const idle = vi.fn((callback: () => void) => callback());
    Object.defineProperty(window, "requestIdleCallback", { value: idle, configurable: true });
    loadChunksWhenIdle(false);
    expect(idle).toHaveBeenCalledTimes(1);
    expect(loads.home).toHaveBeenCalledTimes(1);

    Reflect.deleteProperty(window, "requestIdleCallback");
    resetIdleLoad();
    loads.home.mockClear();
    loadChunksWhenIdle(false);
    expect(loads.home).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(loads.home).toHaveBeenCalledTimes(1);
  });
});

describe("idle loading, when the reader is known late", () => {
  it("brings the composer once the session says they are signed in, without loading the others again", () => {
    markPageReady("home");
    let signedIn = false;
    startIdleLoad(() => signedIn);
    vi.advanceTimersByTime(5);
    expect(loads.create).not.toHaveBeenCalled();
    expect(loads.home).toHaveBeenCalledTimes(1);

    signedIn = true;
    startIdleLoad(() => signedIn);
    vi.advanceTimersByTime(5);
    expect(loads.create).toHaveBeenCalledTimes(1);
    expect(loads.home).toHaveBeenCalledTimes(1);
  });
});
