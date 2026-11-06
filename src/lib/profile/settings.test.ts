// UX-10 P1: the profile's settings, links, about and pins: what parses, and what the database would refuse.

import { describe, expect, it } from "vitest";

import {
  ABOUT_MAX,
  DEFAULT_SETTINGS,
  aboutProblem,
  altProblem,
  linkHost,
  linksProblem,
  movePin,
  oneLineProblem,
  parseCrop,
  parseProfileSettings,
  pinsProblem,
  settingsProblem,
  storedSettings,
} from "./settings";

describe("profile settings", () => {
  it("parse to the defaults when nothing is stored", () => {
    expect(parseProfileSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(parseProfileSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("parse what is stored, and fall back on a value they do not know", () => {
    const s = parseProfileSettings({ feed_filter: "notes", build_display: "sideways", notes_visible: "followers", level_visible: "only_me" });
    expect(s.feedFilter).toBe("notes");
    expect(s.buildDisplay).toBe("first_post");
    expect(s.notesVisible).toBe("followers");
    expect(s.levelVisible).toBe("only_me");
  });

  it("keep the stored side order, each section once, and add any left out", () => {
    const s = parseProfileSettings({ side_sections: [{ key: "marks", hidden: true }, { key: "about", hidden: false }, { key: "marks", hidden: false }] });
    expect(s.sideSections.map((one) => one.key)).toEqual(["marks", "about", "spaces", "others", "collections"]);
    expect(s.sideSections[0].hidden).toBe(true);
  });

  it("go back to the database as it stores them, which it accepts", () => {
    const stored = storedSettings({ ...DEFAULT_SETTINGS, feedFilter: "topics" });
    expect(stored.feed_filter).toBe("topics");
    expect(settingsProblem(stored)).toBeNull();
  });

  it("refuse an unknown setting, an unknown value and a section twice", () => {
    expect(settingsProblem({ theme: "pink" })).toBe("Unknown setting: theme.");
    expect(settingsProblem({ feed_filter: "saves" })).toBe("Unknown feed filter.");
    expect(settingsProblem({ side_sections: [{ key: "about", hidden: false }, { key: "about", hidden: true }] })).toBe("Unknown side sections.");
    expect(settingsProblem({ side_sections: [{ key: "recent", hidden: false }] })).toBe("Unknown side sections.");
    expect(settingsProblem([])).not.toBeNull();
  });
});

describe("the profile's limits", () => {
  it("refuse a fourth link, a link that is not https, and one over 200 characters", () => {
    expect(linksProblem(["https://a.dev", "https://b.dev", "https://c.dev"])).toBeNull();
    expect(linksProblem(["https://a.dev", "https://b.dev", "https://c.dev", "https://d.dev"])).toBe("A profile holds 3 links.");
    expect(linksProblem(["http://a.dev"])).toBe("A link starts with https://.");
    expect(linksProblem([`https://${"a".repeat(200)}.dev`])).toBe("A link is at most 200 characters.");
  });

  it("refuse a 601-character about and keep a 600-character one", () => {
    expect(aboutProblem("a".repeat(ABOUT_MAX))).toBeNull();
    expect(aboutProblem("a".repeat(ABOUT_MAX + 1))).toBe("About is at most 600 characters.");
  });

  it("hold one line to 160 and ALT to 1,000", () => {
    expect(oneLineProblem("a".repeat(160))).toBeNull();
    expect(oneLineProblem("a".repeat(161))).not.toBeNull();
    expect(altProblem("a".repeat(1001))).not.toBeNull();
  });

  it("show a link by its host", () => {
    expect(linkHost("https://www.maya.dev/about")).toBe("maya.dev");
  });

  it("read a crop of four fractions and nothing else", () => {
    expect(parseCrop({ x: 0.1, y: 0.2, w: 0.5, h: 0.5 })).toEqual({ x: 0.1, y: 0.2, w: 0.5, h: 0.5 });
    expect(parseCrop({ x: 0.1, y: 0.2, w: 2, h: 0.5 })).toBeNull();
    expect(parseCrop("crop")).toBeNull();
  });
});

describe("pins", () => {
  it("refuse a fourth pin and one pinned twice", () => {
    const three = [
      { kind: "build" as const, id: "a" },
      { kind: "topic" as const, id: "b" },
      { kind: "reply" as const, id: "c" },
    ];
    expect(pinsProblem(three)).toBeNull();
    expect(pinsProblem([...three, { kind: "repro_note", id: "d" }])).toBe("A profile holds 3 pins. Unpin one first.");
    expect(pinsProblem([three[0], three[0]])).toBe("That is pinned already.");
  });

  it("move up and down, and stay put at either end", () => {
    expect(movePin(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(movePin(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
    expect(movePin(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(movePin(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
  });
});
