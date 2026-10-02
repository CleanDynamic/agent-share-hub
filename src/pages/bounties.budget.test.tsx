// The bounties board's choice budgets, counted in the rendered page (RC-P12)
// ⟦hicks-law › Enforcing It in the Code⟧.
//
// REWRITTEN FOR UI-P33 (the board became a wall of vacant frames with a solve
// panel; the facet group, the lens row and the "Open the build" rows it counted no
// longer exist) and kept for UI-P37. What the old budget stood for stands: one
// switch for the order (three options), one for the board (two), no filled button
// while there are asks, exactly one control per ask, and no other way out.

import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listOpenBountyCards = vi.fn();
const bountyFacetsMadeWith = vi.fn();

vi.mock("@/lib/bounty", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/bounty")>()),
  listOpenBountyCards: (options: unknown) => listOpenBountyCards(options),
  bountyFacetsMadeWith: () => bountyFacetsMadeWith(),
  listTopSolvers: () => Promise.resolve([]),
  myMeToo: () => Promise.resolve(new Set()),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import Bounties from "@/pages/Bounties";

function card(n: number, reward: number | null = 50) {
  return {
    bounty: {
      id: `bounty-${n}`,
      build_id: `build-${n}`,
      gap_node_id: `node-${n}`,
      reward_gbp: reward,
      status: "open",
      created_at: `2026-09-${String(20 - n).padStart(2, "0")}T10:00:00.000Z`,
    },
    build: { id: `build-${n}`, slug: `build-${n}`, title: `Build ${n}`, made_with: ["Claude"] },
    author: { username: `maker${n}`, display_name: `Maker ${n}`, avatar_url: null },
    gapTitle: `Gap ${n}`,
    solutions: n,
  };
}

function renderBoard(width = 1440) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/bounties"]}>
          <Bounties />
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

describe("the bounties board's choice budgets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bountyFacetsMadeWith.mockResolvedValue([]);
    listOpenBountyCards.mockResolvedValue({
      cards: [card(1), card(2, null), card(3)],
      nextCursor: null,
    });
  });

  it("has one order switch of three and one board switch of two", async () => {
    renderBoard();
    await screen.findAllByTestId("bounty-row");

    const sort = screen.getByRole("group", { name: "Sort by" });
    expect(within(sort).getAllByRole("button")).toHaveLength(3);
    const board = screen.getByRole("group", { name: "Board" });
    expect(within(board).getAllByRole("link")).toHaveLength(2);
  });

  it("has no filled button while it has asks", async () => {
    renderBoard();
    await screen.findAllByTestId("bounty-row");

    expect(document.querySelectorAll('[data-visual-slot="btn-primary"]')).toHaveLength(0);
  });

  it("gives each ask exactly one control", async () => {
    renderBoard();
    const rows = await screen.findAllByTestId("bounty-row");

    for (const row of rows) {
      const controls = [...within(row).queryAllByRole("link"), ...within(row).queryAllByRole("button")];
      expect(controls).toHaveLength(1);
    }
  });
});
