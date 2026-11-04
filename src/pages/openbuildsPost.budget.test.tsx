// The post page's choice budgets, counted in the rendered page (UX-06 Part 7) ⟦hicks-law › Enforcing It in the Code⟧.
//
// Exactly one primary in each state: reading (the reply box at the Thread's foot carries Reply), replying (the box under a reply,
// and none at the foot), and the Wall (Reply with a build). One Segmented, with at most two options. No control named Sort: the
// order is stated, Oldest first.

import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PostPageExtras } from "@/lib/openbuilds/postPage";

const getPost = vi.fn();
const readPostExtras = vi.fn();

vi.mock("@/lib/openbuilds", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/openbuilds")>()), getPost: (id: string) => getPost(id) }));
vi.mock("@/lib/openbuilds/postPage", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/openbuilds/postPage")>()), readPostExtras: (...args: unknown[]) => readPostExtras(...args) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" }, profile: null, loading: false, isLoggedIn: true }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/errors/report", () => ({ reportError: vi.fn() }));
vi.mock("@/hooks/useEngagement", () => ({ useEngagement: () => ({ counts: {}, liked: new Set(), saved: new Set(), loaded: true }), engagementFor: () => ({ counts: null, liked: false, saved: false }) }));

import PostPage from "@/pages/site/openbuilds/PostPage";
import { attachment, entry } from "@/pages/site/openbuilds/postModel.fixtures";

const card = (id: string) => ({ id, slug: id, title: id, madeWith: "Claude Code", status: "published", reproduction_count: 0, last_confirmed_at: null, last_confirmed_model: null, published_at: null });
const extras: PostPageExtras = {
  work: { builds: new Map([["b-kit", card("b-kit")]]), nodes: new Map() },
  signed: new Map(),
  facts: new Map(),
  steps: new Map(),
  liked: new Set(),
  crowd: null,
};

function renderPage(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/openbuilds/topics/:id" element={<PostPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

const primaries = () => document.querySelectorAll('[data-visual-slot="btn-primary"]');

describe("the post page's choice budgets", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    getPost.mockReset().mockResolvedValue(
      entry("p1", 120, {
        parentId: null,
        body: "Can anyone make the scorer faster?",
        replyCount: 3,
        replies: [entry("kit", 60, { attachments: [attachment("build", { buildId: "b-kit" })] }), entry("ola", 40), entry("jo", 20)],
      }),
    );
    readPostExtras.mockReset().mockResolvedValue(extras);
  });

  it("has exactly one primary while reading", async () => {
    renderPage("/openbuilds/topics/p1");
    await screen.findAllByTestId("reply");
    expect(primaries()).toHaveLength(1);
    expect(primaries()[0]).toHaveTextContent("Reply");
  });

  it("has exactly one primary while replying to a reply", async () => {
    renderPage("/openbuilds/topics/p1");
    const [kit] = await screen.findAllByTestId("reply");
    fireEvent.click(within(kit).getByRole("button", { name: "Reply" }));
    expect(screen.getAllByTestId("reply-box")).toHaveLength(1);
    expect(primaries()).toHaveLength(1);
  });

  it("has exactly one primary on the Wall", async () => {
    renderPage("/openbuilds/topics/p1?view=wall");
    await screen.findAllByTestId("wall-card");
    expect(primaries()).toHaveLength(1);
    expect(primaries()[0]).toHaveTextContent("Reply with a build");
  });

  it.each(["/openbuilds/topics/p1", "/openbuilds/topics/p1?view=wall"])("has one Segmented, with at most two options, at %s", async (path) => {
    renderPage(path);
    await screen.findByRole("heading", { level: 1 });
    const groups = document.querySelectorAll('[data-ui="segmented"]');
    expect(groups).toHaveLength(1);
    expect(within(groups[0] as HTMLElement).getAllByRole("button").length).toBeLessThanOrEqual(2);
  });

  it("has no control named Sort, and states the order", async () => {
    renderPage("/openbuilds/topics/p1");
    await screen.findAllByTestId("reply");
    expect(screen.queryAllByRole("button", { name: /sort/i })).toHaveLength(0);
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.getByText("Oldest first")).toBeInTheDocument();
  });
});
