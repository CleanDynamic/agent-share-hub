import { afterEach, describe, expect, it, vi } from "vitest";

import { readViewOptions, VIEW_OFF, viewOptionsKey, writeViewOptions } from "./viewOptions";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("the View switches (CA-14 P6)", () => {
  it("are off until they are turned on", () => {
    expect(readViewOptions("maker-1")).toEqual(VIEW_OFF);
    expect(VIEW_OFF).toEqual({ sessionList: false, splitMerge: false });
  });

  it("are remembered for that maker, and for nobody else", () => {
    writeViewOptions("maker-1", { sessionList: true, splitMerge: false });
    expect(readViewOptions("maker-1")).toEqual({ sessionList: true, splitMerge: false });
    expect(readViewOptions("maker-2")).toEqual(VIEW_OFF);
    expect(viewOptionsKey("maker-1")).not.toBe(viewOptionsKey("maker-2"));
  });

  it("read anything that is not a switch as off", () => {
    window.localStorage.setItem(viewOptionsKey("m"), "not json");
    expect(readViewOptions("m")).toEqual(VIEW_OFF);
    window.localStorage.setItem(viewOptionsKey("m"), JSON.stringify({ sessionList: "yes", splitMerge: 1 }));
    expect(readViewOptions("m")).toEqual(VIEW_OFF);
    window.localStorage.setItem(viewOptionsKey("m"), "null");
    expect(readViewOptions("m")).toEqual(VIEW_OFF);
  });

  it("stay off when storage refuses to be read, and a refused write says nothing", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    expect(readViewOptions("m")).toEqual(VIEW_OFF);
    expect(() => writeViewOptions("m", { sessionList: true, splitMerge: true })).not.toThrow();
  });
});
