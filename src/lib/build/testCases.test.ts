// CA-05 P7 — counting test cases exactly, or not at all.

import { describe, expect, it } from "vitest";

import { casesLine, countCases, isTestFileName } from "./testCases";

describe("a csv", () => {
  it("counts its rows after the header", () => {
    expect(countCases("cases.csv", "input,expected\na,b\nc,d\ne,f\n")).toBe(3);
    expect(countCases("cases.csv", "input,expected\r\na,b\r\nc,d")).toBe(2);
  });
  it("counts a record with a line break inside quotes once", () => {
    expect(countCases("cases.csv", 'input,expected\n"line one\nline two",yes\n"say ""hi""",no\n')).toBe(2);
  });
  it("skips blank lines and a leading byte order mark", () => {
    expect(countCases("cases.csv", "﻿a,b\n\n1,2\n\n3,4\n\n")).toBe(2);
  });
  it("gives none when it cannot be sure", () => {
    expect(countCases("cases.csv", 'a,b\n"open,2\n')).toBeNull();
    expect(countCases("cases.csv", 'a,b\nx"y,2\n')).toBeNull();
    expect(countCases("cases.csv", 'a,b\n"x"y,2\n')).toBeNull();
  });
  it("gives none for a header alone or nothing at all", () => {
    expect(countCases("cases.csv", "a,b\n")).toBeNull();
    expect(countCases("cases.csv", "")).toBeNull();
  });
});

describe("json and jsonl", () => {
  it("counts a list at the top of a json file", () => {
    expect(countCases("cases.json", '[{"q":1},{"q":2},3]')).toBe(3);
  });
  it("does not count a json file that is not a list, or is not json", () => {
    expect(countCases("cases.json", '{"cases":[1,2]}')).toBeNull();
    expect(countCases("cases.json", "[1,")).toBeNull();
    expect(countCases("cases.json", "[]")).toBeNull();
  });
  it("counts the lines of a jsonl file when every one is json", () => {
    expect(countCases("cases.jsonl", '{"q":1}\n{"q":2}\n\n{"q":3}\n')).toBe(3);
    expect(countCases("cases.jsonl", '{"q":1}\nnot json\n')).toBeNull();
  });
});

describe("names and words", () => {
  it("takes three kinds of file", () => {
    expect(["a.csv", "a.JSON", "a.jsonl", "a.txt", "a.json.bak"].map(isTestFileName)).toEqual([true, true, true, false, false]);
    expect(countCases("a.txt", "x")).toBeNull();
  });
  it("says it", () => {
    expect(casesLine(40)).toBe("Tested on 40 cases");
    expect(casesLine(1)).toBe("Tested on 1 case");
    expect(casesLine(12000)).toBe("Tested on 12,000 cases");
  });
});
