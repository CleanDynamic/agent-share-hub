import { describe, expect, it } from "vitest";

import { originFrom } from "./notepadMotion";

const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height }) as DOMRect;

describe("the notepad's origin", () => {
  it("is the Expand button's centre, relative to the notepad", () => {
    expect(originFrom(rect(300, 120, 32, 32), rect(100, 100, 400, 300))).toBe("216px 36px");
  });
});
