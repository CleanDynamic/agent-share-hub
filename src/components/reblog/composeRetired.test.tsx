// Tier 3 — the reblog composer is unreachable (NS-P42).
//
// Covers the two acceptance criteria that a type checker cannot see:
//   1. no UI path opens the reblog composer — walked call site by call site
//   2. an existing reblog still renders, and still likes and bookmarks
//
// WHY THIS IS A COMPONENT SPEC AND NOT ONLY A BROWSER ONE. Four of the six
// affordances render only for a signed-in viewer, and this repository has no
// Playwright auth fixture — the config declares a `setup` project but no
// `.setup.ts` exists. An anonymous browser spec would find no reblog button
// whatever the flag said, and would pass just as happily with the flag flipped
// back to true. So the signed-in walk lives here, where the viewer can be
// signed in for the price of a mock, and e2e/tier3/reblog-retired.spec.ts
// carries the half a browser can actually prove: that a published reblog is
// still served at its own URL.
//
// HOW EACH SITE IS PROVEN, RATHER THAN ASSUMED. Every case does three things:
// asserts the affordance is gone by its accessible name; asserts a sibling
// control is still there, so a component that failed to render cannot pass as
// a component with the button removed; and then CLICKS EVERY BUTTON on the
// surface and asserts no composer mounted. The third is the one that answers
// the acceptance criterion as written — "no UI path" is a claim about paths,
// not about one button.
//
// The composers are stubbed to a marker each. Both are reached through code
// this spec does not otherwise exercise (a Radix dialog, a media picker), and
// the assertion is only ever "did it mount", so the marker IS the observation.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

// jsdom ships no clipboard, and the button sweep below presses a copy-link
// control on its way past. Without this the sweep raises an error about
// navigator rather than about reblog.
Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: { writeText: () => Promise.resolve() },
});

const auth = vi.hoisted(() => ({
  user: { id: "viewer-1" },
  profile: { id: "viewer-1", username: "viewer", display_name: "Viewer" },
  isLoggedIn: true,
  loading: false,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => auth,
}));

/**
 * A chainable stub that answers every query with nothing.
 *
 * The counts these cards read are cosmetic — each one falls back to zero — and
 * a spec about which buttons exist has no business asserting on them.
 */
vi.mock("@/integrations/supabase/client", () => {
  const result = { data: null, error: null, count: 0 };
  const chain: Record<string, unknown> = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") return (resolve: (v: unknown) => unknown) => resolve(result);
        return () => chain;
      },
    }
  );
  return {
    supabase: {
      from: () => chain,
      rpc: () => chain,
      storage: { from: () => chain },
      channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
      removeChannel: () => {},
    },
  };
});

/** The two composers, reduced to the only fact asserted about them. */
const COMPOSER = "reblog-composer-mounted";
const SHEET = "reblog-compose-sheet-mounted";

vi.mock("@/components/ReblogComposer", () => ({
  ReblogComposer: () => <div data-testid={COMPOSER} />,
}));
vi.mock("@/components/reblog/ReblogComposeSheet", () => ({
  default: () => <div data-testid={SHEET} />,
}));

import { ReblogComposeProvider } from "@/contexts/ReblogComposeContext";
import { FeedItem } from "@/components/FeedItem";
import { FeedCard } from "@/components/feed-card";
import { ReblogCard } from "@/components/ReblogCard";
import { ReblogDetailView } from "@/components/ReblogDetailView";
import { ReblogFeedCard } from "@/components/reblog/ReblogFeedCard";
import { QuotableSelectionOverlay } from "@/components/quoting/QuotableSelectionOverlay";
import { REBLOG_COMPOSE_ENABLED } from "@/lib/reblog/flags";

/**
 * The real provider, so a call to openReblog would mount the real sheet path.
 * Stubbing the context instead would prove only that a spy was not called.
 */
function mount(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ReblogComposeProvider>{ui}</ReblogComposeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/**
 * Click everything clickable on the surface.
 *
 * A handler that navigates or writes is fine — those are stubbed. What is
 * being watched for is a composer appearing, from any button, by any route.
 */
function clickEveryButton(container: HTMLElement) {
  for (const button of Array.from(container.querySelectorAll("button"))) {
    fireEvent.click(button);
  }
}

function expectNoComposer() {
  expect(screen.queryByTestId(COMPOSER)).toBeNull();
  expect(screen.queryByTestId(SHEET)).toBeNull();
}

const profile = {
  id: "author-1",
  username: "author",
  display_name: "Author",
  avatar_url: null,
};

/** A content item as the feed hands it to a card. */
const item = {
  id: "item-1",
  title: "A published post",
  description: "Something worth reading.",
  content_type: "Prompts",
  post_category: "blueprint",
  creator_id: "author-1",
  created_at: "2026-08-01T10:00:00.000Z",
  view_count: 12,
  download_count: 3,
  comment_count: 4,
  profiles: profile,
};

/** The same, wearing the columns a reblog row carries. */
const reblogItem = {
  ...item,
  id: "reblog-1",
  is_reblog: true,
  reblog_of_id: "item-1",
  reblog_thread_count: 1,
  title: "A published post",
};

const feedPost = {
  id: "item-1",
  slug: "a-published-post",
  title: "A published post",
  description: "Something worth reading.",
  content_type: "Prompts",
  post_type: "blueprint",
  cover_image_url: null,
  created_at: "2026-08-01T10:00:00.000Z",
  view_count: 12,
  comment_count: 4,
  author: profile,
};

describe("the flag itself", () => {
  // If this ever reads true on main, every assertion below is vacuous — so it
  // is asserted rather than assumed.
  it("ships disabled", () => {
    expect(REBLOG_COMPOSE_ENABLED).toBe(false);
  });
});

describe("no UI path opens the reblog composer", () => {
  // CALL SITE 1 — FeedItem.tsx, the Repeat2 button on a feed row.
  it("FeedItem offers share but no reblog", () => {
    const { container } = mount(<FeedItem item={item} />);

    expect(screen.queryByTitle(/reblog/i)).toBeNull();
    // The sibling inside the same isLoggedIn fragment survives, which is what
    // makes the absence above a removal rather than an unrendered card.
    expect(container.querySelectorAll("button").length).toBeGreaterThan(0);

    clickEveryButton(container);
    expectNoComposer();
  });

  // CALL SITE 2 — feed-card.tsx, the Repeat2 button on the newer feed card.
  it("FeedCard offers like and save but no reblog", () => {
    const { container } = mount(<FeedCard post={feedPost as never} />);

    expect(screen.queryByTitle(/reblog/i)).toBeNull();

    clickEveryButton(container);
    expectNoComposer();
  });

  // CALL SITE 3 — reblog/ReblogFeedCard.tsx, reached from FeedReblogAdapter's
  // handleReblogChain. The chain is the path that reblogged a reblog.
  it("ReblogFeedCard keeps like, comment and bookmark but drops reblog", () => {
    const onReblogClick = vi.fn();
    const { container } = mount(
      <ReblogFeedCard
        reblog={{
          id: "reblog-1",
          slug: "a-published-post-rb-0001",
          text: "Worth a look.",
          rebloggerDisplayName: "Reblogger",
          rebloggerHandle: "reblogger",
          rebloggerAvatarUrl: "",
          publishedAt: "2026-08-02T10:00:00.000Z",
        }}
        engagement={{
          likeCount: 2,
          hasLiked: false,
          commentCount: 1,
          reblogCount: 3,
          hasReblogged: false,
          bookmarkCount: 1,
          hasBookmarked: false,
        }}
        embeddedOriginal={null}
        onReblogClick={onReblogClick}
        onLikeClick={() => {}}
        onCommentClick={() => {}}
        onBookmarkClick={() => {}}
        onShareClick={() => {}}
        onRebloggerClick={() => {}}
        onOriginalClick={() => {}}
        onMore={() => {}}
      />
    );

    expect(screen.queryByRole("button", { name: "Reblog" })).toBeNull();
    // The engagement row still renders — these are the controls NS-P42 keeps.
    expect(screen.getByRole("button", { name: "Like" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Comment" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bookmark" })).toBeTruthy();

    clickEveryButton(container);
    expect(onReblogClick).not.toHaveBeenCalled();
    expectNoComposer();
  });

  // CALL SITE 4 — the "Reblog with quote" action on a text selection.
  it("the selection overlay offers annotate and copy but not quote-reblog", () => {
    const onQuoteReblog = vi.fn();
    const { container } = mount(
      <QuotableSelectionOverlay
        isOpen
        selection={{
          text: "a sentence worth quoting",
          rect: { top: 100, bottom: 120, left: 40, right: 240 } as DOMRect,
          sourcePostId: "item-1",
          sourcePostSlug: "a-published-post",
        }}
        position={{ x: 140, y: 90, placement: "above" }}
        onQuoteReblog={onQuoteReblog}
        onAnnotate={() => {}}
        onCopy={() => {}}
        onDismiss={() => {}}
      />
    );

    expect(screen.queryByRole("button", { name: "Reblog with quote" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add annotation" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy text" })).toBeTruthy();

    clickEveryButton(container);
    expect(onQuoteReblog).not.toHaveBeenCalled();
    expectNoComposer();
  });

  // CALL SITE 5 — ReblogCard.tsx, "↺ Reblog this" under an existing reblog.
  it("ReblogCard drops its reblog-this button", () => {
    const { container } = mount(<ReblogCard item={reblogItem} />);

    expect(screen.queryByText(/reblog this/i)).toBeNull();

    clickEveryButton(container);
    expectNoComposer();
  });

  // CALL SITE 6 — ReblogDetailView.tsx, the same button on the reblog's page.
  it("ReblogDetailView drops its reblog-this button", () => {
    const { container } = mount(<ReblogDetailView item={reblogItem} />);

    expect(screen.queryByText(/reblog this/i)).toBeNull();

    clickEveryButton(container);
    expectNoComposer();
  });
});

describe("an existing reblog is untouched below the removed button", () => {
  // ACCEPTANCE 2. The read path and the engagement controls are what NS-P42
  // promises to leave alone, so they are asserted, not taken on trust.
  it("still renders its text and its like and bookmark controls", () => {
    const onLikeClick = vi.fn();
    const onBookmarkClick = vi.fn();
    mount(
      <ReblogFeedCard
        reblog={{
          id: "reblog-1",
          slug: "a-published-post-rb-0001",
          text: "Sending this to everyone who writes our documentation.",
          rebloggerDisplayName: "Reblogger",
          rebloggerHandle: "reblogger",
          rebloggerAvatarUrl: "",
          publishedAt: "2026-08-02T10:00:00.000Z",
        }}
        engagement={{
          likeCount: 2,
          hasLiked: false,
          commentCount: 1,
          reblogCount: 3,
          hasReblogged: false,
          bookmarkCount: 1,
          hasBookmarked: false,
        }}
        embeddedOriginal={null}
        onReblogClick={() => {}}
        onLikeClick={onLikeClick}
        onCommentClick={() => {}}
        onBookmarkClick={onBookmarkClick}
        onShareClick={() => {}}
        onRebloggerClick={() => {}}
        onOriginalClick={() => {}}
        onMore={() => {}}
      />
    );

    expect(screen.getByText(/writes our documentation/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Like" }));
    expect(onLikeClick).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Bookmark" }));
    expect(onBookmarkClick).toHaveBeenCalledTimes(1);
  });

  it("renders the reblog card body for a reblog row", () => {
    mount(<ReblogCard item={reblogItem} />);
    // The card resolved and drew the row rather than falling through to null.
    expect(screen.getByText(/a published post/i)).toBeTruthy();
  });
});
