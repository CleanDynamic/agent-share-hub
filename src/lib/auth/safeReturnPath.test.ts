// G15: the one gate every return address after sign-in goes through.

import { describe, expect, it } from "vitest";

import { returnPathFrom, safeReturnPath } from "./safeReturnPath";

describe("safeReturnPath", () => {
  it.each([
    "/",
    "/library",
    "/library?view=saved#top",
    "/b/some-build?tab=steps",
    "/profile/ada_l#comments",
    "/search?q=a%2Fb",
  ])("keeps the path on this site %j", (value) => {
    expect(safeReturnPath(value)).toBe(value);
  });

  it.each([
    ["absolute https", "https://example.com"],
    ["absolute http", "http://example.com/library"],
    ["protocol-relative", "//example.com"],
    ["protocol-relative with path", "//example.com/library"],
    ["slash backslash", "/\\example.com"],
    ["backslash slash", "\\/example.com"],
    ["double slash later", "/library//example.com"],
    ["javascript scheme", "javascript:alert(1)"],
    ["data scheme", "data:text/html,<script>alert(1)</script>"],
    ["mixed-case scheme", "JaVaScRiPt:alert(1)"],
    ["no leading slash", "library"],
    ["tab inside the double slash", "/\t/example.com"],
    ["newline inside the double slash", "/\n/example.com"],
    ["carriage return", "/library\r"],
    ["null byte", "/\u0000/example.com"],
    ["delete character", "/\u007f"],
    ["C1 control", "/\u0085library"],
    ["leading space", " /library"],
    ["empty", ""],
    ["backslash anywhere", "/library\\..\\example.com"],
    ["very long", `/${"a".repeat(3000)}`],
  ])("returns / for %s", (_name, value) => {
    expect(safeReturnPath(value)).toBe("/");
  });

  it.each([null, undefined, 42, {}, ["/library"]])("returns / for a value that is not a string: %j", (value) => {
    expect(safeReturnPath(value)).toBe("/");
  });
});

describe("returnPathFrom", () => {
  it("is null when the address names no return", () => {
    expect(returnPathFrom(new URLSearchParams("signin=login"))).toBeNull();
  });

  it("reads redirect first, then its returnTo alias, each through the gate", () => {
    expect(returnPathFrom(new URLSearchParams("redirect=%2Flibrary&returnTo=%2Fdrafts"))).toBe("/library");
    expect(returnPathFrom(new URLSearchParams("returnTo=%2Fdrafts"))).toBe("/drafts");
    expect(returnPathFrom(new URLSearchParams("redirect=https%3A%2F%2Fexample.com"))).toBe("/");
  });
});
