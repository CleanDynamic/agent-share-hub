// G7, D2: the account button's name starts with what it shows.

import { describe, expect, it } from "vitest";

import { accountLabel } from "./accountLabel";

describe("accountLabel", () => {
  it("is the initials, the display name, then what it opens, when the avatar draws initials", () => {
    expect(accountLabel({ name: "Maya Kent" })).toBe("MK, Maya Kent, account menu");
  });
  it("is the display name, then what it opens, when the avatar is a photo", () => {
    expect(accountLabel({ name: "Maya Kent", avatarUrl: "https://example.test/a.png" })).toBe("Maya Kent, account menu");
  });
  it("is what it opens alone when there is no name to show", () => {
    expect(accountLabel({ name: " " })).toBe("Account menu");
  });
});
