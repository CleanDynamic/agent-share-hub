// The solvers board's choice budgets, counted in the rendered page (RC-P13)
// ⟦hicks-law › Enforcing It in the Code⟧.
//
// The order is stated, never offered: no sort control and no time range. No
// filled button while it has rows, at most 25 rows, and exactly one control
// per row, the solver's name.

import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listTopSolvers = vi.fn();

vi.mock("@/lib/bounty", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/bounty")>()),
  listTopSolvers: (options: unknown) => listTopSolvers(options),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import Solvers from "@/pages/Solvers";

const TWENTY_FIVE = Array.from({ length: 25 }, (_, n) => ({
  id: `solver-${n}`,
  username: `solver${n}`,
  display_name: `Solver ${n}`,
  avatar_url: null,
  solved: 30 - n,
  rewardTotalGbp: n % 2 === 0 ? 50 : null,
  lastSolvedAt: "2026-09-20T10:00:00.000Z",
}));

function renderBoard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/bounties/solvers"]}>
          <Solvers />
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

describe("the solvers board's choice budgets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
    listTopSolvers.mockResolvedValue(TWENTY_FIVE);
  });

  it("has no sort control and no time-range control", async () => {
    renderBoard();
    await screen.findAllByTestId("solver-row");

    const named = /sort|order|time|range|week|month|year|all time/i;
    expect(screen.queryAllByRole("button", { name: named })).toHaveLength(0);
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.queryAllByRole("radiogroup")).toHaveLength(0);
    expect(screen.queryAllByRole("tablist")).toHaveLength(0);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("has no filled button while it has rows", async () => {
    renderBoard();
    await screen.findAllByTestId("solver-row");

    expect(document.querySelectorAll('[data-visual-slot="btn-primary"]')).toHaveLength(0);
  });

  it("shows at most 25 solvers", async () => {
    renderBoard();

    expect(await screen.findAllByTestId("solver-row")).toHaveLength(25);
    expect(listTopSolvers).toHaveBeenCalledWith({ limit: 25 });
  });

  it("gives each row exactly one control that goes anywhere: the solver's profile", async () => {
    renderBoard();
    const rows = await screen.findAllByTestId("solver-row");

    for (const [index, row] of rows.entries()) {
      const controls = [...within(row).queryAllByRole("link"), ...within(row).queryAllByRole("button")];
      expect(controls).toHaveLength(1);
      expect(controls[0]).toHaveAttribute("href", `/profile/solver${index}`);
    }
  });
});
