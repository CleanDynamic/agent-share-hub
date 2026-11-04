import { describe, expect, it } from "vitest";

import { busyMeta, feedSearch, freshCount, newWords, readFeedAddress } from "./openBuildsFeedModel";

describe("the feed's address", () => {
  it("defaults to Your spaces signed in, and to Everyone signed out whatever the address says", () => {
    expect(readFeedAddress(new URLSearchParams(""), true)).toEqual({ scope: "mine", open: false });
    expect(readFeedAddress(new URLSearchParams("scope=everyone&open=1"), true)).toEqual({ scope: "everyone", open: true });
    expect(readFeedAddress(new URLSearchParams(""), false)).toEqual({ scope: "everyone", open: false });
  });
  it("lets a default value leave the address and keeps other parameters", () => {
    expect(feedSearch(new URLSearchParams("x=1"), { scope: "everyone" }, true).toString()).toBe("x=1&scope=everyone");
    expect(feedSearch(new URLSearchParams("scope=everyone&open=1"), { scope: "mine" }, true).toString()).toBe("open=1");
    expect(feedSearch(new URLSearchParams("open=1"), { open: false }, true).toString()).toBe("");
    expect(feedSearch(new URLSearchParams(""), { scope: "everyone" }, false).toString()).toBe("");
  });
});

describe("the feed's words", () => {
  it("hides n new at zero", () => {
    expect(newWords(0)).toBeNull();
    expect(newWords(3)).toBe("3 new");
  });
  it("says who made a busy space and how many are in it", () => {
    expect(busyMeta("sam", 412)).toBe("Made by @sam · 412 members");
    expect(busyMeta(null, 1)).toBe("Made by someone · 1 member");
  });
  it("counts the posts since the reader last looked, or all of the week's when they never did", () => {
    const times = ["2026-11-03T10:00:00Z", "2026-11-02T10:00:00Z", "2026-11-01T10:00:00Z"];
    expect(freshCount(times, null)).toBe(3);
    expect(freshCount(times, "2026-11-02T00:00:00Z")).toBe(2);
    expect(freshCount(undefined, null)).toBe(0);
  });
});
