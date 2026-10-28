// SV-14 P2: OpenBuilds wired. Step requests with their strips, Me too at once, the sort in the address, the reader's own
// sections only when signed in, and nothing drawn that has no data yet.

import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listStepRequests = vi.fn();
const listMyOpenRequests = vi.fn();
const getMyRecord = vi.fn();
const listTopSolvers = vi.fn();
const toggleMeToo = vi.fn();
let user: { id: string } | null = { id: "me" };

vi.mock("@/lib/bounty", () => ({
  listStepRequests: (options: unknown) => listStepRequests(options),
  listMyOpenRequests: (id: string) => listMyOpenRequests(id),
  getMyRecord: (id: string) => getMyRecord(id),
  listTopSolvers: (options: unknown) => listTopSolvers(options),
  toggleMeToo: (input: unknown) => toggleMeToo(input),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/errors/report", () => ({ reportError: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import OpenBuildsPage from "./OpenBuildsPage";

const strip = (id: string, position: number, extra: Record<string, unknown> = {}) => ({
  id,
  build_id: "b1",
  parent_id: null,
  type: "prompt",
  title: `Step ${id}`,
  position,
  is_gap: false,
  payload: {},
  ...extra,
});

function page() {
  return {
    requests: [
      {
        bounty: { id: "q1", build_id: "b1", gap_node_id: "g", reward_gbp: 40, closes_at: null, me_too_count: 4, created_at: new Date(Date.now() - 6 * 3_600_000).toISOString() },
        build: { id: "b1", slug: "research", title: "Research brief agent" },
        maker: { username: "mira", avatar_url: null },
        gapTitle: "Fetch from paywalled sources",
        problem: "Stops on the first paywalled result.",
        solutions: 1,
        meToo: false,
      },
    ],
    strips: [strip("a", 1), strip("b", 2), strip("c", 3), strip("g", 4, { type: "code", is_gap: true, title: "Fetch from paywalled sources" }), strip("e", 5)],
    nextOffset: null,
  };
}

let where = "";
function Where() {
  where = useLocation().search;
  return null;
}

function mount(path = "/openbuilds") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <OpenBuildsPage />
          <Where />
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

beforeEach(() => {
  user = { id: "me" };
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  listStepRequests.mockReset().mockResolvedValue(page());
  listMyOpenRequests.mockReset().mockResolvedValue([{ bountyId: "q9", build: { slug: "gbngd", title: "gbngd" }, gapTitle: "Step two", answers: 2, latestSolver: "kit" }]);
  getMyRecord.mockReset().mockResolvedValue({ reproduced: 40, tried: 0, accepted: 6 });
  listTopSolvers.mockReset().mockResolvedValue([{ id: "u1", username: "kit", display_name: null, avatar_url: null, solved: 9, rewardTotalGbp: null, lastSolvedAt: null }]);
  toggleMeToo.mockReset();
});

describe("OpenBuildsPage", () => {
  it("draws a step request with its numbered strip, its problem, its facts and Answer", async () => {
    mount();
    const request = await screen.findByTestId("openbuilds-request");
    expect(within(request).getByRole("heading", { name: "Step 4 · Fetch from paywalled sources" })).toBeInTheDocument();
    expect(within(request).getByText("£40")).toBeInTheDocument();
    expect(within(request).getByText("Research brief agent · @mira · 6h")).toBeInTheDocument();
    expect(within(request).getByText("Stops on the first paywalled result.")).toBeInTheDocument();
    expect(within(request).getAllByRole("listitem").map((tile) => tile.textContent)).toEqual([
      "1 · PromptStep a",
      "2 · PromptStep b",
      "3 · PromptStep c",
      "4 · Code · openFetch from paywalled sources",
      "5 · PromptStep e",
    ]);
    expect(within(request).getByText("1 answer")).toBeInTheDocument();
    expect(within(request).getByRole("link", { name: "Answer" })).toHaveAttribute("href", "/openbuilds/q1/solve");
  });

  it("starts every read at once, the requests in the address's sort, with the reader's marks", async () => {
    mount("/openbuilds?sort=closing");
    await screen.findByTestId("openbuilds-request");
    expect(listStepRequests).toHaveBeenCalledWith({ sort: "closing", size: "all", offset: 0, viewerId: "me" });
    expect(listMyOpenRequests).toHaveBeenCalledWith("me");
    expect(getMyRecord).toHaveBeenCalledWith("me");
    expect(listTopSolvers).toHaveBeenCalledWith({ limit: 3, sinceDays: 30 });
  });

  it("shows only the live tabs, and puts the tab and the sort in the address", async () => {
    mount();
    await screen.findByTestId("openbuilds-request");
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["All", "Steps"]);
    fireEvent.click(screen.getByRole("tab", { name: "Steps" }));
    expect(where).toBe("?type=steps");
    fireEvent.keyDown(screen.getByRole("button", { name: "Sort: Most needed" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Reward" }));
    expect(where).toBe("?type=steps&sort=reward");
    await waitFor(() => expect(listStepRequests).toHaveBeenCalledWith({ sort: "reward", size: "step", offset: 0, viewerId: "me" }));
  });

  it("draws a whole-build request with one row for its build in place of a strip", async () => {
    const whole = page();
    whole.requests = [{ ...whole.requests[0], bounty: { ...whole.requests[0].bounty, id: "q2", gap_node_id: null }, gapTitle: null, problem: "" }];
    listStepRequests.mockResolvedValue(whole);
    mount();
    const request = await screen.findByTestId("openbuilds-request");
    expect(request.dataset.kind).toBe("build");
    expect(within(request).getByText("WHOLE BUILD")).toBeInTheDocument();
    expect(within(request).getByRole("heading", { name: "Open request on the whole build" })).toBeInTheDocument();
    expect(within(request).getByText("Research brief agent · @mira · 6h")).toBeInTheDocument();
    expect(within(request).queryByRole("list", { name: "Steps" })).toBeNull();
    expect(within(request).getByText("@mira · 5 steps")).toBeInTheDocument();
    expect(within(request).getByRole("link", { name: "Answer" })).toHaveAttribute("href", "/openbuilds/q2/solve");
  });

  it("shows Tried, didn't work only when there is one", async () => {
    getMyRecord.mockResolvedValue({ reproduced: 40, tried: 2, accepted: 6 });
    mount();
    expect(await screen.findByText("Tried, didn't work")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("presses Me too at once and keeps the count the database returns", async () => {
    let settle: (value: { marked: boolean; count: number }) => void = () => undefined;
    toggleMeToo.mockReturnValue(new Promise((resolve) => (settle = resolve)));
    mount();
    await screen.findByTestId("openbuilds-request");
    fireEvent.click(screen.getByRole("button", { name: "Me too 4" }));
    expect(await screen.findByRole("button", { name: "Me too 5" })).toHaveAttribute("aria-pressed", "true");
    expect(toggleMeToo).toHaveBeenCalledWith({ bountyId: "q1", userId: "me" });
    await act(async () => settle({ marked: true, count: 7 }));
    expect(await screen.findByRole("button", { name: "Me too 7" })).toHaveAttribute("aria-pressed", "true");
  });

  it("puts Me too back when the write is refused", async () => {
    toggleMeToo.mockRejectedValue(new Error("refused"));
    mount();
    await screen.findByTestId("openbuilds-request");
    fireEvent.click(screen.getByRole("button", { name: "Me too 4" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Me too 4" })).toHaveAttribute("aria-pressed", "false"));
  });

  it("draws the reader's requests, record and the top contributors", async () => {
    mount();
    await screen.findByText("gbngd · Step two");
    expect(screen.getByText("2 answers to review")).toBeInTheDocument();
    expect(screen.getByText("2 answers")).toBeInTheDocument();
    expect(await screen.findByText("40")).toBeInTheDocument();
    expect(screen.queryByText("Tried, didn't work")).toBeNull();
    expect(screen.getByText("Accepted answers, last 30 days")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /@kit/ })).toHaveAttribute("href", "/profile/kit");
  });

  it("draws nothing that has no data yet", async () => {
    mount();
    await screen.findByTestId("openbuilds-request");
    expect(screen.queryByRole("region", { name: "Model release check" })).toBeNull();
    for (const name of ["Your claims", "Groups"]) expect(screen.queryByRole("heading", { name })).toBeNull();
    expect(screen.queryByText("Builds contributed to")).toBeNull();
    expect(screen.queryByText("Site goal")).toBeNull();
  });

  it("asks a signed-out reader nothing of their own", async () => {
    user = null;
    mount();
    await screen.findByTestId("openbuilds-request");
    expect(listMyOpenRequests).not.toHaveBeenCalled();
    expect(getMyRecord).not.toHaveBeenCalled();
    expect(listStepRequests).toHaveBeenCalledWith({ sort: "needed", size: "all", offset: 0, viewerId: null });
    expect(screen.queryByRole("heading", { name: "Your requests" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Top contributors" })).toBeInTheDocument();
  });

  it("says when the requests did not load, with Retry", async () => {
    listStepRequests.mockRejectedValue(new Error("down"));
    mount();
    expect(await screen.findByText("Requests didn't load.")).toBeInTheDocument();
  });
});
