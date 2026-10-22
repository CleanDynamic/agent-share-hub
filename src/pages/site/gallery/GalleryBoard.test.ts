import { describe, expect, it } from "vitest";

import { proofLine } from "./GalleryBoard";
import { groupValues } from "./GalleryBoardGroups";

describe("proofLine", () => {
  it("says Not yet reproduced when nobody has tried it", () => {
    expect(proofLine(undefined, 0)).toEqual({ text: "Not yet reproduced", dot: false });
    expect(proofLine({ tried: 0, worked: 0 }, 0).text).toBe("Not yet reproduced");
  });

  it("gives the dot only when more than half got it working", () => {
    expect(proofLine({ tried: 4, worked: 3 }, 3)).toEqual({ text: "3 of 4 people got it working", dot: true });
    expect(proofLine({ tried: 4, worked: 2 }, 2).dot).toBe(false);
    expect(proofLine({ tried: 1, worked: 1 }, 1)).toEqual({ text: "1 of 1 person got it working", dot: true });
    expect(proofLine({ tried: 3, worked: 0 }, 0)).toEqual({ text: "0 of 3 people got it working", dot: false });
  });

  it("falls back to the worked count when the tries are not known", () => {
    expect(proofLine(undefined, 2)).toEqual({ text: "2 of 2 people got it working", dot: true });
  });
});

describe("groupValues", () => {
  const counts = { "field:ai-ml": 5, "field:ai-ml.retrieval": 3, "field:law": 2, "field:medicine": 5, "task:create": 4, "built:web-app": 1 };

  it("groups Field by its top-level values, most first, none with no builds", () => {
    expect(groupValues("field", counts).map((entry) => entry.value.id)).toEqual(["ai-ml", "medicine", "law"]);
  });

  it("groups Task by its groups, and What was built by its values", () => {
    expect(groupValues("task", counts).map((entry) => entry.value.id)).toEqual(["create"]);
    expect(groupValues("built", counts).map((entry) => entry.value.id)).toEqual(["web-app"]);
    expect(groupValues("technique", counts)).toEqual([]);
  });
});
