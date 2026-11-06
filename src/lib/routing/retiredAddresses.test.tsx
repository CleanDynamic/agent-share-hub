// UX-11 P1: every retired address lands, in one hop, where that thing lives now, with its search string and hash kept.
// The real <App/> is rendered at the old address, so the table in src/App.tsx is what is under test, not a copy of it.
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/routing/RouteWarmup", () => ({ RouteWarmup: () => null }));
/* The redirect draws the new page's placeholder while it hands over; this test is about where the address goes, and the
   placeholders need the frame's providers, which the stand-in Layout below does not mount. */
vi.mock("@/lib/routing/RoutePlaceholder", () => ({ RoutePlaceholder: () => null }));
vi.mock("@/components/Layout", async () => {
  const { Outlet } = await import("react-router-dom");
  return { Layout: () => <Outlet /> };
});

import App from "@/App";

/** [old address, where it lands]. Search and hash ride along unless the row says otherwise. */
const RETIRED: ReadonlyArray<readonly [string, string]> = [
  // The Solvers board and the legacy leaderboard (UX-08 P5).
  ["/openbuilds/solvers", "/openbuilds"],
  ["/bounties/solvers", "/openbuilds"],
  ["/b/abc123/leaderboard", "/openbuilds"],
  // The old bounty form and the old conversion page (UX-11 P1).
  ["/bounty/new", "/compose/new"],
  ["/convert/abc123", "/drafts"],
  // Every form of the old bounty editor: with or without a draft id, it lands on Drafts (UX-11 follow-up).
  ["/drafts/posts", "/drafts"],
  // The requests page and a request's own page (UX-11): the request system is gone.
  ["/openbuilds/requests", "/openbuilds"],
  ["/openbuilds/abc123/solve", "/openbuilds"],
  ["/bounties/abc123/solve", "/openbuilds"],
  ["/upload/bounty", "/drafts"],
  ["/upload/bounty?id=draft-9", "/drafts"],
  // The older bounties and gallery addresses (SV-02).
  ["/bounties", "/openbuilds"],
  ["/gallery", "/builds"],
  // The old discovery addresses (RC-P05).
  ["/browse", "/builds"],
  ["/discover", "/builds"],
  ["/discover-legacy", "/builds"],
  ["/recent", "/builds"],
  ["/fyp", "/builds"],
  ["/feed", "/builds"],
  ["/category/agents", "/builds"],
  // The old maker and list addresses (RC-P22).
  ["/creator", "/profile"],
  ["/creator/maya", "/profile/maya"],
  ["/my-uploads", "/profile"],
  ["/saved", "/library"],
  // A topic is at /openbuilds/topics/:id (UX-05).
  ["/openbuilds/posts/t1", "/openbuilds/topics/t1"],
];

/** The history calls made since the last `openAt`: one hop is one replace and no push. */
const calls = { replaces: [] as string[], pushes: [] as string[] };
const realReplace = window.history.replaceState.bind(window.history);
const realPush = window.history.pushState.bind(window.history);
window.history.replaceState = (state, title, url) => {
  if (url != null) calls.replaces.push(String(url));
  realReplace(state, title, url);
};
window.history.pushState = (state, title, url) => {
  if (url != null) calls.pushes.push(String(url));
  realPush(state, title, url);
};

function openAt(address: string) {
  realReplace({}, "", address);
  calls.replaces.length = 0;
  calls.pushes.length = 0;
  return render(<App />);
}

describe("UX-11 P1 · retired addresses", () => {
  it.each(RETIRED)("%s lands on %s, replacing the entry, in one hop", async (from, to) => {
    const view = openAt(from);
    await waitFor(() => expect(window.location.pathname).toBe(to));
    // One hop: the history entry is replaced once, never pushed, and nothing passes through a third address.
    expect(calls.pushes).toEqual([]);
    expect(calls.replaces.filter((url) => url !== from)).toEqual([to]);
    view.unmount();
  });

  it.each([
    ["/browse?q=agents#top", "/builds?q=agents#top"],
    ["/gallery?q=x", "/builds?q=x"],
    ["/bounty/new?x=1", "/compose/new?x=1"],
    ["/convert/abc?x=1", "/drafts?x=1"],
    ["/openbuilds/solvers?x=1#y", "/openbuilds?x=1#y"],
  ])("%s keeps its search string and hash: %s", async (from, to) => {
    const view = openAt(from);
    await waitFor(() => expect(window.location.pathname + window.location.search + window.location.hash).toBe(to));
    view.unmount();
  });
});
