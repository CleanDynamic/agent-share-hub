// UX-10 P5: the profile's head: each line's drop-out rule, the record line, links, the buttons for the owner and a visitor,
// Level as the owner allows it, and a private profile. The view imports nothing from a data module.

import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProfileHead, type ProfileHeadProps } from "./ProfileHead";
import { linkHostOf, metaParts, oneLineOf, privateLine, recordParts } from "./profileFeedModel";

afterEach(cleanup);

const props = (over: Partial<ProfileHeadProps> = {}): ProfileHeadProps => ({
  userId: "u-maya",
  name: "Maya Ali",
  handle: "maya",
  avatarUrl: null,
  avatarAlt: null,
  header: null,
  meta: metaParts({ handle: "maya", place: "Leeds", joined: "Feb 2026", followers: 412, following: 180 }),
  level: null,
  oneLine: "Builds finance agents a person can check",
  links: ["https://www.maya.dev/about"],
  record: recordParts("maya", { builds: 14, reproducedByOthers: 9, rebuiltFrom: 6, firstRebuildSlug: "inbox-sorter-2", topicsAndReplies: 31 }),
  isOwn: false,
  following: false,
  onFollow: vi.fn(),
  onUnfollow: vi.fn(),
  onMessage: vi.fn(),
  onEdit: vi.fn(),
  onCopyLink: vi.fn(),
  onReport: vi.fn(),
  ...over,
});

const mount = (over: Partial<ProfileHeadProps> = {}) =>
  render(
    <MemoryRouter>
      <ProfileHead {...props(over)} />
    </MemoryRouter>,
  );

describe("the meta line", () => {
  it("reads @maya · Leeds · joined Feb 2026 · 412 followers · 180 following, with the counts as links", () => {
    mount();
    const meta = screen.getByTestId("profile-meta");
    expect(meta.textContent).toBe("@maya · Leeds · joined Feb 2026 · 412 followers · 180 following");
    expect(within(meta).getByRole("link", { name: "412 followers" }).getAttribute("href")).toBe("/profile/maya/followers");
    expect(within(meta).getByRole("link", { name: "180 following" }).getAttribute("href")).toBe("/profile/maya/following");
  });

  it("drops a missing part with its dot, and a zero count", () => {
    expect(metaParts({ handle: "maya", place: null, joined: "Feb 2026", followers: 0, following: 1 }).map((part) => part.text)).toEqual(["@maya", "joined Feb 2026", "1 following"]);
    expect(metaParts({ handle: "maya", place: " ", joined: null, followers: 1, following: 0 }).map((part) => part.text)).toEqual(["@maya", "1 follower"]);
  });
});

describe("the record line", () => {
  it("reads 14 builds · 9 reproduced by others · rebuilt from 6 times · 31 topics and replies, only reproduced in the evidence colour", () => {
    mount();
    const record = screen.getByTestId("profile-record");
    expect(record.textContent).toBe("14 builds · 9 reproduced by others · rebuilt from 6 times · 31 topics and replies");
    const links = within(record).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/profile/maya?show=builds", "/profile/maya?show=builds", "/b2/inbox-sorter-2", "/profile/maya?show=topics"]);
    const coloured = links.filter((link) => link.getAttribute("data-tone") === "evidence");
    expect(coloured.map((link) => link.textContent)).toEqual(["9 reproduced by others"]);
  });

  it("drops a zero part, and is absent when every part is zero", () => {
    expect(recordParts("maya", { builds: 1, reproducedByOthers: 0, rebuiltFrom: 0, firstRebuildSlug: null, topicsAndReplies: 0 }).map((part) => part.text)).toEqual(["1 build"]);
    mount({ record: recordParts("maya", { builds: 0, reproducedByOthers: 0, rebuiltFrom: 0, firstRebuildSlug: null, topicsAndReplies: 0 }) });
    expect(screen.queryByTestId("profile-record")).toBeNull();
  });
});

describe("one line and links", () => {
  it("shows up to 160 characters and each link by its host, rel me noopener", () => {
    expect(oneLineOf("a".repeat(200))).toHaveLength(160);
    expect(oneLineOf("  ")).toBeNull();
    mount();
    const link = screen.getByRole("link", { name: "maya.dev" });
    expect(link.getAttribute("href")).toBe("https://www.maya.dev/about");
    expect(link.getAttribute("rel")).toBe("me noopener");
    expect(linkHostOf("https://github.com/maya")).toBe("github.com");
  });

  it("drops the line when there is neither", () => {
    mount({ oneLine: null, links: [] });
    expect(screen.queryByTestId("profile-one-line")).toBeNull();
  });
});

describe("the buttons", () => {
  it("a visitor has Follow as the one primary, then Message and ···; ··· holds Copy link and Report only", async () => {
    mount();
    const actions = screen.getByTestId("profile-actions");
    expect(within(actions).getAllByRole("button").map((button) => button.textContent)).toEqual(["Follow", "Message", "···"]);
    fireEvent.keyDown(within(actions).getByRole("button", { name: "More for this profile" }), { key: "Enter" });
    await screen.findByRole("menuitem", { name: "Copy link" });
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Copy link", "Report"]);
  });

  it("Follow becomes Following, drawn as a control, once followed", () => {
    const onUnfollow = vi.fn();
    mount({ following: true, onUnfollow });
    const button = screen.getByRole("button", { name: "Following" });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(button);
    expect(onUnfollow).toHaveBeenCalled();
  });

  it("your own profile has Edit profile as its only button, and Change header and Change picture", () => {
    mount({ isOwn: true, onChangeHeader: vi.fn(), onChangePicture: vi.fn() });
    const actions = screen.getByTestId("profile-actions");
    expect(within(actions).getAllByRole("button").map((button) => button.textContent)).toEqual(["Edit profile"]);
    expect(screen.getByRole("button", { name: "Change header" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change picture" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Follow" })).toBeNull();
  });

  it("the name is the page's h1, in the body font, not the serif", () => {
    mount();
    const h1 = screen.getByRole("heading", { level: 1, name: "Maya Ali" });
    expect(h1.style.fontSize).toBe("20px");
    expect(h1.style.fontWeight).toBe("500");
  });
});

describe("pictures", () => {
  it("draws the dot grid with no header, and the header at 4:1 with its crop", () => {
    mount();
    const box = screen.getByTestId("profile-header-picture");
    expect(box.querySelector("img")).toBeNull();
    expect(box.getAttribute("data-texture")).toBe("dot-grid");
    expect(box.getAttribute("style") ?? "").not.toContain("gradient(");
    cleanup();
    mount({ header: { url: "https://cdn.test/h.jpg", crop: { x: 0, y: 0.25, w: 1, h: 0.5 }, alt: "A desk" } });
    const picture = screen.getByRole("img", { name: "A desk" });
    expect(screen.getByTestId("profile-header-picture").style.aspectRatio).toBe("4 / 1");
    expect(picture.style.top).toBe("-50%");
  });
});

describe("Level", () => {
  it("shows Level 7 only when the page gives it", () => {
    mount({ level: 7 });
    expect(screen.getByTestId("profile-level").textContent).toBe("Level 7");
    cleanup();
    mount({ level: null });
    expect(screen.queryByTestId("profile-level")).toBeNull();
  });
});

describe("a private profile", () => {
  it("shows the head and one sentence, with Follow, and nothing else", () => {
    mount({ privateLine: privateLine("maya") });
    expect(screen.getByTestId("profile-private").textContent).toBe("@maya's profile is private.");
    expect(within(screen.getByTestId("profile-actions")).getAllByRole("button").map((button) => button.textContent)).toEqual(["Follow"]);
    expect(screen.queryByTestId("profile-record")).toBeNull();
  });
});

describe("the view", () => {
  it("imports nothing from a data module (only the theme and the page links from src/lib)", () => {
    const source = readFileSync("src/pages/site/profile/ProfileHead.tsx", "utf8");
    const fromLib = [...source.matchAll(/from "@\/lib\/([^"]+)"/g)].map((match) => match[1]);
    expect(fromLib.every((path) => path.startsWith("theme/") || path.startsWith("routing/"))).toBe(true);
  });
});
