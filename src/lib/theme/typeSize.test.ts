// The seven sizes: every font size the site sets is one of these.

import { describe, expect, it } from "vitest";

import { typeSize } from "./type";

describe("typeSize: the seven sizes", () => {
  it("holds exactly 11, 12, 13, 14, 16, 20 and 32", () => {
    expect(Object.values(typeSize).sort((a, b) => a - b)).toEqual([11, 12, 13, 14, 16, 20, 32]);
  });

  it("names each size for its job", () => {
    expect(typeSize).toEqual({ tagline: 32, title: 20, cardTitle: 16, section: 14, body: 13, meta: 12, micro: 11 });
  });
});
