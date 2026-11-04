import { describe, expect, it } from "vitest";

import type { SpaceCrowd } from "@/lib/openbuilds/spacesFeed";
import type { Space } from "@/lib/openbuilds/types";

import { DEFAULT_SETTINGS, copySettings, makeRefusal, orderLine, primaryFor, readSpaceTab, spaceMeta, spaceSearch } from "./spaceModel";

const space: Space = {
  id: "s1",
  slug: "evals",
  name: "Evals",
  description: "Scoring work",
  rules: "Be kind.\nShow the build.",
  creatorId: "u1",
  whoCanPost: "members",
  postOrder: "pinned_first",
  defaultView: "wall",
  rewardsAllowed: false,
  reactions: ["dislike"],
  createdAt: "2026-10-01T00:00:00Z",
};
const crowd: SpaceCrowd = {
  space,
  creator: { id: "u1", handle: "sam" },
  moderators: [
    { id: "u1", handle: "sam", name: "Sam", avatarUrl: null },
    { id: "u2", handle: "ola", name: "Ola", avatarUrl: null },
  ],
  members: 412,
  role: "none",
};

describe("a space's words", () => {
  it("says who made it, who moderates it, how many are in it and who can post", () => {
    expect(spaceMeta(crowd)).toBe("Made by @sam · moderated by @sam, @ola · 412 members · members can post");
    expect(spaceMeta({ ...crowd, members: 1, space: { ...space, whoCanPost: "invite" } })).toContain("1 member · invite only");
  });
  it("says the order and who set it", () => {
    expect(orderLine("newest", "sam")).toBe("Newest first · set by @sam");
    expect(orderLine("most_replied", "sam")).toBe("Most replied first · set by @sam");
    expect(orderLine("pinned_first", null)).toBe("Pinned first · set by someone");
  });
  it("offers Join to someone outside and Post here to a member", () => {
    expect(primaryFor("none")).toBe("join");
    expect(primaryFor("member")).toBe("post");
    expect(primaryFor("moderator")).toBe("post");
  });
});

describe("the tab and the settings", () => {
  it("keeps Posts out of the address", () => {
    expect(readSpaceTab(new URLSearchParams("tab=rules"))).toBe("rules");
    expect(readSpaceTab(new URLSearchParams(""))).toBe("posts");
    expect(spaceSearch(new URLSearchParams(""), "rules").toString()).toBe("tab=rules");
    expect(spaceSearch(new URLSearchParams("tab=rules"), "posts").toString()).toBe("");
  });
  it("copies settings but never a name, description or member", () => {
    const copied = copySettings(space);
    expect(copied).toEqual({ whoCanPost: "members", rules: "Be kind.\nShow the build.", postOrder: "pinned_first", defaultView: "wall", rewardsAllowed: false, reactions: ["dislike"] });
    expect(Object.keys(copied)).not.toContain("name");
    expect(Object.keys(copied)).not.toContain("description");
  });
  it("starts a new space with the defaults, extra reactions off", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ whoCanPost: "anyone", postOrder: "newest", defaultView: "thread", reactions: [] });
  });
  it("asks for a name", () => {
    expect(makeRefusal("")).toBe("Give the space a name.");
    expect(makeRefusal("Evals")).toBeNull();
  });
});
