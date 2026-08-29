// Acceptance cover for the publish sheet's bounty section (NS-P51).
//
// Driven through the compose route rather than against the component alone, for
// the same reason Publish.test.tsx is: the claim is not that a form renders, it
// is that pressing Publish on a draft with holes in it produces bounty rows
// with the right gap_node_id on them — and the only way to see the arguments
// createBountyForGap is actually called with is to go through the real control,
// the real sheet and the real publish path.
//
// THE THREE THINGS THIS FILE EXISTS TO HOLD:
//
//   1. An unpriced gap is still filed. reward_gbp null, status open. A form
//      that quietly dropped the unpriced ones would look identical in every
//      screenshot and would halve the board.
//   2. "Publish without bounties" files nothing at all, and the build still
//      goes live. It is the switch, not a decoration on one.
//   3. A bounty that fails to file DOES NOT UNPUBLISH ANYTHING. The build is
//      live, the confirmation says so, and the creator is offered the failed
//      ones back. This is the assertion to keep if any other is ever dropped.
//
// The bounty layer is mocked at its module boundary rather than at the Supabase
// client, so what is asserted is the contract src/lib/bounty publishes —
// createBountyForGap's own input shape — and not a query builder's spelling.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

const getBuild = vi.fn();
const updateBuild = vi.fn();
const getMediaForBuild = vi.fn().mockResolvedValue([]);
const getLayers = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/build", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/build")>();
  return {
    ...actual,
    getBuild: (id: string) => getBuild(id),
    updateBuild: (id: string, patch: unknown) => updateBuild(id, patch),
    getMediaForBuild: (id: string) => getMediaForBuild(id),
    getLayers: (id: string) => getLayers(id),
    // Nothing to review, so Publish publishes. NS-P23's screen is covered in
    // LayerReview.test.tsx; here it is pinned out of the way.
    shouldOfferLayerReview: () => false,
  };
});

/**
 * The two calls the workspace makes into the bounty layer, and nothing else.
 *
 * A factory rather than importOriginal: src/lib/bounty pulls in the whole
 * solver half and its Supabase client at module scope, and none of it is on the
 * path this file drives.
 */
const listBountiesForBuild = vi.fn();
const createBountyForGap = vi.fn();
vi.mock("@/lib/bounty", () => ({
  listBountiesForBuild: (id: string) => listBountiesForBuild(id),
  createBountyForGap: (input: unknown) => createBountyForGap(input),
}));

const auth = { user: { id: "me" }, isLoggedIn: true, loading: false };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

import Compose from "@/pages/Compose";
import {
  bountyFailureSentence,
  bountyFiledSentence,
  closesAtFrom,
  parseReward,
} from "./BountySection";

const NODE_TYPES = [
  {
    key: "prompt", label: "Prompt", category: "instruction", colour: "#E8571A",
    icon: "MessageSquare", renderer: "prompt", copyable: true, is_active: true, sort: 1,
    schema: { fields: [{ key: "text", label: "Text", type: "text" }] },
  },
  {
    key: "result", label: "Result", category: "evidence", colour: "#2EC4B6",
    icon: "BarChart3", renderer: "evidence", copyable: false, is_active: true, sort: 1,
    schema: { fields: [{ key: "summary", label: "Summary", type: "text" }] },
  },
  {
    key: "model_params", label: "Model parameters", category: "configuration",
    colour: "#22C55E", icon: "SlidersHorizontal", renderer: "configuration",
    copyable: true, is_active: true, sort: 1,
    schema: { fields: [{ key: "model", label: "Model", type: "string" }] },
  },
  {
    key: "dataset", label: "Dataset", category: "data", colour: "#3B82F6",
    icon: "Database", renderer: "data", copyable: false, is_active: true, sort: 1,
    schema: { fields: [{ key: "name", label: "Name", type: "string" }] },
  },
];

const node = (
  id: string,
  type: string,
  title: string,
  extra: Record<string, unknown> = {}
) => ({
  id, build_id: "b1", parent_id: null, position: 0, type, title, note: null,
  payload: {}, source_ref: null, event_id: null, is_gap: false,
  created_at: "2026-08-01T00:00:00Z", children: [], ...extra,
});

/** A node the creator has marked unsolved, with the statement NS-P51 stores. */
const gap = (id: string, type: string, title: string, problem: string) =>
  node(id, type, title, { is_gap: true, payload: { gap_problem: problem } });

function draft(overrides: Record<string, unknown> = {}) {
  return {
    id: "b1",
    creator_id: "me",
    slug: "inbox-triage-agent-demo",
    title: "Inbox triage agent",
    outcome: "Triages a full inbox in under a minute.",
    shape: "app",
    status: "draft",
    made_for: null,
    made_with: null,
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    cover_media_id: null,
    cost_setup: null,
    cost_monthly: null,
    currency: "GBP",
    time_to_first_result: null,
    completeness: 0,
    reproduction_count: 0,
    last_confirmed_at: null,
    last_confirmed_model: null,
    published_at: null,
    ...overrides,
  };
}

function record(build: Record<string, unknown>, tree: unknown[]) {
  return { build, tree, tray: [], events: [], nodeTypes: NODE_TYPES };
}

/** Publishable, and two of its parts admitted to be holes. */
function withTwoGaps() {
  return record(draft(), [
    node("n1", "prompt", "The triage prompt"),
    node("n2", "result", "What it did"),
    gap("g1", "model_params", "Sampling settings", "Above 0.4 it invents citations."),
    gap("g2", "dataset", "The eval set", "I never captured the 200 labelled emails."),
  ]);
}

/** The same record with nothing marked unsolved: the plain publish path. */
function withNoGaps() {
  return record(draft(), [
    node("n1", "prompt", "The triage prompt"),
    node("n2", "result", "What it did"),
  ]);
}

/** A bounty row as listBountiesForBuild hands it back. */
const bountyRow = (overrides: Record<string, unknown> = {}) => ({
  id: "bo-1",
  build_id: "b1",
  gap_node_id: "g1",
  legacy_item_id: null,
  author_id: "me",
  status: "open",
  reward_gbp: 50,
  closes_at: null,
  is_meta: false,
  meta_parent_id: null,
  accepted_solution_id: null,
  me_too_count: 0,
  created_at: "2026-08-28T10:00:00Z",
  solved_at: null,
  ...overrides,
});

function renderCompose() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <MemoryRouter initialEntries={["/compose/b1"]}>
          <Routes>
            <Route path="/compose/:buildId" element={<Compose />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

/** Open the sheet. Lazy-loaded, so it is awaited rather than got. */
async function openSheet() {
  const pill = await screen.findByRole("button", { name: "Publish" });
  await waitFor(() => expect(pill).not.toBeDisabled());
  fireEvent.click(pill);
  return screen.findByTestId("publish-sheet");
}

/** The sheet's own Publish: the whole path, end to end. */
async function pressConfirm() {
  const confirm = (await screen.findByTestId("publish-confirm")) as HTMLButtonElement;
  await waitFor(() => expect(confirm).not.toBeDisabled());
  fireEvent.click(confirm);
}

/** Every createBountyForGap argument, in the order they were filed. */
function filings(): Record<string, unknown>[] {
  return createBountyForGap.mock.calls.map(
    (call) => call[0] as Record<string, unknown>
  );
}

describe("pricing the gaps at publish time", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMediaForBuild.mockResolvedValue([]);
    getLayers.mockResolvedValue([]);
    listBountiesForBuild.mockResolvedValue([]);
    createBountyForGap.mockImplementation(async (input: { nodeId: string }) =>
      bountyRow({ id: `bo-${input.nodeId}`, gap_node_id: input.nodeId })
    );
    updateBuild.mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({
      ...draft(),
      ...patch,
    }));
  });

  it("asks about the holes, counting what the creator marked", async () => {
    getBuild.mockResolvedValue(withTwoGaps());
    renderCompose();

    const sheet = await openSheet();
    const section = within(sheet).getByTestId("bounty-section");

    expect(section).toHaveTextContent("You’ve marked 2 parts unsolved.");
    expect(section).toHaveTextContent("Put a bounty on them?");
    // One row per gap, each carrying what its creator said was wrong.
    expect(within(section).getAllByTestId("bounty-gap-row")).toHaveLength(2);
    expect(section).toHaveTextContent("Sampling settings");
    expect(section).toHaveTextContent("Above 0.4 it invents citations.");
    // The sentence that keeps the board from becoming a board of paid work only.
    expect(section).toHaveTextContent("still filed as an open bounty");
  });

  // ACCEPTANCE 3
  it("says nothing at all about bounties when nothing is marked unsolved", async () => {
    getBuild.mockResolvedValue(withNoGaps());
    renderCompose();

    const sheet = await openSheet();
    expect(within(sheet).queryByTestId("bounty-section")).toBeNull();

    await pressConfirm();

    // The plain publish path, untouched: the build goes live and no bounty is
    // filed or even attempted.
    await waitFor(() => expect(screen.getByText("It’s live.")).toBeInTheDocument());
    expect(createBountyForGap).not.toHaveBeenCalled();
  });

  // ACCEPTANCE 2
  it("files one bounty per gap — the priced one priced, the other still open", async () => {
    getBuild.mockResolvedValue(withTwoGaps());
    renderCompose();

    const sheet = await openSheet();
    const rewards = within(sheet).getAllByTestId("bounty-reward-input");
    expect(rewards).toHaveLength(2);
    fireEvent.change(rewards[0], { target: { value: "50" } });

    await pressConfirm();

    await waitFor(() => expect(filings()).toHaveLength(2));
    // The gap_node_id is the whole point: a bounty filed against the wrong node
    // is a question nobody can answer.
    expect(filings()[0]).toEqual({
      buildId: "b1",
      nodeId: "g1",
      rewardGbp: 50,
      closesAt: null,
    });
    expect(filings()[1]).toEqual({
      buildId: "b1",
      nodeId: "g2",
      rewardGbp: null,
      closesAt: null,
    });

    // And the build is live, which is the thing that had to happen first.
    await waitFor(() => expect(screen.getByText("It’s live.")).toBeInTheDocument());
    expect(screen.getByTestId("bounty-outcome")).toHaveTextContent(
      "2 bounties are open on this build."
    );
  });

  it("carries a deadline through as the end of the day it names", async () => {
    getBuild.mockResolvedValue(withTwoGaps());
    renderCompose();

    const sheet = await openSheet();
    fireEvent.change(within(sheet).getAllByTestId("bounty-deadline-input")[0], {
      target: { value: "2026-09-15" },
    });

    await pressConfirm();

    await waitFor(() => expect(filings()).toHaveLength(2));
    const closesAt = filings()[0].closesAt as string;
    const closes = new Date(closesAt);
    expect(closes.getFullYear()).toBe(2026);
    expect(closes.getMonth()).toBe(8);
    expect(closes.getDate()).toBe(15);
    expect(closes.getHours()).toBe(23);
  });

  it("files nothing when the creator publishes without bounties", async () => {
    getBuild.mockResolvedValue(withTwoGaps());
    renderCompose();

    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByTestId("bounty-skip"));

    await pressConfirm();

    await waitFor(() => expect(screen.getByText("It’s live.")).toBeInTheDocument());
    expect(createBountyForGap).not.toHaveBeenCalled();
  });

  it("leaves a gap out when its own tick is cleared, and files the rest", async () => {
    getBuild.mockResolvedValue(withTwoGaps());
    renderCompose();

    const sheet = await openSheet();
    const rows = within(sheet).getAllByTestId("bounty-gap-row");
    fireEvent.click(within(rows[0]).getByRole("checkbox"));

    await pressConfirm();

    await waitFor(() => expect(filings()).toHaveLength(1));
    expect(filings()[0].nodeId).toBe("g2");
  });

  it("does not offer a gap that already carries an ask", async () => {
    listBountiesForBuild.mockResolvedValue([bountyRow({ gap_node_id: "g1" })]);
    getBuild.mockResolvedValue(withTwoGaps());
    renderCompose();

    // The tree says so too — one read feeds both surfaces.
    await waitFor(() =>
      expect(screen.getAllByTestId("bounty-node-pill").length).toBe(1)
    );

    const sheet = await openSheet();
    const rows = within(sheet).getAllByTestId("bounty-gap-row");
    expect(rows[0]).toHaveTextContent("Already has a bounty.");
    // Nothing to price on a gap that is already spoken for.
    expect(within(rows[0]).queryByTestId("bounty-reward-input")).toBeNull();
    expect(within(rows[0]).getByRole("checkbox")).toBeDisabled();

    await pressConfirm();
    await waitFor(() => expect(filings()).toHaveLength(1));
    expect(filings()[0].nodeId).toBe("g2");
  });

  // THE ONE TO KEEP.
  it("keeps the build live when a bounty cannot be filed, and offers the failure back", async () => {
    getBuild.mockResolvedValue(withTwoGaps());
    createBountyForGap.mockImplementation(async (input: { nodeId: string }) => {
      if (input.nodeId === "g1") throw new Error("insert failed");
      return bountyRow({ gap_node_id: input.nodeId });
    });
    renderCompose();

    await openSheet();
    await pressConfirm();

    // Published. Not rolled back, not retried, not undone.
    await waitFor(() => expect(screen.getByText("It’s live.")).toBeInTheDocument());
    const publishPatches = updateBuild.mock.calls
      .map((call) => call[1] as Record<string, unknown>)
      .filter((patch) => "status" in patch);
    expect(publishPatches).toHaveLength(1);
    expect(publishPatches[0].status).toBe("published");

    const outcome = await screen.findByTestId("bounty-outcome");
    expect(outcome).toHaveTextContent("Your build is live.");
    expect(outcome).toHaveTextContent("could not be filed");
    expect(outcome).toHaveTextContent("Sampling settings");

    // The retry re-files the failed one and nothing else.
    createBountyForGap.mockImplementation(async (input: { nodeId: string }) =>
      bountyRow({ gap_node_id: input.nodeId })
    );
    fireEvent.click(screen.getByTestId("bounty-retry"));

    await waitFor(() => expect(filings()).toHaveLength(3));
    expect(filings()[2].nodeId).toBe("g1");
    await waitFor(() =>
      expect(screen.getByTestId("bounty-outcome")).toHaveTextContent(
        "2 bounties are open on this build."
      )
    );
  });
});

// --- the pure parts ----------------------------------------------------------
//
// Small enough to state directly, and worth stating: every one of them decides
// what reaches a NUMERIC column or a timestamptz on somebody's public board.

describe("what a typed reward and a typed deadline become", () => {
  it("reads an empty reward as unpriced rather than as zero", () => {
    expect(parseReward("")).toBeNull();
    expect(parseReward("   ")).toBeNull();
    // Zero is a real answer someone typed, and is not the same as no answer.
    expect(parseReward("0")).toBe(0);
  });

  it("takes an amount however it is spelled, and refuses a judgement", () => {
    expect(parseReward("50")).toBe(50);
    expect(parseReward(" 49.99 ")).toBe(49.99);
    expect(parseReward("about fifty")).toBeNull();
    expect(parseReward("-10")).toBeNull();
  });

  it("closes a deadline at the end of the day it names, not the start", () => {
    const closesAt = closesAtFrom("2026-09-15");
    expect(closesAt).not.toBeNull();
    const closes = new Date(closesAt as string);
    expect(closes.getDate()).toBe(15);
    expect(closes.getHours()).toBe(23);
    expect(closesAtFrom("")).toBeNull();
    expect(closesAtFrom("next tuesday")).toBeNull();
  });

  it("says what happened in one sentence that leads with the build being live", () => {
    expect(bountyFailureSentence([], 2)).toBe("");
    expect(bountyFailureSentence(["The eval set"], 2)).toContain("Your build is live.");
    expect(bountyFailureSentence(["The eval set"], 2)).toContain("1 of the 2 bounties");
    expect(bountyFailureSentence(["A", "B"], 2)).toContain("“A” and “B”");
    expect(bountyFailureSentence(["A"], 1)).toContain("The bounty could not be filed");
    expect(bountyFiledSentence(0)).toBe("");
    expect(bountyFiledSentence(1)).toContain("One bounty is open");
    expect(bountyFiledSentence(3)).toContain("3 bounties are open");
  });
});
