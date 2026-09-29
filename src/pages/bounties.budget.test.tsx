// The bounties board's choice budgets, counted in the rendered page (RC-P12)
// ⟦hicks-law › Enforcing It in the Code⟧.
//
// One facet group, six options before More, no sort control, no filled button
// while there are rows, and exactly one control per row that goes anywhere.
// RC-P13 adds one text link at the trailing end of the title row, Solvers, and
// nothing else: the page's only way out that is not a row.

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
}));
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
    bountyFacetsMadeWith.mockResolvedValue(
      ["Claude", "n8n", "Zapier", "Gmail", "Sheets", "Xero", "ChatGPT", "Make"].map((value, i) => ({
        value,
        count: 10 - i,
      })),
    );
    listOpenBountyCards.mockResolvedValue({
      cards: [card(1), card(2, null), card(3)],
      nextCursor: null,
    });
  });

  it("has exactly one facet group, Made with, showing at most six options before More", async () => {
    renderBoard();
    await screen.findAllByTestId("bounty-row");

    const groups = within(screen.getByRole("region", { name: "Filters" })).getAllByRole("group");
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveTextContent("Made with");

    const options = within(groups[0])
      .getAllByRole("button")
      .filter((element) => element.hasAttribute("aria-pressed"));
    expect(options.length).toBeLessThanOrEqual(6);
    expect(within(groups[0]).getByRole("button", { name: "More" })).toBeInTheDocument();
  });

  it("has no sort control and no lens row", async () => {
    renderBoard();
    await screen.findAllByTestId("bounty-row");

    expect(screen.queryAllByRole("button", { name: /sort/i })).toHaveLength(0);
    expect(screen.queryAllByRole("combobox", { name: /sort/i })).toHaveLength(0);
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("has no filled button while it has rows", async () => {
    renderBoard();
    await screen.findAllByTestId("bounty-row");

    expect(document.querySelectorAll('[data-visual-slot="btn-primary"]')).toHaveLength(0);
  });

  it("has one text link beside the title, Solvers, to the solvers board (RC-P13)", async () => {
    renderBoard();
    await screen.findAllByTestId("bounty-row");

    const header = screen.getByRole("banner");
    const links = within(header).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("Solvers");
    expect(links[0]).toHaveAttribute("href", "/bounties/solvers");
    expect(within(header).queryAllByRole("button")).toHaveLength(0);
  });

  it("gives each row exactly one control that goes anywhere: Open the build", async () => {
    renderBoard();
    const rows = await screen.findAllByTestId("bounty-row");

    for (const row of rows) {
      const controls = [
        ...within(row).queryAllByRole("link"),
        ...within(row).queryAllByRole("button"),
      ];
      expect(controls).toHaveLength(1);
      expect(controls[0]).toHaveTextContent("Open the build");
    }
    expect(within(rows[0]).getByRole("link")).toHaveAttribute("href", "/b2/build-1");
  });
});
