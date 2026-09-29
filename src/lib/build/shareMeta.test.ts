// RC-P16b — the build page's description, cut where a reader would cut it.

import { describe, expect, it } from "vitest";
import { SHARE_DESCRIPTION_MAX, cutAtWord, shareDescription, shareTitle } from "./shareMeta";

const LONG =
  "Sorts a morning's email into three piles, drafts the replies for two of them in the sender's own register, " +
  "flags anything with a date in it for the calendar, and leaves the rest for a human to read after lunch.";

describe("cutAtWord", () => {
  it("leaves a description that fits exactly as it is", () => {
    expect(cutAtWord("Sorts a full inbox.")).toBe("Sorts a full inbox.");
    const exact = "x".repeat(SHARE_DESCRIPTION_MAX);
    expect(cutAtWord(exact)).toBe(exact);
  });

  it("cuts a long one at a word boundary, inside 155 characters, with an ellipsis", () => {
    const cut = cutAtWord(LONG);
    expect(LONG.length).toBeGreaterThan(SHARE_DESCRIPTION_MAX);
    expect(cut.length).toBeLessThanOrEqual(SHARE_DESCRIPTION_MAX);
    expect(cut.endsWith("…")).toBe(true);
    const kept = cut.slice(0, -1);
    expect(LONG.startsWith(kept)).toBe(true);
    // The next character in the original is a space: no word was split.
    expect(LONG.charAt(kept.length)).toMatch(/[\s,]/);
    expect(kept).not.toMatch(/[\s,]$/);
  });

  it("splits a word only when the first word alone is over the limit", () => {
    const word = "a".repeat(200);
    expect(cutAtWord(word)).toBe(`${"a".repeat(SHARE_DESCRIPTION_MAX - 1)}…`);
  });

  it("reads runs of whitespace as one space", () => {
    expect(cutAtWord("  Sorts \n a   full inbox.  ")).toBe("Sorts a full inbox.");
  });
});

describe("shareDescription and shareTitle", () => {
  it("says who made a build with no outcome, and how often it was reproduced", () => {
    expect(shareDescription({ outcome: "", makerName: "Maya Okafor", reproductionCount: 12 })).toBe(
      "A build by Maya Okafor, reproduced 12 times.",
    );
    expect(shareDescription({ outcome: null, makerName: "@maya", reproductionCount: 1 })).toBe(
      "A build by @maya, reproduced 1 time.",
    );
    expect(shareDescription({ outcome: null, makerName: null, reproductionCount: 0 })).toBe(
      "A build by a maker, reproduced 0 times.",
    );
  });

  it("names the page after the build", () => {
    expect(shareTitle("Inbox triage agent")).toBe("Inbox triage agent — buildgallery");
    expect(shareTitle("  ")).toBe("Untitled build — buildgallery");
  });
});
