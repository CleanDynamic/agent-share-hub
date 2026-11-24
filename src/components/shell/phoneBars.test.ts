// Prompt 20: the bars leave on a scroll down of more than 52 and return on any scroll up; never at the top, with a sheet open.

import { describe, expect, it } from "vitest";

import { HIDE_AFTER_PX, nextHidden } from "./phoneBars";

describe("nextHidden", () => {
  it("stays put until the page has scrolled down past 52", () => {
    expect(nextHidden(false, 0, 30, false)).toBe(false);
    expect(nextHidden(false, 30, HIDE_AFTER_PX, false)).toBe(false);
    expect(nextHidden(false, 50, HIDE_AFTER_PX + 1, false)).toBe(true);
  });
  it("keeps them away while the scroll goes down, and brings both back on any scroll up", () => {
    expect(nextHidden(true, 200, 260, false)).toBe(true);
    expect(nextHidden(true, 260, 259, false)).toBe(false);
  });
  it("never hides at the top of the page or while a sheet is open", () => {
    expect(nextHidden(true, 40, 0, false)).toBe(false);
    expect(nextHidden(false, 100, 400, true)).toBe(false);
  });
  it("does not change on a scroll event that did not move", () => {
    expect(nextHidden(true, 300, 300, false)).toBe(true);
    expect(nextHidden(false, 300, 300, false)).toBe(false);
  });
});
