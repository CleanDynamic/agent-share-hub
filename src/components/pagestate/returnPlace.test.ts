// G15: the page and its scroll, kept on this tab while the member is away at a provider, given back once on return.
import { afterEach, describe, expect, it, vi } from "vitest";

import { PLACE_KEY, keepPlace, takePlace } from "./returnPlace";

afterEach(() => {
  sessionStorage.clear();
  vi.useRealTimers();
});

describe("keepPlace / takePlace", () => {
  it("gives the scroll back once, for the same address only; another address leaves it for its page", () => {
    keepPlace("/library?tab=saved#top", 640);
    expect(takePlace("/auth/callback?provider=google")).toBeNull();
    expect(takePlace("/library?tab=saved#top")).toBe(640);
    expect(takePlace("/library?tab=saved#top")).toBeNull();
  });

  it("forgets a place older than ten minutes", () => {
    vi.useFakeTimers();
    keepPlace("/library", 200);
    vi.advanceTimersByTime(10 * 60_000 + 1);
    expect(takePlace("/library")).toBeNull();
  });

  it("reads nothing from a record it did not write", () => {
    sessionStorage.setItem(PLACE_KEY, "{not json");
    expect(takePlace("/library")).toBeNull();
    sessionStorage.setItem(PLACE_KEY, JSON.stringify({ path: "/library", y: "x", at: Date.now() }));
    expect(takePlace("/library")).toBeNull();
  });
});
