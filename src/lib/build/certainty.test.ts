import { describe, expect, it } from "vitest";

import { certaintySource, certaintySpoken, certaintyWords, sortedShares } from "./certainty";

describe("certainty wording", () => {
  it("reads 92% as sure, and 60% as sure", () => {
    expect(certaintyWords(0.92)).toEqual({ text: "92% confidence", unsure: false });
    expect(certaintyWords(0.6)).toEqual({ text: "60% confidence", unsure: false });
  });
  it("reads 54% as unsure, with the number", () => {
    expect(certaintyWords(0.54)).toEqual({ text: "unsure (54%)", unsure: true });
    expect(certaintyWords(0.599).unsure).toBe(true);
  });
  it("says the source in the page's words, and nothing for none", () => {
    expect(certaintySource("run")).toBe("From the run");
    expect(certaintySource("maker")).toBe("Maker's figure");
    expect(certaintySource(undefined)).toBeNull();
  });
  it("speaks one sentence", () => {
    expect(certaintySpoken("billing", 0.92, "run")).toBe("billing, 92 percent sure, from the run");
    expect(certaintySpoken("billing", 0.54)).toBe("billing, unsure, 54 percent sure");
  });
  it("sorts every option high to low and keeps ties in order", () => {
    expect(sortedShares({ a: 0.1, b: 0.7, c: 0.1, d: 0.1 }).map((row) => row.key)).toEqual(["b", "a", "c", "d"]);
  });
});
