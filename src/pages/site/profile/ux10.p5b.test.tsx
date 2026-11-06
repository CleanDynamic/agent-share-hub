// UX-10 P5b: followers and following: both lists, paging, the follow buttons, a private profile and an empty list; the page reads
// one request per page, with the follow states in it.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { trailFor } from "@/components/shell/breadcrumbTrail";
import { matchRoute } from "@/lib/routing/routeTable";

import { FollowListView, followEmpty, followTitle, type FollowListViewProps, type FollowRowView } from "./FollowListView";

const lists = vi.hoisted(() => ({ calls: [] as unknown[][], pages: new Map<string | null, unknown>() }));
const follow = vi.hoisted(() => ({ follow: vi.fn(async () => undefined), unfollow: vi.fn(async () => undefined) }));

vi.mock("@/lib/profile/followLists", () => ({
  FOLLOWS_PAGE: 30,
  listProfileFollows: vi.fn(async (...args: unknown[]) => {
    lists.calls.push(args);
    return lists.pages.get((args[2] as string | null) ?? null) ?? { people: [], next: null };
  }),
}));
vi.mock("@/lib/profile/getProfileSummary", () => ({
  getProfileSummary: vi.fn(async () => ({ id: "u-maya", handle: "maya", isPrivate: false, isOwnProfile: false, isFollowing: false, counts: { followers: 31, following: 4 } })),
}));
vi.mock("@/lib/profile/follow", () => ({ followMaker: follow.follow, unfollowMaker: follow.unfollow }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u-me" }, loading: false }) }));

import { FollowListPage } from "./FollowListPage";

afterEach(cleanup);
beforeEach(() => {
  lists.calls = [];
  lists.pages = new Map();
  follow.follow.mockClear();
});

const person = (n: number, over: Partial<FollowRowView> = {}): FollowRowView => ({ id: `p${n}`, handle: `p${n}`, name: `Person ${n}`, avatarUrl: null, line: `Line ${n}`, readerFollows: false, isReader: false, ...over });

const view = (over: Partial<FollowListViewProps> = {}) =>
  render(
    <MemoryRouter>
      <FollowListView handle="maya" which="followers" total={31} status="ready" people={[person(1), person(2, { readerFollows: true }), person(3, { isReader: true })]} hasMore={false} loadingMore={false} onMore={vi.fn()} onFollow={vi.fn()} onRetry={vi.fn()} {...over} />
    </MemoryRouter>,
  );

describe("the view", () => {
  it("titles both lists, with the count in label", () => {
    expect(followTitle("followers", "maya")).toBe("@maya's followers");
    expect(followTitle("following", "maya")).toBe("People @maya follows");
    view();
    expect(screen.getByRole("heading", { level: 1, name: "@maya's followers" })).toBeInTheDocument();
    expect(screen.getByText("31")).toBeInTheDocument();
  });

  it("each person: name, @handle and their one line; Follow or Following for all but the reader", () => {
    view();
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByRole("link").getAttribute("href")).toBe("/profile/p1");
    expect(rows[0].textContent).toContain("Line 1");
    expect(within(rows[0]).getByRole("button", { name: "Follow" })).toBeInTheDocument();
    expect(within(rows[1]).getByRole("button", { name: "Following" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(rows[2]).queryByRole("button")).toBeNull();
  });

  it("is empty in one line, and private in the profile's sentence", () => {
    expect(followEmpty("following")).toBe("Not following anyone yet.");
    view({ people: [] });
    expect(screen.getByTestId("follow-empty").textContent).toBe("No followers yet.");
    cleanup();
    view({ status: "private", people: [] });
    expect(screen.getByText("@maya's profile is private.")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("offers Show more when there is more", () => {
    const onMore = vi.fn();
    view({ hasMore: true, onMore });
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(onMore).toHaveBeenCalled();
  });
});

const page = (which: "followers" | "following") =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/profile/maya/${which}`]}>
        <Routes>
          <Route path="/profile/:handle/followers" element={<FollowListPage which="followers" />} />
          <Route path="/profile/:handle/following" element={<FollowListPage which="following" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const wire = (n: number) => ({ id: `p${n}`, handle: `p${n}`, name: `Person ${n}`, avatarUrl: null, line: null, at: `2026-01-${String(30 - n).padStart(2, "0")}T00:00:00Z`, readerFollows: false });

describe("the page", () => {
  it("reads one request per page, newest first, and Show more reads the next", async () => {
    lists.pages.set(null, { people: [wire(1), wire(2)], next: "2026-01-28T00:00:00Z" });
    lists.pages.set("2026-01-28T00:00:00Z", { people: [wire(3)], next: null });
    page("followers");
    await screen.findByText("Person 1");
    expect(lists.calls).toEqual([["maya", "followers", null]]);
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    await screen.findByText("Person 3");
    expect(lists.calls).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("Follow changes the row at once and writes the follow", async () => {
    lists.pages.set(null, { people: [wire(1)], next: null });
    page("following");
    await screen.findByText("Person 1");
    fireEvent.click(screen.getByRole("button", { name: "Follow" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Following" })).toBeInTheDocument());
    expect(follow.follow).toHaveBeenCalledWith("u-me", "p1");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("People @maya follows");
  });
});

describe("the addresses", () => {
  it("are in the route table, and the trail is @maya / Followers", () => {
    expect(matchRoute("/profile/maya/followers")?.entry.key).toBe("followers");
    expect(matchRoute("/profile/maya/following")?.entry.key).toBe("following");
    expect(matchRoute("/profile/maya")?.entry.key).toBe("profile");
    expect(trailFor("/profile/maya/followers", "@maya").slice(1)).toEqual([{ label: "@maya", href: "/profile/maya" }, { label: "Followers" }]);
  });
});
