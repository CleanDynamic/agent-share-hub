import { describe, expect, it } from "vitest";

import { dockHiddenFor, phoneBarFor } from "./phoneTopBar";

const logo = { kind: "logo" };
const none = { kind: "none" };
const title = (text: string) => ({ kind: "title", text });

describe("phoneBarFor (prompt 19's table)", () => {
  it.each(["/", "/builds", "/gallery", "/openbuilds"])("%s: account, the logo, Search", (path) => {
    expect(phoneBarFor(path)).toEqual({ left: "account", centre: logo, right: "search" });
  });

  it("Activity: account, its title, Mark all read", () => {
    expect(phoneBarFor("/notifications")).toEqual({ left: "account", centre: title("Activity"), right: "markAll" });
  });

  it.each([
    ["/library", "Library", "none"],
    ["/drafts", "Drafts", "newBuild"],
    ["/settings", "Settings", "none"],
    ["/settings/privacy", "Settings", "none"],
    ["/messages", "Messages", "settings"],
    ["/search", "Search", "none"],
  ])("%s: back, %s, %s", (path, name, right) => {
    expect(phoneBarFor(path)).toEqual({ left: "back", centre: title(name), right });
  });

  it("Followers and Following: back and the word (the page replaces it with the person's name)", () => {
    expect(phoneBarFor("/profile/ada/followers")).toMatchObject({ left: "back", centre: title("Followers"), right: "none" });
    expect(phoneBarFor("/profile/ada/following")).toMatchObject({ left: "back", centre: title("Following") });
  });

  it("a build: back, nothing, More; Lineage and Compare name themselves", () => {
    expect(phoneBarFor("/b2/invoice-triage")).toEqual({ left: "back", centre: none, right: "more" });
    expect(phoneBarFor("/b2/invoice-triage/lineage")).toMatchObject({ centre: title("Lineage"), right: "more" });
    expect(phoneBarFor("/b2/a/compare/b")).toMatchObject({ centre: title("Compare"), right: "more" });
  });

  it("a space and a topic: back, the topic names itself, More", () => {
    expect(phoneBarFor("/openbuilds/spaces/ai-tools")).toEqual({ left: "back", centre: none, right: "more" });
    expect(phoneBarFor("/openbuilds/topics/42")).toMatchObject({ left: "back", right: "more" });
  });

  it("a profile: back, nothing, More", () => {
    expect(phoneBarFor("/profile/ada")).toEqual({ left: "back", centre: none, right: "more" });
    expect(phoneBarFor("/profile")).toEqual({ left: "back", centre: none, right: "more" });
  });

  it("the editor, Start a build and Rebuild: back, the logo, More", () => {
    expect(phoneBarFor("/compose/abc")).toEqual({ left: "back", centre: logo, right: "more", backLabel: "Back to Drafts" });
    expect(phoneBarFor("/compose/new")).toMatchObject({ left: "back", centre: logo, right: "more" });
    expect(phoneBarFor("/rebuild/invoice-triage")).toEqual({ left: "back", centre: logo, right: "more" });
  });

  it("onboarding: nothing at the left or centre, Skip at the right; consent: close", () => {
    expect(phoneBarFor("/onboarding")).toEqual({ left: "none", centre: none, right: "skip" });
    expect(phoneBarFor("/onboarding/profile")).toMatchObject({ right: "skip" });
    expect(phoneBarFor("/auth/callback")).toEqual({ left: "close", centre: none, right: "none" });
  });

  it("never repeats the section's name: the three primary sections show the logo, not a title", () => {
    for (const path of ["/", "/builds", "/openbuilds"]) expect(phoneBarFor(path).centre).toEqual(logo);
  });

  it("ignores a trailing slash", () => {
    expect(phoneBarFor("/drafts/")).toEqual(phoneBarFor("/drafts"));
  });
});

describe("dockHiddenFor", () => {
  it.each(["/compose/abc", "/compose/new", "/rebuild/x", "/onboarding", "/messages/t1", "/auth/callback"])("hides on %s", (path) => {
    expect(dockHiddenFor(path)).toBe(true);
  });
  it("hides while the sign-in dialog is open on any page", () => {
    expect(dockHiddenFor("/builds", "?signin=login")).toBe(true);
  });
  it.each(["/", "/builds", "/openbuilds", "/notifications", "/library", "/drafts", "/messages", "/b2/x"])("keeps the dock on %s", (path) => {
    expect(dockHiddenFor(path)).toBe(false);
  });
});
