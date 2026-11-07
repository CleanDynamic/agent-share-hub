import { describe, expect, it } from "vitest";

import { SECTIONS, sectionLabel, sectionOf, settingsPath } from "./sections";

describe("the sections of Settings", () => {
  it("are the six, in order, with the names the page uses", () => {
    expect(SECTIONS.map((s) => s.label)).toEqual([
      "Account",
      "Notifications",
      "Privacy and blocking",
      "Connected apps",
      "Your data",
      "Appearance",
    ]);
  });

  it("read a section from an address, and nothing for one that does not exist", () => {
    expect(sectionOf("privacy")).toBe("privacy");
    expect(sectionOf("Privacy")).toBeNull();
    expect(sectionOf("billing")).toBeNull();
    expect(sectionOf(undefined)).toBeNull();
  });

  it("make addresses and labels", () => {
    expect(settingsPath()).toBe("/settings");
    expect(settingsPath("apps")).toBe("/settings/apps");
    expect(sectionLabel("data")).toBe("Your data");
  });

  it("use no em dash", () => {
    expect(JSON.stringify(SECTIONS)).not.toContain(String.fromCharCode(0x2014));
  });
});
