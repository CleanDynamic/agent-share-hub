// The OpenBuilds feed's choice budgets, counted in the rendered page (UX-05 Part 2)
// ⟦hicks-law › Enforcing It in the Code⟧.
//
// Exactly one primary. At most two tabs. One Segmented with two options. No control named Sort (the order is stated:
// Newest first). One heading link per post card.

import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listPostCards = vi.fn();

vi.mock("@/lib/openbuilds", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/openbuilds")>()),
  listPostCards: (options: unknown) => listPostCards(options),
  listMySpaces: async () => [{ id: "s1", slug: "claude-code", name: "Claude Code", whoCanPost: "anyone", role: "member" }],
  listBusySpaces: async () => [],
  listRecentPostTimes: async () => ({}),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" }, loading: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useEngagement", () => ({ useEngagement: () => ({ counts: {}, liked: new Set(), saved: new Set(), loaded: true }), engagementFor: () => ({ counts: null, liked: false, saved: false }) }));

import OpenBuildsFeedPage from "@/pages/site/openbuilds/OpenBuildsFeedPage";

const post = (n: number) => ({
  id: `p${n}`,
  authorId: "u1",
  parentId: null,
  rootId: `p${n}`,
  body: `Post number ${n}\nSome words`,
  aboutBuildId: null,
  aboutNodeId: null,
  rewardGbp: null,
  stillOpen: false,
  tags: [],
  closesAt: null,
  pinnedBy: null,
  pinnedAt: null,
  hiddenBy: null,
  hiddenReason: null,
  likeCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  author: { id: "u1", handle: "sam", name: "Sam", avatarUrl: null },
  attachments: [],
  spaces: [],
  replyCount: n % 2,
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/openbuilds"]}>
          <OpenBuildsFeedPage />
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

describe("the OpenBuilds feed's choice budgets", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    listPostCards.mockReset().mockResolvedValue({ posts: Array.from({ length: 5 }, (_, n) => post(n + 1)), next: null, extras: { work: { builds: new Map(), nodes: new Map() }, digests: new Map(), signed: new Map() } });
  });

  it("has exactly one primary", async () => {
    renderPage();
    await screen.findAllByRole("article");
    expect(document.querySelectorAll('[data-visual-slot="btn-primary"]')).toHaveLength(1);
  });

  it("has at most two tabs", async () => {
    renderPage();
    await screen.findAllByRole("article");
    expect(screen.getAllByRole("tab").length).toBeLessThanOrEqual(2);
  });

  it("has one Segmented, with two options", async () => {
    renderPage();
    await screen.findAllByRole("article");
    const groups = document.querySelectorAll('[data-ui="segmented"], [role="group"][aria-label="Show"]');
    expect(groups).toHaveLength(1);
    expect(within(groups[0] as HTMLElement).getAllByRole("button")).toHaveLength(2);
  });

  it("has no control named Sort", async () => {
    renderPage();
    await screen.findAllByRole("article");
    expect(screen.queryAllByRole("button", { name: /sort/i })).toHaveLength(0);
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.getByText("Newest first")).toBeInTheDocument();
  });

  it("has one heading link per post card, and no other link to a post besides the replies strip", async () => {
    renderPage();
    const articles = await screen.findAllByRole("article");
    for (const article of articles) {
      expect(within(article).getAllByTestId("post-card-heading-link")).toHaveLength(1);
      const toPost = within(article).queryAllByRole("link").filter((link) => /^\/openbuilds\/posts\//.test(link.getAttribute("href") ?? ""));
      expect(toPost.length).toBeLessThanOrEqual(2);
    }
  });
});
