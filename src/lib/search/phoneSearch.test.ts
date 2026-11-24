import { describe, expect, it } from "vitest";

import { firstLine, groupHeading, likePattern, TOPIC_TITLE_MAX } from "./phoneSearch";

describe("phone search helpers", () => {
  it("makes a LIKE pattern without characters that end a filter or act as wildcards", () => {
    expect(likePattern("  router  agent ")).toBe("%router agent%");
    expect(likePattern("a%b_c,d(e)")).toBe("%a b c d e%");
  });

  it("takes a topic's first non-empty line and cuts a long one with an ellipsis", () => {
    expect(firstLine("\n  How do I route?  \nsecond line")).toBe("How do I route?");
    expect(firstLine(null)).toBe("");
    const long = firstLine("x".repeat(200));
    expect(long.length).toBe(TOPIC_TITLE_MAX);
    expect(long.endsWith("…")).toBe(true);
  });

  it("states the count as the heading", () => {
    expect(groupHeading(1, "topic", "topics")).toBe("1 topic");
    expect(groupHeading(3, "person", "people")).toBe("3 people");
    expect(groupHeading(0, "build", "builds")).toBe("0 builds");
  });
});
