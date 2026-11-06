// UX-10 P6: the profile's feed and its four cards: each kind, the build display rule, the filter's hiding rule, ?show=, and each
// empty state.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { profileEntries, profileFixture, profileItems } from "@/dev/fixtures/profile";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, isLoggedIn: false, loading: false }) }));

import { ProfileFeed, type ProfileFeedProps } from "./ProfileFeed";
import { buildDisplayOf, emptyFeed, feedOptions, shownFilter } from "./profileFeedModel";

afterEach(cleanup);

const feedProps = (over: Partial<ProfileFeedProps> = {}, own = false): ProfileFeedProps => ({ ...(profileFixture("populated", own).feed as ProfileFeedProps), ...over });

const mount = (over: Partial<ProfileFeedProps> = {}, own = false) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ProfileFeed {...feedProps(over, own)} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("the four cards", () => {
  it("draws each kind in the database's order, pins first with a Pinned line", () => {
    mount();
    const items = screen.getAllByTestId("profile-feed-item");
    expect(items.map((item) => item.getAttribute("data-kind"))).toEqual(["topic", "build", "repro_note", "reply", "build"]);
    expect(within(items[0]).getByTestId("profile-pinned").textContent).toBe("Pinned");
    expect(within(items[1]).queryByTestId("profile-pinned")).toBeNull();
  });

  it("a topic is the post card, a build its first post, a rebuild its Map card with Rebuilt from", () => {
    mount();
    const items = screen.getAllByTestId("profile-feed-item");
    expect(within(items[0]).getByRole("heading", { name: "How do you score a call summary?" })).toBeInTheDocument();
    expect(items[1].querySelector('[data-testid="map-card"]')).toBeNull();
    expect(items[4].querySelector('[data-testid="map-card"]')).not.toBeNull();
    expect(items[4].textContent).toMatch(/^Rebuilt from /);
  });

  it("a reply says Replied to @kit in <space>, linking to the reply", () => {
    mount();
    const replied = within(screen.getAllByTestId("profile-feed-item")[3]).getByTestId("profile-replied-to");
    expect(replied.textContent).toBe("Replied to @kit in Audio");
    expect(replied.getAttribute("href")).toBe("/openbuilds/topics/t-kit#reply-r-1");
  });

  it("a note is headed Reproduced @kit's Podcast clipper on Opus 5.5: it worked, the outcome in its own colour", () => {
    mount();
    const note = screen.getAllByTestId("profile-feed-item")[2];
    expect(note.textContent).toContain("Reproduced @kit's Podcast clipper on Opus 5.5: it worked");
    expect(within(note).getByText("it worked")).toBeInTheDocument();
  });

  it("keeps every card's own engagement and counts nothing new", () => {
    mount();
    const build = screen.getAllByTestId("profile-feed-item")[1];
    expect(within(build).getAllByRole("button").length).toBeGreaterThan(0);
  });
});

describe("how a build shows", () => {
  it("its own choice, then the owner's, then its first post when it has one, else its Map card", () => {
    expect(buildDisplayOf("map", "first_post", true)).toBe("map");
    expect(buildDisplayOf(null, "map", true)).toBe("map");
    expect(buildDisplayOf(null, "first_post", true)).toBe("first_post");
    expect(buildDisplayOf(null, "first_post", false)).toBe("map");
    expect(buildDisplayOf("first_post", null, false)).toBe("map");
  });

  it("the maker's ··· offers Show as first post and Show as Map card, and Pin to profile", async () => {
    const onDisplay = vi.fn();
    mount({ onDisplay }, true);
    const build = screen.getAllByTestId("profile-feed-item")[1];
    fireEvent.keyDown(within(build).getByRole("button", { name: /^More for / }), { key: "Enter" });
    await screen.findByRole("menuitem", { name: "Show as Map card" });
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Pin to profile", "Show as first post", "Show as Map card"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Show as Map card" }));
    expect(onDisplay).toHaveBeenCalledWith("call-notes", "map");
  });

  it("a pinned item offers Unpin on your own profile; a visitor has no ···", async () => {
    mount({}, true);
    fireEvent.keyDown(within(screen.getAllByTestId("profile-feed-item")[0]).getByRole("button", { name: /^More for / }), { key: "Enter" });
    expect(await screen.findByRole("menuitem", { name: "Unpin" })).toBeInTheDocument();
    cleanup();
    mount();
    expect(screen.queryByRole("button", { name: /^More for / })).toBeNull();
  });
});

describe("the filter", () => {
  it("hides an option with nothing in it, never All; at most five", () => {
    expect(feedOptions({ builds: 2, topics: 0, replies: 1, notes: 0 }).map((option) => option.label)).toEqual(["All", "Builds", "Replies"]);
    expect(feedOptions(null)).toHaveLength(5);
    mount();
    const group = screen.getByRole("radiogroup", { name: "Show" });
    expect(within(group).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["All", "Builds", "Topics", "Replies", "Notes"]);
  });

  it("opens on the owner's filter; ?show= overrides it; a hidden option falls back to All", () => {
    const counts = { builds: 2, topics: 3, replies: 0, notes: 1 };
    expect(shownFilter(null, "topics", counts)).toBe("topics");
    expect(shownFilter("notes", "topics", counts)).toBe("notes");
    expect(shownFilter("replies", "topics", counts)).toBe("all");
    expect(shownFilter("saves", "builds", counts)).toBe("builds");
  });

  it("asks for the new filter when a segment is chosen", () => {
    const onFilter = vi.fn();
    mount({ onFilter });
    fireEvent.click(screen.getByRole("radio", { name: "Notes" }));
    expect(onFilter).toHaveBeenCalledWith("notes");
  });
});

describe("an empty filter", () => {
  it("is one sentence and, on your own profile, one action", () => {
    expect(emptyFeed("builds", true)).toEqual({ line: "No builds yet.", action: { label: "New build", to: "/compose/new" } });
    expect(emptyFeed("topics", true)).toEqual({ line: "No topics yet.", action: { label: "New topic", to: "/openbuilds?new=1" } });
    expect(emptyFeed("replies", true)).toEqual({ line: "No replies yet.", action: null });
    expect(emptyFeed("notes", true)).toEqual({ line: "No notes yet.", action: null });
    expect(emptyFeed("builds", false).action).toBeNull();
  });

  it("draws as one dashed slot", () => {
    mount({ entries: [], filter: "builds", empty: emptyFeed("builds", true), hasMore: false });
    const slot = screen.getByTestId("profile-feed-empty");
    expect(slot.textContent).toContain("No builds yet.");
    expect(within(slot).getByRole("link", { name: "New build" })).toBeInTheDocument();
  });
});

describe("Show more", () => {
  it("is a control at the end while more can load; the feed says its size is not known yet", () => {
    const onMore = vi.fn();
    mount({ onMore });
    const feed = screen.getByRole("feed");
    expect(within(feed).getAllByRole("article")[0].getAttribute("aria-setsize")).toBe("-1");
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(onMore).toHaveBeenCalled();
  });

  it("each card is an article labelled by its heading", () => {
    const entries = profileEntries(profileItems);
    mount({ entries, hasMore: false });
    const articles = within(screen.getByRole("feed")).getAllByRole("article", { name: "How do you score a call summary?" });
    expect(articles.length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("profile-feed-item")[0].getAttribute("aria-setsize")).toBe(String(entries.length));
  });
});
