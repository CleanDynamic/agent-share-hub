import { describe, expect, it } from "vitest";
import { openTargetsOf } from "./openTargets";

describe("openTargetsOf", () => {
  it("lists the opened parts, then the opened sessions", () => {
    const making = {
      workstreams: [{ key: "ws-1" }, { key: "ws-2", open: { problem: "No tests" } }],
      sessions_meta: {
        "typed-a": { tool: null, date: "2026-10-24" },
        "typed-b": { tool: null, date: "2026-10-24", open: { problem: " Deploy it " } },
        "typed-c": { tool: null, date: "2026-10-24", open: { problem: "  " } },
      },
    };
    expect(openTargetsOf(making)).toEqual([
      { size: "part", key: "ws-2", problem: "No tests" },
      { size: "session", key: "typed-b", problem: "Deploy it" },
    ]);
  });

  it("is empty for a build with nothing opened", () => {
    expect(openTargetsOf(null)).toEqual([]);
    expect(openTargetsOf({ workstreams: [{ key: "ws-1" }] })).toEqual([]);
  });
});
