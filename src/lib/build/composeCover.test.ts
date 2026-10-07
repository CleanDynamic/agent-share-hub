import { describe, expect, it } from "vitest";

import { coverMediaTypes, coverNodeFor, coverNodeType, nextTopPosition } from "./composeCover";
import type { NodeTree } from "./types";

const node = (over: Partial<NodeTree>): NodeTree =>
  ({ id: "n", build_id: "b", parent_id: null, position: 1, type: "screenshot", payload: {}, children: [], ...over }) as NodeTree;

describe("nextTopPosition", () => {
  it("is 1 for an empty tree", () => {
    expect(nextTopPosition([])).toBe(1);
  });

  it("is one past the highest top-level position and ignores children", () => {
    expect(
      nextTopPosition([
        { parent_id: null, position: 1 },
        { parent_id: null, position: 4 },
        { parent_id: "x", position: 9 },
      ]),
    ).toBe(5);
  });
});

describe("cover helpers", () => {
  it("records a video as a recording and anything else as a screenshot", () => {
    expect(coverNodeType("video")).toBe("recording");
    expect(coverNodeType("image")).toBe("screenshot");
  });

  it("offers images and video only", () => {
    const types = coverMediaTypes(["image/png", "video/mp4", "audio/mpeg", "application/pdf", "application/zip", "text/csv"]);
    expect(types).toEqual(["image/png", "video/mp4"]);
  });

  it("finds the evidence node that carries the picture", () => {
    const tree = [
      node({ id: "a", type: "prompt", payload: { media_id: "m1" } }),
      node({ id: "b", position: 2, payload: { media_id: "m1" } }),
    ];
    expect(coverNodeFor(tree, "m1")?.id).toBe("b");
    expect(coverNodeFor(tree, "m2")).toBeNull();
  });
});
