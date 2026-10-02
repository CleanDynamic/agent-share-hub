// UI-P34 — the Profile's view: both layouts, the controls' callbacks and every state.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { collectionTiles, profileFixture } from "@/dev/fixtures/profile";

import { ProfileView, type ProfileViewProps } from "./ProfileView";

function mount(over: Partial<ProfileViewProps> = {}) {
  const props: ProfileViewProps = { ...profileFixture(), ...over };
  return {
    props,
    ...render(
      <MemoryRouter>
        <ProfileView fit="content" {...props} />
      </MemoryRouter>,
    ),
  };
}

function phone(on: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: on && query.includes("max-width"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe("ProfileView on a desktop", () => {
  it("has one h1, the eyebrow, the handle and bio, and Follow and Message", () => {
    mount();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Maya Okafor" })).toBeTruthy();
    expect(screen.getByText("Maker · Leeds · since Feb 2026")).toBeTruthy();
    expect(screen.getByText("@maya · builds finance agents a person can check")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Follow" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Message" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit profile" })).toBeNull();
  });

  it("follows and unfollows through the callbacks, and says Following when it is so", () => {
    const onFollow = vi.fn();
    const onUnfollow = vi.fn();
    const { unmount } = mount({ onFollow, onUnfollow });
    fireEvent.click(screen.getByRole("button", { name: "Follow" }));
    expect(onFollow).toHaveBeenCalledTimes(1);
    unmount();

    mount({ onFollow, onUnfollow, following: true });
    expect(screen.queryByRole("button", { name: "Follow" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Following" }));
    expect(onUnfollow).toHaveBeenCalledTimes(1);
  });

  it("offers Message only where messaging is offered", () => {
    mount({ onMessage: undefined });
    expect(screen.queryByRole("button", { name: "Message" })).toBeNull();
  });

  it("puts Edit profile in place of Follow and Message on your own profile", () => {
    const onEdit = vi.fn();
    mount({ isOwn: true, onEdit });
    expect(screen.queryByRole("button", { name: "Follow" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Message" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("draws the level as one image and the tracks as a read-only group on somebody else's profile", () => {
    const onTrack = vi.fn();
    mount({ onTrack });
    expect(screen.getByRole("img", { name: "Level 7, 77% of the way to level 8" })).toBeTruthy();
    const track = screen.getByRole("group", { name: "Track" });
    const curator = within(track).getByRole("button", { name: "Curator" });
    expect(curator.getAttribute("aria-pressed")).toBe("true");
    const mentor = within(track).getByRole("button", { name: "Mentor" });
    expect(mentor.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(mentor);
    expect(onTrack).not.toHaveBeenCalled();
    expect(screen.getByText("1,840 / 2,400 xp · 560 to level 8")).toBeTruthy();
    expect(screen.getByText("12-day streak · best 31")).toBeTruthy();
  });

  it("changes the track through the callback on your own profile", () => {
    const onTrack = vi.fn();
    mount({ isOwn: true, onTrack });
    const mentor = within(screen.getByRole("group", { name: "Track" })).getByRole("button", { name: "Mentor" });
    expect(mentor.getAttribute("aria-disabled")).toBeNull();
    fireEvent.click(mentor);
    expect(onTrack).toHaveBeenCalledWith("mentor");
  });

  it("says nothing about XP or a streak where they are not known", () => {
    mount({
      level: { level: 4, percent: 0, xp: null, xpNext: null, remaining: null, track: null, streakDays: 0, streakBest: 0, streakKnown: false },
    });
    expect(screen.getByRole("img", { name: "Level 4" })).toBeTruthy();
    expect(screen.queryByText(/\bxp\b/)).toBeNull();
    expect(screen.queryByText(/streak/)).toBeNull();
  });

  it("prints the four figures, with the earnings beside the bounties and a bar only where one is defined", () => {
    mount();
    const stats = screen.getByTestId("profile-stats");
    expect(within(stats).getByText("Builds hung")).toBeTruthy();
    expect(within(stats).getByText("14")).toBeTruthy();
    expect(within(stats).getByText("212")).toBeTruthy();
    expect(within(stats).getByText("Rebuilds of their work")).toBeTruthy();
    expect(within(stats).getByText(/\/ £1,150/)).toBeTruthy();
    expect(within(stats).getAllByRole("progressbar")).toHaveLength(3);
  });

  it("draws no bar under a figure that has no threshold", () => {
    const base = profileFixture();
    mount({ figures: { ...base.figures!, bars: undefined } });
    expect(within(screen.getByTestId("profile-stats")).queryAllByRole("progressbar")).toHaveLength(0);
  });

  it("has the four tabs with their counts, and asks for another through the callback", () => {
    const onTab = vi.fn();
    const base = profileFixture();
    mount({ works: { ...base.works, onTab } });
    const tabs = screen.getByRole("tablist", { name: "Works" });
    expect(within(tabs).getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Builds 14",
      "Rebuilds 6",
      "Reproduced 48",
      "Collections 4",
    ]);
    expect(within(tabs).getByRole("tab", { name: "Builds 14" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(within(tabs).getByRole("tab", { name: "Reproduced 48" }));
    expect(onTab).toHaveBeenCalledWith("reproduced");
  });

  it("draws the works as cards in a grid, and pages with Show more", () => {
    const onMore = vi.fn();
    const base = profileFixture();
    mount({ works: { ...base.works, hasMore: true, onMore } });
    expect(screen.getAllByTestId("profile-card")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(onMore).toHaveBeenCalledTimes(1);
  });

  it("draws collection tiles with their count of builds on the Collections tab", () => {
    const base = profileFixture();
    mount({ works: { ...base.works, tab: "collections", collections: collectionTiles() } });
    const tiles = screen.getAllByTestId("profile-collection");
    expect(tiles).toHaveLength(4);
    expect(within(tiles[0]).getByText("Finance ops kit")).toBeTruthy();
    expect(within(tiles[0]).getByText("4 builds")).toBeTruthy();
    expect(within(tiles[3]).getByText("2 builds")).toBeTruthy();
    expect(tiles[0].getAttribute("href")).toBe("/library");
  });

  it("draws the empty, loading and refused states of a tab, with a way to retry", () => {
    const onRetry = vi.fn();
    const base = profileFixture();
    const { unmount } = mount({ works: { ...base.works, cards: [], status: "ready" } });
    expect(screen.getByTestId("profile-works-empty").textContent).toBe("No builds hung yet.");
    unmount();

    const own = mount({ isOwn: true, works: { ...base.works, cards: [], status: "ready" } });
    expect(screen.getByTestId("profile-works-empty").textContent).toBe("No builds hung yet.");
    own.unmount();

    const loading = mount({ works: { ...base.works, status: "loading" } });
    expect(screen.getByTestId("profile-works-loading").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByTestId("profile-works-loading").textContent).toContain("Loading builds");
    loading.unmount();

    mount({ works: { ...base.works, status: "error", errorKind: "permission", onRetry } });
    expect(screen.getByText("You don't have access to this.")).toBeTruthy();
    expect(screen.getByTestId("profile-works-error").textContent).toContain("Works");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("says That didn't load. for a failed works read, and leaves the other tabs' lines for their own", () => {
    const base = profileFixture();
    const { unmount } = mount({ works: { ...base.works, status: "error", cards: [] } });
    expect(screen.getByTestId("profile-works-error").textContent).toContain("That didn't load.");
    unmount();

    mount({ works: { ...base.works, tab: "rebuilds", cards: [], status: "ready" } });
    expect(screen.getByTestId("profile-works-empty").textContent).toBe("No rebuilds yet.");
  });

  it("titles the activity and the creator marks as the reference does, and names every mark", () => {
    mount();
    const activity = screen.getByTestId("profile-activity");
    expect(within(activity).getByText("Activity")).toBeTruthy();
    expect(within(activity).getByText("22 weeks · outlined days were frozen")).toBeTruthy();
    expect(within(activity).getByRole("img").getAttribute("aria-label")).toMatch(/active days? in the last 154/);

    const marks = screen.getByTestId("profile-marks");
    expect(within(marks).getByText("Creator marks")).toBeTruthy();
    expect(within(marks).getByText("Common · rare · highest")).toBeTruthy();
    for (const name of ["First hang", "Ten proven", "Rebuilt 25×", "Gap closer", "Curator"]) {
      expect(within(marks).getByText(name)).toBeTruthy();
    }
  });

  it("says so when there are no creator marks, in the owner's voice on their own profile, as one sentence and no action", () => {
    const { unmount } = mount({ marks: [] });
    expect(screen.getByTestId("profile-marks-empty").textContent).toBe("No creator marks yet.");
    expect(within(screen.getByTestId("profile-marks-empty")).queryAllByRole("button")).toHaveLength(0);
    unmount();
    mount({ marks: [], isOwn: true });
    expect(screen.getByText("Publish a build to earn your first.")).toBeTruthy();
  });

  it("draws placeholders in the shape of what is coming while the panels load", () => {
    mount({ level: null, figures: null, activity: null, marks: null });
    expect(screen.getByTestId("profile-level-loading").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByTestId("profile-level-loading").textContent).toContain("Loading the level");
    expect(screen.getByTestId("profile-stats").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByTestId("profile-activity-loading").textContent).toContain("Loading the activity grid");
    expect(screen.getByTestId("profile-marks-loading").textContent).toContain("Loading the creator marks");
    // Five bones for five marks, in tiles' size.
    expect(screen.getByTestId("profile-marks-loading").querySelectorAll('[data-ui="skeleton"]')).toHaveLength(5);
  });

  it("holds the banner's place with a block, and every panel's head, while the profile itself loads", () => {
    mount({ maker: null, level: null, figures: null, activity: null, marks: null });
    const banner = screen.getByTestId("profile-banner-loading");
    expect(banner.getAttribute("aria-busy")).toBe("true");
    // The whole page announces itself, once.
    expect(banner.getAttribute("role")).toBe("status");
    expect(banner.textContent).toContain("Loading the profile");
    expect(screen.queryByTestId("profile-banner")).toBeNull();
    expect(screen.getByText("Activity")).toBeTruthy();
    expect(screen.getByText("Creator marks")).toBeTruthy();
  });

  it("holds each stat's bar's place while the figures load, where the figures will have bars", () => {
    const { unmount } = mount({ figures: null, figuresBarsExpected: true });
    const withBars = screen.getByTestId("profile-stats").querySelectorAll('[data-ui="skeleton"]').length;
    unmount();
    mount({ figures: null });
    const without = screen.getByTestId("profile-stats").querySelectorAll('[data-ui="skeleton"]').length;
    // Four figures either way; three bars more where the board draws them.
    expect(withBars - without).toBe(3);
  });

  it("says each failed panel in its own place, naming it, and leaves the others as they were", () => {
    const retries = { level: vi.fn(), figures: vi.fn(), activity: vi.fn(), marks: vi.fn() };
    mount({
      level: null,
      figures: null,
      activity: null,
      marks: null,
      failed: {
        level: { onRetry: retries.level },
        figures: { onRetry: retries.figures },
        activity: { onRetry: retries.activity },
        marks: { onRetry: retries.marks },
      },
    });
    const names = {
      "profile-level-error": ["Level", retries.level],
      "profile-stats-error": ["Maker figures", retries.figures],
      "profile-activity-error": ["Activity", retries.activity],
      "profile-marks-error": ["Creator marks", retries.marks],
    } as const;
    for (const [id, [name, retry]] of Object.entries(names)) {
      const failed = screen.getByTestId(id);
      expect(failed.textContent).toContain("That didn't load.");
      expect(failed.textContent).toContain(name);
      fireEvent.click(within(failed).getByRole("button", { name: "Try again" }));
      expect(retry).toHaveBeenCalledTimes(1);
    }
    // The banner and the works carry on.
    expect(screen.getByRole("heading", { level: 1, name: "Maya Okafor" })).toBeTruthy();
    expect(screen.getAllByTestId("profile-card")).toHaveLength(4);
  });
});

describe("ProfileView on a phone", () => {
  it("has the eyebrow without the date, the name and the actions in a row of their own", () => {
    phone(true);
    mount();
    expect(screen.getByTestId("profile-view").getAttribute("data-viewport")).toBe("mobile");
    expect(screen.getByText("Maker · Leeds")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Maya Okafor" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Follow" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Message" })).toBeTruthy();
  });

  it("shows the track as chips, the current one pressed, and the track in the eyebrow", () => {
    phone(true);
    mount();
    const chips = screen.getByRole("group", { name: "Track" });
    expect(within(chips).getAllByRole("button").map((chip) => chip.textContent)).toEqual(["Architect", "Curator", "Mentor", "Explorer"]);
    expect(within(chips).getByRole("button", { name: "Curator" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Curator track")).toBeTruthy();
    expect(screen.getByText("1,840 / 2,400 xp")).toBeTruthy();
    expect(screen.getByText("12-day streak")).toBeTruthy();
  });

  it("draws the works tabs as chips and the stats in two columns, without the earnings", () => {
    phone(true);
    const onTab = vi.fn();
    const base = profileFixture();
    mount({ works: { ...base.works, onTab } });
    const row = screen.getByRole("group", { name: "Works" });
    expect(within(row).getAllByRole("button").map((chip) => chip.textContent)).toEqual([
      "Builds 14",
      "Rebuilds 6",
      "Reproduced 48",
      "Collections 4",
    ]);
    fireEvent.click(within(row).getByRole("button", { name: "Collections 4" }));
    expect(onTab).toHaveBeenCalledWith("collections");
    expect(screen.queryByText(/\/ £1,150/)).toBeNull();
    expect(screen.getAllByTestId("profile-card")).toHaveLength(4);
  });

  it("changes the track from the chips on your own profile only", () => {
    phone(true);
    const onTrack = vi.fn();
    const { unmount } = mount({ onTrack });
    fireEvent.click(within(screen.getByRole("group", { name: "Track" })).getByRole("button", { name: "Mentor" }));
    expect(onTrack).not.toHaveBeenCalled();
    unmount();

    mount({ isOwn: true, onTrack });
    fireEvent.click(within(screen.getByRole("group", { name: "Track" })).getByRole("button", { name: "Mentor" }));
    expect(onTrack).toHaveBeenCalledWith("mentor");
  });

  it("gives you Edit profile alone on your own profile", () => {
    phone(true);
    mount({ isOwn: true });
    expect(screen.getByRole("button", { name: "Edit profile" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Follow" })).toBeNull();
  });
});
