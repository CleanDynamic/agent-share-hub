import { describe, expect, it } from "vitest";

import { addRange, bracketed, changesLine, changesOf, normalizeRanges, rangeAt, removeRange, segmentsOf, shiftRanges } from "./changes";

const text = "Write a welcome email for Ada's Bakery and sign it Ada.";
const bakery = { start: text.indexOf("Ada's Bakery"), end: text.indexOf("Ada's Bakery") + "Ada's Bakery".length };

describe("ranges", () => {
  it("reads defensively, drops what does not fit and joins overlaps", () => {
    expect(changesOf({ changes: [{ start: 3, end: 9 }, { start: 8, end: 12 }, { start: 99, end: 120 }, "x", { start: 5 }] }, text)).toEqual([{ start: 3, end: 12 }]);
    expect(changesOf({}, text)).toEqual([]);
    expect(changesOf(null, text)).toEqual([]);
  });
  it("adds, removes and finds", () => {
    const one = addRange([], bakery, text.length);
    expect(one).toEqual([bakery]);
    expect(rangeAt(one, { start: bakery.start + 2, end: bakery.start + 2 })).toEqual(bakery);
    expect(rangeAt(one, { start: 0, end: 5 })).toBeNull();
    expect(removeRange(one, { start: bakery.start + 1, end: bakery.start + 3 })).toEqual([]);
    expect(removeRange(one, { start: 0, end: 4 })).toEqual(one);
  });
  it("normalises empty and reversed ranges away", () => {
    expect(normalizeRanges([{ start: 4, end: 4 }, { start: 9, end: 2 }], 20)).toEqual([]);
  });
});

describe("ranges survive edits", () => {
  const ranges = [bakery];
  it("before the range", () => {
    const after = `Please ${text}`;
    const [moved] = shiftRanges(text, after, ranges);
    expect(after.slice(moved.start, moved.end)).toBe("Ada's Bakery");
  });
  it("after the range", () => {
    const after = `${text} Thanks!`;
    expect(shiftRanges(text, after, ranges)).toEqual(ranges);
  });
  it("inside the range", () => {
    const after = text.replace("Ada's Bakery", "Ada's Big Bakery");
    const [grown] = shiftRanges(text, after, ranges);
    expect(after.slice(grown.start, grown.end)).toBe("Ada's Big Bakery");
  });
  it("drops a range an edit cuts across", () => {
    const after = text.replace("email for Ada's", "note for Bo's");
    expect(shiftRanges(text, after, ranges)).toEqual([]);
  });
  it("keeps several apart", () => {
    const ada = { start: text.lastIndexOf("Ada"), end: text.lastIndexOf("Ada") + 3 };
    const after = `Hello. ${text}`;
    const moved = shiftRanges(text, after, [bakery, ada]);
    expect(moved.map((range) => after.slice(range.start, range.end))).toEqual(["Ada's Bakery", "Ada"]);
  });
});

describe("copies", () => {
  it("puts the words in square brackets", () => {
    expect(bracketed(text, [bakery])).toBe("Write a welcome email for [Ada's Bakery] and sign it Ada.");
    expect(bracketed(text, [])).toBe(text);
    expect(bracketed(text, undefined)).toBe(text);
  });
  it("cuts the text into pieces", () => {
    expect(segmentsOf("abc def", [{ start: 4, end: 7 }])).toEqual([
      { text: "abc ", change: false },
      { text: "def", change: true },
    ]);
  });
  it("says how many, only when there are any", () => {
    expect(changesLine(0)).toBeNull();
    expect(changesLine(1)).toBe("1 word to change before you send it");
    expect(changesLine(2)).toBe("2 words to change before you send it");
  });
});
