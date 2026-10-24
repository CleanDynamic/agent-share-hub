// CA-23 P4: what the clash window says.

import { describe, expect, it } from "vitest";

import { CLASH_COPY, clashView, clockOf, panelFields, postWords } from "./clashView";

describe("the words", () => {
  it("says what the board says", () => {
    expect(CLASH_COPY.title("Prompt 2")).toBe("Prompt 2 changed in another tab");
    expect(CLASH_COPY.body).toBe("The version you don't keep goes to Recently removed.");
    expect(CLASH_COPY.useOther).toBe("Use other tab's");
    expect(CLASH_COPY.keepThis).toBe("Keep this tab's");
    expect(CLASH_COPY.otherVersion("Prompt 2")).toBe("Prompt 2 · other tab's version");
    expect(CLASH_COPY.thisVersion("Prompt 2")).toBe("Prompt 2 · this tab's version");
  });

  it("labels each panel with the time of its edit, in 24 hours", () => {
    const view = clashView("Prompt 2", [{ key: "payload.text", mine: "a", theirs: "b" }], new Date(2026, 9, 24, 20, 41).getTime(), new Date(2026, 9, 24, 20, 42).getTime());
    expect(view.title).toBe("Prompt 2 changed in another tab");
    expect(view.mineLabel).toBe("This tab · 20:41");
    expect(view.theirsLabel).toBe("Other tab · 20:42");
    expect(clockOf(new Date(2026, 9, 24, 7, 5).getTime())).toBe("07:05");
  });
});

describe("the panels", () => {
  it("shows one field as its text alone", () => {
    expect(panelFields([{ key: "payload.text", mine: "mine", theirs: "theirs" }], "mine")).toEqual([{ label: "", text: "mine" }]);
    expect(panelFields([{ key: "payload.text", mine: "mine", theirs: "theirs" }], "theirs")).toEqual([{ label: "", text: "theirs" }]);
  });

  it("shows several fields each under its label, and only the ones given (the ones that differ)", () => {
    expect(
      panelFields(
        [
          { key: "title", mine: "A", theirs: "B" },
          { key: "payload.text", mine: "x", theirs: null },
        ],
        "theirs",
      ),
    ).toEqual([
      { label: "Title", text: "B" },
      { label: "Text", text: "(empty)" },
    ]);
  });

  it("reads the post as its words", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "First" }] }, { type: "postBreak" }, { type: "paragraph", content: [{ type: "text", text: "Second " }, { type: "text", text: "post" }] }] };
    expect(postWords(doc)).toBe("First\n\nSecond post");
    expect(panelFields([{ key: "post_doc", mine: doc, theirs: null }], "mine")).toEqual([{ label: "", text: "First\n\nSecond post" }]);
  });
});
