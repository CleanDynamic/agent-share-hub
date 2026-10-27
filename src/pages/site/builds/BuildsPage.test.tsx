// SV-11 P1: the Builds page reads its view from the address and loads once for every view.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/errors/report", () => ({ reportError: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(), auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } } }));

const listBuildsTable = vi.fn();
vi.mock("@/lib/build/gallery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build/gallery")>()),
  listBuildsTable: (...args: unknown[]) => listBuildsTable(...args),
}));

import BuildsPage from "./BuildsPage";

const build = (n: number) => ({
  id: `b${n}`, slug: `b${n}`, title: `Build ${n}`, shape: "", madeWith: [], reproductionCount: n, lastConfirmedAt: null, lastConfirmedModel: null,
  publishedAt: null, rebuildCount: 0, maker: { handle: "kit", name: null }, open: { count: 0, reward: null },
});

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <BuildsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  listBuildsTable.mockReset();
  listBuildsTable.mockResolvedValue({ builds: [build(1), build(2)], total: 2 });
});

describe("BuildsPage", () => {
  it("shows the Table by default and marks it current in the switch", async () => {
    renderAt("/builds");
    await waitFor(() => expect(screen.getByText("2 builds")).toBeTruthy());
    expect(screen.getByRole("link", { name: "Table" }).getAttribute("aria-current")).toBe("page");
    expect(screen.queryByTestId("builds-maps")).toBeNull();
  });

  it("reads the view from the address and loads the builds once for it", async () => {
    renderAt("/builds?view=maps");
    expect(await screen.findByTestId("builds-maps")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Maps" }).getAttribute("aria-current")).toBe("page");
    expect(listBuildsTable).toHaveBeenCalledTimes(1);
  });

  it("asks for the filters in the address, not the view", async () => {
    renderAt("/builds?view=classification&lens=proven&sort=newest");
    expect(await screen.findByTestId("builds-classification")).toBeTruthy();
    expect(listBuildsTable).toHaveBeenCalledWith(expect.objectContaining({ lens: "proven", sort: "newest", offset: 0 }));
    expect(JSON.stringify(listBuildsTable.mock.calls[0][0])).not.toContain("classification");
  });
});
