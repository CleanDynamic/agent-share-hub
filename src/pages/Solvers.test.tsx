// The solvers board, rendered (RC-P13): the ranking in the order it arrives,
// the tally with and without a reward total, the phone reflow, and the three
// states a board without rows can be in.

import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Solver } from "@/lib/bounty";

const listTopSolvers = vi.fn();

vi.mock("@/lib/bounty", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/bounty")>()),
  listTopSolvers: (options: unknown) => listTopSolvers(options),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import Solvers from "@/pages/Solvers";

function solver(n: number, over: Partial<Solver> = {}): Solver {
  return {
    id: `solver-${n}`,
    username: `solver${n}`,
    display_name: `Solver ${n}`,
    avatar_url: null,
    solved: 10 - n,
    rewardTotalGbp: 100,
    lastSolvedAt: "2026-09-20T10:00:00.000Z",
    ...over,
  };
}

function renderBoard(width = 1440) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
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

describe("the solvers board", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("states its order in one sentence under the title", async () => {
    listTopSolvers.mockResolvedValue([solver(1)]);
    renderBoard();

    expect(screen.getByRole("heading", { level: 1, name: "Solvers" })).toBeInTheDocument();
    expect(
      screen.getByText("People whose solutions were accepted. Most solved first."),
    ).toBeInTheDocument();
    await screen.findAllByTestId("solver-row");
  });

  it("asks for the board's 25", async () => {
    listTopSolvers.mockResolvedValue([solver(1)]);
    renderBoard();
    await screen.findAllByTestId("solver-row");

    expect(listTopSolvers).toHaveBeenCalledTimes(1);
    expect(listTopSolvers).toHaveBeenCalledWith({ limit: 25 });
  });

  it("lists solvers in the order they arrive, numbered from 1", async () => {
    listTopSolvers.mockResolvedValue([solver(3), solver(1), solver(2)]);
    renderBoard();

    const rows = await screen.findAllByTestId("solver-row");
    expect(rows.map((row) => within(row).getByTestId("solver-position").textContent)).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(rows.map((row) => within(row).getByRole("link").textContent)).toEqual([
      expect.stringContaining("Solver 3"),
      expect.stringContaining("Solver 1"),
      expect.stringContaining("Solver 2"),
    ]);
  });

  it("links each solver's name to their profile", async () => {
    listTopSolvers.mockResolvedValue([solver(1)]);
    renderBoard();

    const row = (await screen.findAllByTestId("solver-row"))[0];
    const link = within(row).getByRole("link");
    expect(link).toHaveAttribute("href", "/profile/solver1");
    expect(link).toHaveTextContent("Solver 1");
    expect(link).toHaveTextContent("@solver1");
  });

  it("shows how many each solved, and the total only when their bounties named a reward", async () => {
    listTopSolvers.mockResolvedValue([
      solver(1, { solved: 12, rewardTotalGbp: 1250 }),
      solver(2, { solved: 9, rewardTotalGbp: 480.5 }),
      solver(3, { solved: 7, rewardTotalGbp: null }),
      solver(4, { solved: 1, rewardTotalGbp: 0 }),
    ]);
    renderBoard();

    const rows = await screen.findAllByTestId("solver-row");
    expect(rows.map((row) => within(row).getByTestId("solver-solved").textContent)).toEqual([
      "12 solved",
      "9 solved",
      "7 solved",
      "1 solved",
    ]);
    expect(within(rows[0]).getByTestId("solver-reward")).toHaveTextContent("£1,250 in rewards");
    expect(within(rows[1]).getByTestId("solver-reward")).toHaveTextContent("£480.50 in rewards");
    expect(within(rows[2]).queryByTestId("solver-reward")).toBeNull();
    expect(within(rows[3]).queryByTestId("solver-reward")).toBeNull();
  });

  it("keeps a solver with no handle in their place, unlinked", async () => {
    listTopSolvers.mockResolvedValue([solver(1), solver(2, { username: null }), solver(3)]);
    renderBoard();

    const rows = await screen.findAllByTestId("solver-row");
    expect(within(rows[1]).getByTestId("solver-position")).toHaveTextContent("2");
    expect(within(rows[1]).getByTestId("solver-maker")).toHaveTextContent("Solver 2");
    expect(within(rows[1]).queryByRole("link")).toBeNull();
  });

  it("sets positions and tallies in DM Mono with tabular figures", async () => {
    listTopSolvers.mockResolvedValue([solver(1)]);
    renderBoard();

    const row = (await screen.findAllByTestId("solver-row"))[0];
    for (const testId of ["solver-position", "solver-solved", "solver-reward"]) {
      const element = within(row).getByTestId(testId);
      expect(element.style.fontFamily).toContain("DM Mono");
      expect(element.style.fontVariantNumeric).toBe("tabular-nums");
    }
  });

  it("lays each row out on its own three columns on a wide screen", async () => {
    listTopSolvers.mockResolvedValue([solver(1)]);
    renderBoard(1440);

    const row = (await screen.findAllByTestId("solver-row"))[0];
    expect(row.style.display).toBe("grid");
    expect(row.style.gridTemplateColumns).toBe("40px minmax(0, 1fr) auto");
    expect(row.style.columnGap).toBe("16px");
    expect(within(row).getByTestId("solver-tally").style.gridColumn).toBe("");
  });

  it("moves the tally under the name below 768", async () => {
    listTopSolvers.mockResolvedValue([solver(1)]);
    renderBoard(390);

    const row = (await screen.findAllByTestId("solver-row"))[0];
    expect(row.style.gridTemplateColumns).toBe("40px minmax(0, 1fr)");
    expect(within(row).getByTestId("solver-tally").style.gridColumn).toBe("2");
  });

  it("says so in one sentence, with one way to the open bounties, when nobody has solved one", async () => {
    listTopSolvers.mockResolvedValue([]);
    renderBoard();

    const empty = await screen.findByTestId("solvers-empty");
    expect(empty).toHaveTextContent("Nobody has solved a bounty yet.");
    const actions = within(empty).getAllByRole("button");
    expect(actions).toHaveLength(1);
    expect(actions[0]).toHaveTextContent("See open bounties");
    expect(screen.queryByTestId("solvers-board")).toBeNull();
  });

  it("says a refusal is a refusal, not an empty board", async () => {
    const refused = Object.assign(new Error("listTopSolvers failed: permission denied"), {
      cause: { code: "42501" },
    });
    listTopSolvers.mockRejectedValue(refused);
    renderBoard();

    const error = await screen.findByTestId("solvers-error");
    expect(error).toHaveTextContent("You don't have access to this.");
    expect(within(error).getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByTestId("solvers-empty")).toBeNull();
  });

  it("says something went wrong on any other failure, and Try again asks again", async () => {
    listTopSolvers.mockRejectedValueOnce(new Error("listTopSolvers failed: network"));
    listTopSolvers.mockResolvedValueOnce([solver(1)]);
    renderBoard();

    const error = await screen.findByTestId("solvers-error");
    expect(error).toHaveTextContent("That didn't load.");
    within(error).getByRole("button", { name: "Try again" }).click();

    expect(await screen.findAllByTestId("solver-row")).toHaveLength(1);
    expect(listTopSolvers).toHaveBeenCalledTimes(2);
  });

  it("shows the rows' shape while it loads", () => {
    listTopSolvers.mockReturnValue(new Promise(() => {}));
    renderBoard();

    expect(screen.getByTestId("solvers-loading")).toBeInTheDocument();
  });
});
