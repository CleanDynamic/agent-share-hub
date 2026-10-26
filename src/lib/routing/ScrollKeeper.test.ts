// SV-04 P6: the scroll a history entry had, kept in sessionStorage under a versioned key, and nothing lost when storage
// refuses.

import { afterEach, describe, expect, it, vi } from "vitest";

import { readScroll, writeScroll } from "./ScrollKeeper";

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe("the kept scroll", () => {
  it("is stored per entry as scroll:v1:<key>, holding only { y }", () => {
    writeScroll("abc", 412.6);
    expect(window.sessionStorage.getItem("scroll:v1:abc")).toBe(JSON.stringify({ y: 413 }));
    expect(readScroll("abc")).toBe(413);
    expect(readScroll("other")).toBeNull();
  });

  it("reads nothing from a value it did not write", () => {
    window.sessionStorage.setItem("scroll:v1:bad", "not json");
    window.sessionStorage.setItem("scroll:v1:odd", JSON.stringify({ y: "12" }));
    expect(readScroll("bad")).toBeNull();
    expect(readScroll("odd")).toBeNull();
  });

  it("survives storage that throws, on read and on write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => writeScroll("abc", 10)).not.toThrow();
    expect(readScroll("abc")).toBeNull();
  });
});
