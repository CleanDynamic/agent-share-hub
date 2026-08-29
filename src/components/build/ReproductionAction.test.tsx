// Acceptance cover for the reader's action on /b2/:slug.
//
// Four things a type checker cannot see: a second user's reproduction moving
// the count on screen with no reload, the count outranking every other figure
// on the page, a build nobody has confirmed refusing to invent a freshness
// line, and a signed-out reader being sent to sign in and back rather than
// having the control hidden from them.
//
// Rendered through BuildPage rather than in isolation, because two of those
// four are claims about the whole page.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getBuildBySlug = vi.fn();
const getMediaForBuild = vi.fn().mockResolvedValue([]);
const getBuildHeader = vi.fn();
const getReproductions = vi.fn().mockResolvedValue([]);
const recordReproduction = vi.fn();
const recordSelfConfirmation = vi.fn();
const getForkOrigin = vi.fn().mockResolvedValue(null);

const auth = vi.hoisted(() => ({
  user: null as { id: string } | null,
  isLoggedIn: false,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: auth.user, isLoggedIn: auth.isLoggedIn }),
}));

/**
 * The bounty layer answers empty (NS-P52).
 *
 * BuildPage reads the open asks on the build and the handles behind any solve
 * credits; this file's builds have neither, and a page test about reproduction
 * should not depend on a network read about bounties.
 */
vi.mock("@/lib/bounty", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bounty")>();
  return {
    ...actual,
    listBuildBounties: async () => [],
    listSolverHandles: async () => new Map(),
  };
});

/** The writes and the reads around them are stubbed; the rest is real. */
vi.mock("@/lib/build", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/build")>();
  return {
    ...actual,
    getBuildBySlug: (slug: string) => getBuildBySlug(slug),
    getMediaForBuild: (buildId: string) => getMediaForBuild(buildId),
    getBuildHeader: (buildId: string) => getBuildHeader(buildId),
    getReproductions: (buildId: string, limit?: number) =>
      getReproductions(buildId, limit),
    recordReproduction: (input: unknown) => recordReproduction(input),
    recordSelfConfirmation: (input: unknown) => recordSelfConfirmation(input),
    getForkOrigin: (build: unknown) => getForkOrigin(build),
  };
});

import BuildPage from "@/pages/BuildPage";
import { COUNT_FONT_SIZE } from "@/components/build/ReproductionAction";
import { pageHeadingText } from "@/components/build/tokens";

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

const node = (id: string, type: string, title: string, extra = {}) => ({
  id, build_id: "b", parent_id: null, position: 0, type, title, note: null,
  payload: {}, source_ref: null, event_id: null, is_gap: false, created_at: "",
  children: [], ...extra,
});

const CREATOR = "creator-1";

/** A published build with a cost, a speed and a fork count to out-shout. */
function buildRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "b",
    creator_id: CREATOR,
    slug: "inbox-triage-agent-demo",
    title: "Inbox triage agent",
    outcome: "Sorts a full inbox.",
    shape: "prompt",
    status: "published",
    made_for: ["founder"],
    made_with: ["Claude Opus 4.5", "Supabase"],
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    cost_setup: 0,
    cost_monthly: 18.4,
    currency: "GBP",
    time_to_first_result: 35,
    completeness: 72,
    reproduction_count: 0,
    last_confirmed_at: null,
    last_confirmed_model: null,
    published_at: "2026-08-01T00:00:00Z",
    parent_build_id: null,
    root_build_id: null,
    forked_from_event_id: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function record(overrides: Record<string, unknown> = {}) {
  return {
    build: buildRow(overrides),
    tree: [
      node("n1", "prompt", "The classify prompt", { payload: { text: "Classify." } }),
      node("n2", "result", "91% agreement", { position: 1, payload: { text: "91%." } }),
    ],
    tray: [],
    events: [],
    nodeTypes,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="path">{`${location.pathname}${location.search}`}</span>;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/b2/inbox-triage-agent-demo"]}>
        <LocationProbe />
        <Routes>
          <Route path="/b2/:slug" element={<BuildPage />} />
          <Route path="/login" element={<span>login page</span>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/**
 * The reproduction block, once the record has loaded.
 *
 * Scoped once and held: React keeps the same DOM node across re-renders, so
 * the queries stay pointed at the block while the count moves inside it.
 */
async function block() {
  const count = await screen.findByTestId("reproduction-count");
  return within(
    count.closest('[data-visual-slot="build-reproduction"]') as HTMLElement
  );
}

describe("ReproductionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = null;
    auth.isLoggedIn = false;
    getMediaForBuild.mockResolvedValue([]);
    getReproductions.mockResolvedValue([]);
    getForkOrigin.mockResolvedValue(null);
  });

  it("increments the count for a second user without a reload", async () => {
    auth.user = { id: "reader-2" };
    auth.isLoggedIn = true;
    getBuildBySlug.mockResolvedValue(record({ reproduction_count: 2 }));
    recordReproduction.mockResolvedValue({
      id: "r1", build_id: "b", user_id: "reader-2", worked: true,
      model_used: "Claude Opus 4.5", note: null, confirmed_at: "2026-08-24T09:00:00Z",
    });
    // What the trigger has made of it by the time the row comes back.
    getBuildHeader.mockResolvedValue(
      buildRow({
        reproduction_count: 3,
        last_confirmed_at: "2026-08-24T09:00:00Z",
        last_confirmed_model: "Claude Opus 4.5",
      })
    );

    renderPage();
    const repro = await block();
    expect(repro.getByTestId("reproduction-count").textContent).toBe("2");

    fireEvent.click(repro.getByRole("button", { name: "I ran this and it worked" }));

    const model = await screen.findByPlaceholderText("e.g. Claude Opus 4.5");
    fireEvent.change(model, { target: { value: "Claude Opus 4.5" } });
    fireEvent.click(screen.getByRole("button", { name: "It worked" }));

    await waitFor(() =>
      expect(repro.getByTestId("reproduction-count").textContent).toBe("3")
    );
    expect(recordReproduction).toHaveBeenCalledWith({
      buildId: "b",
      worked: true,
      modelUsed: "Claude Opus 4.5",
      note: "",
    });
    // No refetch of the record: one small header read is what moved the number.
    expect(getBuildBySlug).toHaveBeenCalledTimes(1);
    expect(repro.getByText(/last confirmed working/)).toBeTruthy();
  });

  it("records the quieter answer with worked false", async () => {
    auth.user = { id: "reader-2" };
    auth.isLoggedIn = true;
    getBuildBySlug.mockResolvedValue(record({ reproduction_count: 2 }));
    recordReproduction.mockResolvedValue({
      id: "r1", build_id: "b", user_id: "reader-2", worked: false,
      model_used: null, note: "Rate limited.", confirmed_at: "2026-08-24T09:00:00Z",
    });
    getBuildHeader.mockResolvedValue(buildRow({ reproduction_count: 2 }));

    renderPage();
    const repro = await block();
    fireEvent.click(
      repro.getByRole("button", { name: "I ran this and it worked" })
    );
    fireEvent.change(
      screen.getByPlaceholderText(
        "What you changed, what tripped you up, what it cost you."
      ),
      { target: { value: "Rate limited." } }
    );
    fireEvent.click(screen.getByRole("button", { name: "it did not work" }));

    await waitFor(() =>
      expect(recordReproduction).toHaveBeenCalledWith({
        buildId: "b",
        worked: false,
        modelUsed: "",
        note: "Rate limited.",
      })
    );
    await waitFor(() =>
      expect(repro.getByText("You said it did not work")).toBeTruthy()
    );
  });

  it("renders the count larger than every other figure on the page", async () => {
    getBuildBySlug.mockResolvedValue(
      record({ reproduction_count: 12, cost_setup: 40, cost_monthly: 18.4 })
    );

    const { container } = renderPage();
    const count = await screen.findByTestId("reproduction-count");

    // Every element that puts a digit on the page under its own inline size.
    const sizes = Array.from(container.querySelectorAll<HTMLElement>("[style]"))
      .filter(
        (element) =>
          element !== count &&
          element.style.fontSize !== "" &&
          /\d/.test(element.textContent ?? "")
      )
      .map((element) => Number.parseFloat(element.style.fontSize));

    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.max(...sizes)).toBeLessThan(COUNT_FONT_SIZE);
    // And it outranks the page heading, which is the largest type token here.
    expect(COUNT_FONT_SIZE).toBeGreaterThan(Number(pageHeadingText.fontSize));
  });

  it("invents no freshness line for a build nobody has confirmed", async () => {
    getBuildBySlug.mockResolvedValue(record());

    renderPage();
    const repro = await block();
    expect(repro.getByTestId("reproduction-count").textContent).toBe("0");
    expect(repro.getByText("no one has run this yet")).toBeTruthy();
    expect(repro.getByText("not yet confirmed by anyone")).toBeTruthy();
    expect(repro.queryByText(/last confirmed working/)).toBeNull();
  });

  it("shows the control to a signed-out reader and sends them to login and back", async () => {
    getBuildBySlug.mockResolvedValue(record());

    renderPage();
    const repro = await block();
    fireEvent.click(
      repro.getByRole("button", { name: "I ran this and it worked" })
    );

    await waitFor(() =>
      expect(screen.getByTestId("path").textContent).toBe(
        "/login?redirect=%2Fb2%2Finbox-triage-agent-demo"
      )
    );
    expect(getReproductions).not.toHaveBeenCalled();
  });

  it("meets a returning reader with what they said last time", async () => {
    auth.user = { id: "reader-2" };
    auth.isLoggedIn = true;
    getBuildBySlug.mockResolvedValue(record({ reproduction_count: 1 }));
    getReproductions.mockResolvedValue([
      {
        id: "r1", build_id: "b", user_id: "reader-2", worked: true,
        model_used: "Sonnet 4.5", note: null, confirmed_at: "2026-08-20T09:00:00Z",
      },
    ]);

    renderPage();
    const repro = await block();
    expect(await repro.findByText("You confirmed this, on Sonnet 4.5")).toBeTruthy();
    expect(
      repro.queryByRole("button", { name: "I ran this and it worked" })
    ).toBeNull();
    expect(repro.getByRole("button", { name: "update the model" })).toBeTruthy();
  });

  it("asks a creator whose build has gone quiet, and writes no reproduction", async () => {
    auth.user = { id: CREATOR };
    auth.isLoggedIn = true;
    getBuildBySlug.mockResolvedValue(
      record({
        reproduction_count: 4,
        // Five months back: past STALE_AFTER_DAYS.
        last_confirmed_at: "2026-03-20T09:00:00Z",
        last_confirmed_model: "claude-sonnet-4-5",
      })
    );
    // recordSelfConfirmation writes new Date().toISOString(); the stub has to
    // say the same, or the "today" assertion below only holds on the day the
    // literal was typed. freshnessLabel renders relative to Date.now().
    const confirmedNow = new Date().toISOString();
    recordSelfConfirmation.mockResolvedValue({
      id: "b", last_confirmed_at: confirmedNow,
      last_confirmed_model: "Claude Opus 4.5", reproduction_count: 4,
    });
    getBuildHeader.mockResolvedValue(
      buildRow({
        reproduction_count: 4,
        last_confirmed_at: confirmedNow,
        last_confirmed_model: "Claude Opus 4.5",
      })
    );

    renderPage();
    const repro = await block();
    expect(repro.getByTestId("stale-prompt").textContent).toBe(
      "no one has confirmed this in four months — is it still working?"
    );
    // The reader's control is not offered to the author of the build.
    expect(
      repro.queryByRole("button", { name: "I ran this and it worked" })
    ).toBeNull();
    expect(getReproductions).not.toHaveBeenCalled();

    fireEvent.click(repro.getByRole("button", { name: "It still works" }));
    fireEvent.change(await screen.findByPlaceholderText("e.g. Claude Opus 4.5"), {
      target: { value: "Claude Opus 4.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "It still works" }));

    await waitFor(() =>
      expect(recordSelfConfirmation).toHaveBeenCalledWith({
        buildId: "b",
        modelUsed: "Claude Opus 4.5",
      })
    );
    expect(recordReproduction).not.toHaveBeenCalled();
    // The date moved; the count did not.
    await waitFor(() =>
      expect(repro.getByText(/last confirmed working today/)).toBeTruthy()
    );
    expect(repro.getByTestId("reproduction-count").textContent).toBe("4");
  });
});
