// Acceptance cover for the gap panel and the solve loop (NS-P52).
//
// FIVE THINGS A TYPE CHECKER CANNOT SEE:
//
//   1. a published build with an open bounty shows the panel under the node
//      the bounty is about, with the invitation, the problem, the price and
//      the deadline — and nothing invented for the two that are optional
//   2. the me-too action records a mark and the button says so afterwards
//   3. "Offer a solution" ranks the two ways to answer (NS-P53) — the rebuild
//      is the button, the typed form is a link behind it — and the form, once
//      asked for, is still the gap's OWN TYPE and still sends what was typed
//   4. only the author is offered "Accept", and the confirm names the
//      consequence before anything is written
//   5. after an acceptance the page shows the filled node with its credit line
//
// Rendered through BuildPage rather than in isolation, because 1 and 5 are
// claims about the page: the panel has to reach the right node, and the credit
// line is what the RECORD says after the refetch, not what this component
// believes it just did.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getBuildBySlug = vi.fn();
const getMediaForBuild = vi.fn().mockResolvedValue([]);
const getApprovedLayers = vi.fn().mockResolvedValue([]);
const listRebuilds = vi.fn().mockResolvedValue([]);
const getForkOrigin = vi.fn().mockResolvedValue(null);
const getFieldsFor = vi.fn();

const listBuildBounties = vi.fn();
const listSolverHandles = vi.fn().mockResolvedValue(new Map());
const listSolutions = vi.fn().mockResolvedValue([]);
const submitSolution = vi.fn();
const acceptSolution = vi.fn();
const toggleMeToo = vi.fn();
const voteOnSolution = vi.fn();
const startSolutionRebuild = vi.fn();
const submitSolutionRebuild = vi.fn();
/** No qualifying rebuild by default: the first visit is the ordinary case. */
const listMySolutionRebuilds = vi.fn().mockResolvedValue([]);
const listSolutionBuilds = vi.fn().mockResolvedValue(new Map());

const auth = vi.hoisted(() => ({
  user: null as { id: string } | null,
  isLoggedIn: false,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: auth.user, isLoggedIn: auth.isLoggedIn }),
}));

vi.mock("@/lib/build", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/build")>();
  return {
    ...actual,
    getBuildBySlug: (slug: string) => getBuildBySlug(slug),
    getMediaForBuild: (buildId: string) => getMediaForBuild(buildId),
    getApprovedLayers: (buildId: string) => getApprovedLayers(buildId),
    listRebuilds: (buildId: string) => listRebuilds(buildId),
    getForkOrigin: (build: unknown) => getForkOrigin(build),
    getFieldsFor: (key: string) => getFieldsFor(key),
  };
});

vi.mock("@/lib/bounty", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bounty")>();
  return {
    ...actual,
    listBuildBounties: (options: unknown) => listBuildBounties(options),
    listSolverHandles: (ids: unknown) => listSolverHandles(ids),
    listSolutions: (options: unknown) => listSolutions(options),
    submitSolution: (input: unknown) => submitSolution(input),
    acceptSolution: (bountyId: string, solutionId: string) =>
      acceptSolution(bountyId, solutionId),
    toggleMeToo: (input: unknown) => toggleMeToo(input),
    voteOnSolution: (input: unknown) => voteOnSolution(input),
    startSolutionRebuild: (bountyId: string) => startSolutionRebuild(bountyId),
    submitSolutionRebuild: (input: unknown) => submitSolutionRebuild(input),
    listMySolutionRebuilds: (options: unknown) => listMySolutionRebuilds(options),
    listSolutionBuilds: (ids: unknown) => listSolutionBuilds(ids),
  };
});

import BuildPage from "@/pages/BuildPage";
import { GAP_INVITATION } from "@/components/build/GapPanel";

const AUTHOR = "creator-1";
const SOLVER = "solver-2";

const nodeTypes = [
  {
    key: "prompt", label: "Prompt", category: "instruction", colour: "#E8571A",
    icon: "MessageSquare", renderer: "prompt", copyable: true, is_active: true, sort: 1,
    schema: { fields: [{ key: "text", label: "Text", type: "text" }] },
  },
  {
    key: "result", label: "Result", category: "evidence", colour: "#2EC4B6",
    icon: "CircleCheck", renderer: "evidence", copyable: false, is_active: true, sort: 1,
    schema: { fields: [{ key: "text", label: "Text", type: "text" }] },
  },
];

const PROMPT_FIELDS = [{ key: "text", label: "Text", type: "text" }];

const node = (id: string, type: string, title: string, extra = {}) => ({
  id, build_id: "b", parent_id: null, position: 0, type, title, note: null,
  payload: {}, source_ref: null, event_id: null, is_gap: false, created_at: "",
  children: [], ...extra,
});

function record(gap: Record<string, unknown>) {
  return {
    build: {
      id: "b", creator_id: AUTHOR, slug: "inbox-triage-agent-demo",
      title: "Inbox triage agent", outcome: "Sorts a full inbox.", shape: "app",
      status: "published", made_for: ["founder"], made_with: ["Claude Opus 4.5"],
      live_url: null, repo_url: null, hero_node_id: null, completeness: 86,
      reproduction_count: 0, last_confirmed_at: null, last_confirmed_model: null,
      published_at: "2026-08-01T00:00:00Z", parent_build_id: null, rebuild_count: 0,
      rebuild_note: null, source_title_at_fork: null, source_handle_at_fork: null,
    },
    tree: [
      node("n1", "result", "What it produced", { payload: { text: "It sorted 300." } }),
      node("n2", "prompt", "The retry prompt", gap),
    ],
    tray: [],
    events: [],
    nodeTypes,
  };
}

/** The gap as it stands before anybody answers it. */
const UNSOLVED = {
  is_gap: true,
  payload: { gap_problem: "Retries loop on a 429 and never back off." },
};

/** The same node after acceptSolution substituted an answer into it. */
const FILLED = {
  is_gap: false,
  payload: { text: "Back off exponentially, six attempts." },
  source_ref: { source: "bounty", solution_id: "s1", solver_id: SOLVER },
};

/** The same node, filled by a solution that WAS a build (NS-P53). */
const FILLED_BY_REBUILD = {
  is_gap: false,
  payload: { text: "Back off exponentially, six attempts, and log the last error." },
  source_ref: {
    source: "bounty",
    solution_id: "s1",
    solver_id: SOLVER,
    solution_build_id: "rebuild-1",
    solution_node_id: "n-solved",
  },
};

function bounty(overrides: Record<string, unknown> = {}) {
  return {
    id: "bounty-1", build_id: "b", gap_node_id: "n2", legacy_item_id: null,
    author_id: AUTHOR, status: "open", reward_gbp: 120,
    closes_at: null, is_meta: false, meta_parent_id: null,
    accepted_solution_id: null, me_too_count: 3,
    created_at: "2026-08-20T00:00:00Z", solved_at: null,
    ...overrides,
  };
}

function entry(overrides: Record<string, unknown> = {}) {
  return { bounty: bounty(), solutions: 0, meToo: false, ...overrides };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/b2/inbox-triage-agent-demo"]}>
        <Routes>
          <Route path="/b2/:slug" element={<BuildPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/** The panel, once the page and its bounty query have settled. */
async function panel() {
  return await screen.findByTestId("gap-panel");
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = null;
  auth.isLoggedIn = false;
  getBuildBySlug.mockResolvedValue(record(UNSOLVED));
  getMediaForBuild.mockResolvedValue([]);
  getApprovedLayers.mockResolvedValue([]);
  listRebuilds.mockResolvedValue([]);
  getForkOrigin.mockResolvedValue(null);
  getFieldsFor.mockResolvedValue(PROMPT_FIELDS);
  listBuildBounties.mockResolvedValue([entry()]);
  listSolverHandles.mockResolvedValue(new Map([[SOLVER, "rae"]]));
  listSolutions.mockResolvedValue([]);
});

describe("the gap panel", () => {
  it("puts the ask under the node it is about, as an invitation", async () => {
    renderPage();

    const gap = await panel();
    expect(gap).toHaveTextContent(GAP_INVITATION);
    expect(gap).toHaveTextContent("Retries loop on a 429 and never back off.");
    expect(within(gap).getByTestId("gap-reward")).toHaveTextContent("£120");
    expect(within(gap).getByTestId("gap-solution-count")).toHaveTextContent(
      "no solutions yet"
    );

    // The panel belongs to the gap node, not to the build: the card it sits
    // inside is the one carrying that node's id.
    const card = gap.closest("[data-node-id]");
    expect(card).toHaveAttribute("data-node-id", "n2");
  });

  it("says nothing about a reward or a deadline that was never set", async () => {
    listBuildBounties.mockResolvedValue([
      { bounty: bounty({ reward_gbp: null, closes_at: null }), solutions: 2, meToo: false },
    ]);
    renderPage();

    const gap = await panel();
    expect(within(gap).queryByTestId("gap-reward")).toBeNull();
    expect(within(gap).queryByTestId("gap-deadline")).toBeNull();
    expect(within(gap).getByTestId("gap-solution-count")).toHaveTextContent("2 solutions");
  });

  it("shows a deadline when the bounty has one", async () => {
    const closes = new Date(Date.now() + 6 * 86_400_000).toISOString();
    listBuildBounties.mockResolvedValue([
      { bounty: bounty({ closes_at: closes }), solutions: 0, meToo: false },
    ]);
    renderPage();

    const gap = await panel();
    expect(within(gap).getByTestId("gap-deadline")).toHaveTextContent("closes in 6 days");
  });

  it("records a me-too and says so afterwards", async () => {
    auth.user = { id: SOLVER };
    auth.isLoggedIn = true;
    toggleMeToo.mockResolvedValue({ marked: true, count: 4 });
    renderPage();

    const gap = await panel();
    const button = within(gap).getByTestId("gap-me-too");
    expect(button).toHaveTextContent("I need this too");

    fireEvent.click(button);

    await waitFor(() =>
      expect(toggleMeToo).toHaveBeenCalledWith({
        bountyId: "bounty-1",
        userId: SOLVER,
      })
    );
    await waitFor(() => expect(button).toHaveTextContent("You need this too"));
    expect(button).toHaveTextContent("4");
  });

  it("is not offered on a node that is not a gap", async () => {
    getBuildBySlug.mockResolvedValue(record(FILLED));
    listBuildBounties.mockResolvedValue([]);
    renderPage();

    await screen.findByText("The retry prompt");
    expect(screen.queryByTestId("gap-panel")).toBeNull();
  });
});

describe("the solve loop", () => {
  it("opens the gap's own type as a form and submits what was typed", async () => {
    auth.user = { id: SOLVER };
    auth.isLoggedIn = true;
    submitSolution.mockResolvedValue({ id: "s1" });
    renderPage();

    const gap = await panel();
    fireEvent.click(within(gap).getByTestId("solve-open"));

    // NS-P53: the typed form is the SECOND option and is asked for. Until it
    // is, the panel offers the rebuild and nothing is on screen to type into.
    await screen.findByTestId("solve-rebuild");
    expect(screen.queryByLabelText("Text")).toBeNull();
    fireEvent.click(screen.getByTestId("solve-direct"));

    // The form is the GAP NODE'S type, not a free-text box: a prompt node's
    // schema declares one text field, and that is what a solver fills in.
    const field = await screen.findByLabelText("Text");
    fireEvent.change(field, { target: { value: "Back off exponentially." } });
    fireEvent.change(screen.getByTestId("solution-note"), {
      target: { value: "Held at 300 messages." },
    });

    fireEvent.click(screen.getByTestId("solution-submit"));

    await waitFor(() =>
      expect(submitSolution).toHaveBeenCalledWith({
        bountyId: "bounty-1",
        nodePayload: { text: "Back off exponentially." },
        solverId: SOLVER,
        solverNote: "Held at 300 messages.",
      })
    );
  });

  it("ranks the rebuild first and hands the solver to their workspace", async () => {
    auth.user = { id: SOLVER };
    auth.isLoggedIn = true;
    startSolutionRebuild.mockResolvedValue({ id: "draft-9" });
    renderPage();

    const gap = await panel();
    fireEvent.click(within(gap).getByTestId("solve-open"));

    const primary = await screen.findByTestId("solve-rebuild");
    expect(primary).toHaveTextContent("Solve it in a rebuild");
    // The sub-line is the argument for taking it, and it is the copy the
    // prompt specifies word for word.
    expect(
      screen.getByText(
        "You get the whole build to work with. Your solution is your version, published.",
      ),
    ).toBeTruthy();

    // The quiet one is present and is not a button surface.
    expect(screen.getByTestId("solve-direct")).toHaveTextContent(
      "Just send the missing part",
    );

    fireEvent.click(primary);
    await waitFor(() => expect(startSolutionRebuild).toHaveBeenCalledWith("bounty-1"));
  });

  it("offers a returning solver their published rebuild, pre-wired", async () => {
    auth.user = { id: SOLVER };
    auth.isLoggedIn = true;
    listMySolutionRebuilds.mockResolvedValue([
      {
        id: "rebuild-1",
        slug: "retry-that-works",
        title: "Retry that works",
        status: "published",
        creator_id: SOLVER,
        solves_node_id: "n-gap",
        reproduction_count: 3,
        published_at: "2026-08-29T10:00:00Z",
      },
    ]);
    submitSolutionRebuild.mockResolvedValue({ id: "s9" });
    renderPage();

    const gap = await panel();
    fireEvent.click(within(gap).getByTestId("solve-open"));

    const submit = await screen.findByTestId("submit-rebuild-solution");
    // The build is named and its evidence is beside it, because that is what
    // ranks one answer against another.
    expect(screen.getByTestId("solution-build-link")).toHaveTextContent("Retry that works");
    expect(screen.getByTestId("solution-build-repros")).toHaveTextContent("3 repros");

    fireEvent.change(screen.getByTestId("rebuild-solution-note"), {
      target: { value: "The chunker was the problem." },
    });
    fireEvent.click(submit);

    await waitFor(() =>
      expect(submitSolutionRebuild).toHaveBeenCalledWith({
        bountyId: "bounty-1",
        solutionBuildId: "rebuild-1",
        solverNote: "The chunker was the problem.",
      })
    );
  });

  it("shows a submitted solution with its solver, note and vote count", async () => {
    auth.user = { id: SOLVER };
    auth.isLoggedIn = true;
    listSolutions.mockResolvedValue([
      {
        id: "s1", bounty_id: "bounty-1", slot_id: "n2", solver_id: SOLVER,
        solver_note: "Held at 300 messages.",
        content_payload: { text: "Back off exponentially." },
        vote_count: 2, i_would_implement_count: 0, status: "submitted",
        submitted_at: "2026-08-21T00:00:00Z", created_at: "2026-08-21T00:00:00Z",
        solver: { id: SOLVER, username: "rae", display_name: "Rae", avatar_url: null },
        myVote: false, myImplement: false,
      },
    ]);
    renderPage();

    const gap = await panel();
    fireEvent.click(within(gap).getByTestId("solve-open"));

    const row = await screen.findByTestId("solution-row");
    expect(row).toHaveTextContent("@rae");
    expect(row).toHaveTextContent("Held at 300 messages.");
    expect(within(row).getByTestId("solution-vote")).toHaveTextContent("2");
    // The payload is drawn by the node renderer, so the prompt reads as a
    // prompt rather than as a key/value dump.
    expect(row).toHaveTextContent("Back off exponentially.");
  });

  it("offers Accept to the author only, and names the consequence first", async () => {
    listSolutions.mockResolvedValue([
      {
        id: "s1", bounty_id: "bounty-1", slot_id: "n2", solver_id: SOLVER,
        solver_note: null, content_payload: { text: "Back off exponentially." },
        vote_count: 0, i_would_implement_count: 0, status: "submitted",
        submitted_at: "2026-08-21T00:00:00Z", created_at: "2026-08-21T00:00:00Z",
        solver: { id: SOLVER, username: "rae", display_name: "Rae", avatar_url: null },
        myVote: false, myImplement: false,
      },
    ]);
    acceptSolution.mockResolvedValue({
      bountyId: "bounty-1", solutionId: "s1", solverId: SOLVER,
      nodeId: "n2", eventId: "e1", acceptedAt: "2026-08-22T00:00:00Z",
    });

    // A solver looking at somebody else's bounty is offered nothing.
    auth.user = { id: SOLVER };
    auth.isLoggedIn = true;
    const solverView = renderPage();
    fireEvent.click(within(await panel()).getByTestId("solve-open"));
    await screen.findByTestId("solution-row");
    expect(screen.queryByTestId("solution-accept")).toBeNull();
    solverView.unmount();

    // The author is.
    auth.user = { id: AUTHOR };
    renderPage();
    fireEvent.click(within(await panel()).getByTestId("solve-open"));
    fireEvent.click(await screen.findByTestId("solution-accept"));

    // The confirm says what accepting does, and names the solver it credits.
    expect(
      screen.getByText(/fills the gap in your build and credits @rae on the node/i)
    ).toBeTruthy();
    expect(acceptSolution).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("solution-accept-confirm"));
    await waitFor(() => expect(acceptSolution).toHaveBeenCalledWith("bounty-1", "s1"));
  });

  it("shows the filled node with its credit line once the record refetches", async () => {
    auth.user = { id: AUTHOR };
    auth.isLoggedIn = true;
    listSolutions.mockResolvedValue([
      {
        id: "s1", bounty_id: "bounty-1", slot_id: "n2", solver_id: SOLVER,
        solver_note: null, content_payload: { text: "Back off exponentially." },
        vote_count: 0, i_would_implement_count: 0, status: "submitted",
        submitted_at: "2026-08-21T00:00:00Z", created_at: "2026-08-21T00:00:00Z",
        solver: { id: SOLVER, username: "rae", display_name: "Rae", avatar_url: null },
        myVote: false, myImplement: false,
      },
    ]);
    acceptSolution.mockResolvedValue({
      bountyId: "bounty-1", solutionId: "s1", solverId: SOLVER,
      nodeId: "n2", eventId: "e1", acceptedAt: "2026-08-22T00:00:00Z",
    });

    renderPage();
    await panel();

    // What the database holds after the acceptance: the gap is a filled node
    // crediting its solver, and the bounty is no longer open.
    getBuildBySlug.mockResolvedValue(record(FILLED));
    listBuildBounties.mockResolvedValue([]);

    fireEvent.click(within(await panel()).getByTestId("solve-open"));
    fireEvent.click(await screen.findByTestId("solution-accept"));
    fireEvent.click(screen.getByTestId("solution-accept-confirm"));

    await waitFor(() => expect(acceptSolution).toHaveBeenCalled());
    const credit = await screen.findByTestId("gap-solved-credit");
    expect(credit).toHaveTextContent("Solved by @rae");
    await waitFor(() => expect(screen.queryByTestId("gap-panel")).toBeNull());
  });

  // NS-P53 ACCEPTANCE 6 — the author's half of the round trip.
  it("links a node filled from a rebuild to the build the answer came from", async () => {
    listSolverHandles.mockResolvedValue(new Map([[SOLVER, "rae"]]));
    listSolutionBuilds.mockResolvedValue(
      new Map([
        [
          "rebuild-1",
          {
            id: "rebuild-1",
            slug: "retry-that-works",
            title: "Retry that works",
            status: "published",
            creator_id: SOLVER,
            solves_node_id: "n2",
            reproduction_count: 3,
            published_at: "2026-08-29T10:00:00Z",
          },
        ],
      ]),
    );
    getBuildBySlug.mockResolvedValue(record(FILLED_BY_REBUILD));
    listBuildBounties.mockResolvedValue([]);
    renderPage();

    // Both halves arrive with their own query, so both are awaited: the line
    // paints as "a solver" and gains the handle when the lookup lands.
    const credit = await screen.findByTestId("gap-solved-credit");
    await waitFor(() => expect(credit).toHaveTextContent("Solved by @rae"));

    // The second line: where the payload above actually lives, one click away.
    const from = await screen.findByTestId("gap-solved-build");
    expect(from).toHaveTextContent("Retry that works");
    expect(within(from).getByRole("link").getAttribute("href")).toBe(
      "/b2/retry-that-works",
    );
  });

  // A typed-payload solve names no build, so the line has no second half.
  it("says nothing about a build when the answer was a typed payload", async () => {
    listSolverHandles.mockResolvedValue(new Map([[SOLVER, "rae"]]));
    getBuildBySlug.mockResolvedValue(record(FILLED));
    listBuildBounties.mockResolvedValue([]);
    renderPage();

    const plain = await screen.findByTestId("gap-solved-credit");
    await waitFor(() => expect(plain).toHaveTextContent("Solved by @rae"));
    expect(screen.queryByTestId("gap-solved-build")).toBeNull();
    // And nothing was read for a build nobody named.
    expect(listSolutionBuilds).not.toHaveBeenCalled();
  });
});
