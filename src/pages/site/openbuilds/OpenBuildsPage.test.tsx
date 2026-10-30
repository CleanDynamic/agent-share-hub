// SV-14 P2: OpenBuilds wired. Step requests with their strips, Me too at once, the sort in the address, the reader's own
// sections only when signed in, and nothing drawn that has no data yet.

import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listStepRequests = vi.fn();
const listMyOpenRequests = vi.fn();
const listMyClaims = vi.fn();
const getMyRecord = vi.fn();
const listTopSolvers = vi.fn();
const toggleMeToo = vi.fn();
let user: { id: string } | null = { id: "me" };

vi.mock("@/lib/bounty", () => ({
  listStepRequests: (options: unknown) => listStepRequests(options),
  listMyOpenRequests: (id: string) => listMyOpenRequests(id),
  listMyClaims: (id: string) => listMyClaims(id),
  getMyRecord: (id: string) => getMyRecord(id),
  listTopSolvers: (options: unknown) => listTopSolvers(options),
  toggleMeToo: (input: unknown) => toggleMeToo(input),
}));
const listGroups = vi.fn();
vi.mock("@/lib/build/filterSets", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/build/filterSets")>()), listGroups: () => listGroups() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user, loading: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/errors/report", () => ({ reportError: vi.fn() }));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const library = { data: undefined as unknown[] | undefined, isError: false, isLoadingError: false, refetch: vi.fn() };
vi.mock("@/hooks/useLibrarySessions", () => ({ useLibrarySessions: () => library }));
const offerSession = vi.fn();
const acceptOffer = vi.fn();
const declineOffer = vi.fn();
vi.mock("@/lib/bounty/sessionOffers", () => ({ offerSession: (input: unknown) => offerSession(input), acceptOffer: (input: unknown) => acceptOffer(input), declineOffer: (id: string) => declineOffer(id) }));

const listBriefs = vi.fn();
const listModelTests = vi.fn();
const listReviews = vi.fn();
const getWeekGoal = vi.fn();
vi.mock("@/lib/bounty/reviews", () => ({ listReviews: (options: unknown) => listReviews(options), getWeekGoal: () => getWeekGoal() }));
const getReleaseCheck = vi.fn();
vi.mock("@/lib/bounty/modelChecks", () => ({ listModelTests: (options: unknown) => listModelTests(options), getReleaseCheck: () => getReleaseCheck() }));
vi.mock("@/lib/bounty/briefs", () => ({ listBriefs: (options: unknown) => listBriefs(options) }));

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
        claim: null,
        fromRun: false,
        target: null,
        offers: [],
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
  listMyClaims.mockReset().mockResolvedValue([]);
  listMyOpenRequests.mockReset().mockResolvedValue([{ bountyId: "q9", build: { slug: "gbngd", title: "gbngd" }, gapTitle: "Step two", answers: 2, latestSolver: "kit" }]);
  getMyRecord.mockReset().mockResolvedValue({ reproduced: 40, tried: 0, accepted: 6 });
  listGroups.mockReset().mockResolvedValue([]);
  listTopSolvers.mockReset().mockResolvedValue([{ id: "u1", username: "kit", display_name: null, avatar_url: null, solved: 9, rewardTotalGbp: null, lastSolvedAt: null }]);
  toggleMeToo.mockReset();
  listBriefs.mockReset().mockResolvedValue({ briefs: [], nextOffset: null });
  listModelTests.mockReset().mockResolvedValue({ tests: [], nextOffset: null });
  getReleaseCheck.mockReset().mockResolvedValue(null);
  listReviews.mockReset().mockResolvedValue({ reviews: [], nextOffset: null });
  getWeekGoal.mockReset().mockResolvedValue(null);
  toast.mockReset();
  library.data = [{ id: "imp-1", client: "claude-code", modelName: "Opus 5.5", firstPrompt: "Deploy the worker to Vercel", promptCount: 6, createdAt: "2026-10-03T10:00:00Z" }];
  offerSession.mockReset().mockResolvedValue({});
  acceptOffer.mockReset().mockResolvedValue("b1");
  declineOffer.mockReset().mockResolvedValue(undefined);
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
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["All", "Steps", "Sessions", "Parts", "Briefs", "Model tests", "Reviews"]);
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

  it("draws the Groups once there is one: a public filter set, the reader's own first, linking to Builds with its filters (SV-24)", async () => {
    listGroups.mockResolvedValue([
      { id: "0b6f3a42-1c52-4e0e-9a3c-6d2f1f4a9c10", name: "Sales automation", search: "f=field%3Asales&f=stack%3Aclaude-code", members: 12, member: true, mine: true },
      { id: "9d6f3a42-1c52-4e0e-9a3c-6d2f1f4a9c11", name: "Research agents", search: "", members: 1, member: false, mine: false },
    ]);
    mount();
    await screen.findByTestId("openbuilds-request");
    expect(await screen.findByRole("heading", { name: "Groups" })).toBeInTheDocument();
    expect(screen.getByText("Public filter sets, by members")).toBeInTheDocument();
    const sales = screen.getByRole("link", { name: /Sales automation/ });
    expect(sales).toHaveAttribute("href", "/builds?f=field%3Asales&f=stack%3Aclaude-code&set=0b6f3a42-1c52-4e0e-9a3c-6d2f1f4a9c10");
    expect(sales.textContent).toContain("12 members · yours");
    expect(screen.getByRole("link", { name: /Research agents/ }).textContent).toContain("1 member");
  });

  it("says so when the Groups did not load, with Retry (SV-24)", async () => {
    listGroups.mockRejectedValue(new Error("no"));
    mount();
    expect(await screen.findByText("Groups didn't load.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("draws nothing that has no data yet", async () => {
    mount();
    await screen.findByTestId("openbuilds-request");
    expect(screen.queryByRole("region", { name: "Model release check" })).toBeNull();
    for (const name of ["Groups"]) expect(screen.queryByRole("heading", { name })).toBeNull();
    expect(screen.queryByText("Builds contributed to")).toBeNull();
    expect(screen.queryByText("Site goal")).toBeNull();
  });

  it("says who is working on a request, and lists the reader's own claims (SV-21)", async () => {
    const soon = new Date(Date.now() + 2 * 86_400_000 - 3_600_000).toISOString();
    const withClaim = page();
    withClaim.requests[0] = { ...withClaim.requests[0], claim: { requestId: "q1", userId: "u1", handle: "kit", expiresAt: soon, forkBuildId: "f1" }, fromRun: true };
    listStepRequests.mockResolvedValue(withClaim);
    listMyClaims.mockResolvedValue([{ requestId: "q7", build: { slug: "pitch", title: "Pitch deck" }, gapTitle: null, expiresAt: soon, forkBuildId: null }]);
    mount();
    const request = await screen.findByTestId("openbuilds-request");
    expect(within(request).getByText(/Claimed by/).textContent).toBe("Claimed by @kit · 2 days left · fork in progress");
    expect(within(request).getByText("Research brief agent · @mira · From a failed run · 6h")).toBeInTheDocument();
    const claims = await screen.findByRole("heading", { name: "Your claims" });
    expect(claims).toBeInTheDocument();
    expect(await screen.findByText("Pitch deck · Whole build")).toBeInTheDocument();
    expect(listMyClaims).toHaveBeenCalledWith("me");
  });

  describe("a request for a session (SV-21)", () => {
    const making = { sessions_meta: { "typed-1": { tool: "claude-code", date: "2026-10-01", model: "Opus 5.5" }, "typed-3": { tool: null, date: "2026-10-03" } }, session_order: ["typed-1", "typed-3"] };
    const sessionPage = (offers: unknown[] = []) => {
      const base = page();
      base.requests[0] = {
        ...base.requests[0],
        bounty: { ...base.requests[0].bounty, gap_node_id: null, author_id: "maker-1" } as never,
        gapTitle: null,
        problem: "Deploy the worker to Vercel",
        target: { size: "session", key: "typed-3", making },
        offers: offers as never,
      };
      return base;
    };

    it("draws the numbered sessions with the open one, says Unclaimed, and offers through a dialog that files the pick", async () => {
      listStepRequests.mockResolvedValue(sessionPage());
      mount("/openbuilds?type=sessions");
      const request = await screen.findByTestId("openbuilds-request");
      expect(request).toHaveAttribute("data-kind", "session");
      expect(within(request).getByRole("heading", { name: "Session 2 · Deploy the worker to Vercel" })).toBeInTheDocument();
      expect(within(request).getByText("Unclaimed")).toBeInTheDocument();
      expect(within(request).getByText("An offered session copies prompt text, model and source only")).toBeInTheDocument();
      fireEvent.click(within(request).getByRole("button", { name: "Offer a session" }));
      const dialog = await screen.findByTestId("offer-session-dialog");
      expect(within(dialog).getByText("Claude Code · Opus 5.5 · 3 Oct · 6 prompts")).toBeInTheDocument();
      const offer = within(dialog).getByRole("button", { name: "Offer this session" });
      expect(offer).toBeDisabled();
      fireEvent.click(within(dialog).getByRole("radio", { name: /Deploy the worker to Vercel/ }));
      fireEvent.click(offer);
      await waitFor(() => expect(offerSession).toHaveBeenCalledWith({ requestId: "q1", importId: "imp-1", userId: "me" }));
      await waitFor(() => expect(screen.queryByTestId("offer-session-dialog")).toBeNull());
      expect(toast).toHaveBeenCalledWith(expect.stringContaining("Session offered"), expect.anything());
    });

    it("keeps the dialog open and says why when the offer fails", async () => {
      listStepRequests.mockResolvedValue(sessionPage());
      offerSession.mockRejectedValue(new Error("Someone else is already working on this request"));
      mount("/openbuilds?type=sessions");
      fireEvent.click(within(await screen.findByTestId("openbuilds-request")).getByRole("button", { name: "Offer a session" }));
      const dialog = await screen.findByTestId("offer-session-dialog");
      fireEvent.click(within(dialog).getByRole("radio", { name: /Deploy/ }));
      fireEvent.click(within(dialog).getByRole("button", { name: "Offer this session" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("Someone else is already working on this request");
    });

    it("sends a signed-out reader to sign in instead of opening the dialog", async () => {
      user = null;
      listStepRequests.mockResolvedValue(sessionPage());
      mount("/openbuilds?type=sessions");
      fireEvent.click(within(await screen.findByTestId("openbuilds-request")).getByRole("button", { name: "Offer a session" }));
      expect(screen.queryByTestId("offer-session-dialog")).toBeNull();
      await waitFor(() => expect(where).toBe("?redirect=%2Fopenbuilds%3Ftype%3Dsessions"));
    });

    it("gives the request's maker Accept and Decline on each offer, and gives the offerer a line", async () => {
      const offer = { id: "o1", requestId: "q1", userId: "u9", handle: "kit", status: "offered", createdAt: "2026-11-01T00:00:00Z", session: { key: "i", model: "Opus 5.5", prompts: [1, 2, 3, 4, 5, 6] } };
      user = { id: "maker-1" };
      listStepRequests.mockResolvedValue(sessionPage([offer]));
      mount("/openbuilds?type=sessions");
      const list = await screen.findByRole("list", { name: "Offered sessions" });
      expect(within(list).getByText("@kit offered a session · Opus 5.5 · 6 prompts")).toBeInTheDocument();
      fireEvent.click(within(list).getByRole("button", { name: "Accept into the build" }));
      await waitFor(() => expect(acceptOffer).toHaveBeenCalledWith({ offerId: "o1", makerId: "maker-1" }));
      fireEvent.click(within(list).getByRole("button", { name: "Decline" }));
      await waitFor(() => expect(declineOffer).toHaveBeenCalledWith("o1"));
    });

    it("shows the offerer only their own line, without the two answers", async () => {
      const offer = { id: "o1", requestId: "q1", userId: "me", handle: "me", status: "offered", createdAt: "2026-11-01T00:00:00Z", session: { key: "i", model: null, prompts: [1] } };
      listStepRequests.mockResolvedValue(sessionPage([offer]));
      mount("/openbuilds?type=sessions");
      const list = await screen.findByRole("list", { name: "Offered sessions" });
      expect(within(list).getByText("You offered a session · 1 prompt")).toBeInTheDocument();
      expect(within(list).queryByRole("button")).toBeNull();
    });
  });

  it("asks a signed-out reader nothing of their own", async () => {
    user = null;
    mount();
    await screen.findByTestId("openbuilds-request");
    expect(listMyClaims).not.toHaveBeenCalled();
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
  it("reads the Briefs tab from its own table, draws the answers and compares the two newest", async () => {
    listBriefs.mockResolvedValue({
      briefs: [
        {
          id: "br1", slug: "dentist", title: "Book a dentist appointment", maker: "dax", publishedAt: new Date(Date.now() - 4 * 86_400_000).toISOString(), openSteps: 4, answerCount: 2, reproduced: 1,
          answers: [
            { id: "a1", slug: "maya-dentist", title: "Mine", userId: "u1", handle: "maya", runs: 4, createdAt: new Date(Date.now() - 3_600_000).toISOString() },
            { id: "a2", slug: "kit-dentist", title: "Kit's", userId: "u2", handle: "kit", runs: 0, createdAt: new Date(Date.now() - 7_200_000).toISOString() },
          ],
        },
      ],
      nextOffset: null,
    });
    mount("/openbuilds?type=briefs");
    const request = await screen.findByTestId("openbuilds-request");
    expect(listStepRequests).not.toHaveBeenCalled();
    expect(within(request).getByRole("heading", { name: "Book a dentist appointment" })).toBeInTheDocument();
    expect(within(request).getByText("@dax · 4 open steps · 4d")).toBeInTheDocument();
    expect(within(request).getByText("2 answers · 1 reproduced")).toBeInTheDocument();
    expect(within(request).getByRole("link", { name: "Compare answers" })).toHaveAttribute("href", "/b2/maya-dentist/compare/kit-dentist");
    expect(within(request).getByRole("link", { name: "Answer this brief" })).toHaveAttribute("href", "/b2/dentist");
  });
  it("draws the model release check above the requests, from one request", async () => {
    getReleaseCheck.mockResolvedValue({
      modelId: "opus-5-5", modelName: "Opus 5.5", releasedOn: new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10), works: 94, fails: 11, untested: 15, total: 120, nextSlug: "call-notes",
      bars: [{ s: "works", n: 3 }, { s: "fails", n: 1 }, { s: "untested", n: 0 }],
    });
    mount();
    const check = await screen.findByRole("region", { name: "Model release check" });
    expect(within(check).getByText("94 of 120")).toBeInTheDocument();
    expect(within(check).getByText(/released 3 days ago/)).toBeInTheDocument();
    expect(within(check).getByRole("link", { name: "Run an untested build" })).toHaveAttribute("href", "/b2/call-notes");
    expect(getReleaseCheck).toHaveBeenCalledTimes(1);
  });

  it("leaves the release check out until a model has been released", async () => {
    mount();
    await screen.findByTestId("openbuilds-request");
    expect(screen.queryByRole("region", { name: "Model release check" })).not.toBeInTheDocument();
  });

  it("reads the Model tests tab from the reproduced builds and asks for the untested model", async () => {
    listModelTests.mockResolvedValue({
      tests: [
        {
          buildId: "b9", slug: "call-notes", title: "Call notes", maker: "maya", lastConfirmedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), target: "Opus 5.5",
          models: [{ model: "Opus 5.5", state: "untested" }, { model: "Sonnet 4.5", state: "worked", runs: 6, worked: 6 }, { model: "GPT-5", state: "failed", runs: 3, worked: 1 }],
        },
      ],
      nextOffset: null,
    });
    mount("/openbuilds?type=model-tests");
    const request = await screen.findByTestId("openbuilds-request");
    expect(listStepRequests).not.toHaveBeenCalled();
    expect(within(request).getByRole("heading", { name: "Reproduce Call notes on Opus 5.5" })).toBeInTheDocument();
    expect(within(request).getByText("Not tested")).toBeInTheDocument();
    expect(within(request).getByText("6 worked")).toBeInTheDocument();
    expect(within(request).getByRole("link", { name: "Reproduce on Opus 5.5" })).toHaveAttribute("href", "/b2/call-notes");
  });
  it("reads the Reviews tab: the runs, the failed ones, the step comments and the requests opened from it", async () => {
    listReviews.mockResolvedValue({
      reviews: [{ buildId: "b7", slug: "weekly", title: "Weekly report from Linear", maker: "luke", since: new Date(Date.now() - 8 * 3_600_000).toISOString(), runs: 3, failed: 1, stepComments: 4, requests: 1 }],
      nextOffset: null,
    });
    mount("/openbuilds?type=reviews");
    const request = await screen.findByTestId("openbuilds-request");
    expect(listStepRequests).not.toHaveBeenCalled();
    expect(within(request).getByRole("heading", { name: "Weekly report from Linear" })).toBeInTheDocument();
    expect(within(request).getByText("@luke · held out of Builds until the review ends · 8h")).toBeInTheDocument();
    expect(within(request).getByText(/3 runs/)).toBeInTheDocument();
    expect(within(request).getByText("1 failed")).toBeInTheDocument();
    expect(within(request).getByText("4 step comments")).toBeInTheDocument();
    expect(within(request).getByText("1 step request opened from it")).toBeInTheDocument();
    expect(within(request).getByRole("link", { name: "Reproduce to review" })).toHaveAttribute("href", "/b2/weekly");
  });

  it("draws the week's goal once a goal is set, and not before", async () => {
    getWeekGoal.mockResolvedValue({ closed: 18, goal: 30 });
    mount();
    expect(await screen.findByRole("img", { name: "18 of 30 requests closed this week" })).toBeInTheDocument();
    expect(screen.getByText(/60%/)).toBeInTheDocument();
  });

  it("leaves the week's goal out while there is none", async () => {
    mount();
    await screen.findByTestId("openbuilds-request");
    expect(screen.queryByRole("img", { name: /requests closed this week/ })).not.toBeInTheDocument();
  });
});
