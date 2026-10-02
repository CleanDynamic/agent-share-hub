// UI-P29 — the Build page's container: every action the old first screen offered
// still works here, through the data layer's own functions.
//
// The data layer is stubbed and its calls are read back, as the legacy page's
// test does: what is claimed is which function each control reaches, with what.

import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getBuildBySlug = vi.fn();
const getMediaForBuild = vi.fn().mockResolvedValue([]);
const getApprovedLayers = vi.fn().mockResolvedValue([]);
const listRebuilds = vi.fn().mockResolvedValue([]);
const getBuild = vi.fn().mockResolvedValue(null);
const getBuildHeader = vi.fn();
const recordReproduction = vi.fn();
const recordSelfConfirmation = vi.fn();
const getBuildFamily = vi.fn().mockResolvedValue(null);
const getWhereNext = vi.fn().mockResolvedValue({ rebuilds: [], sharedTool: null, fromMaker: [], makerName: null });
const listRebuildCards = vi.fn().mockResolvedValue([]);
const listBuildBounties = vi.fn().mockResolvedValue([]);
const getCreatedVia = vi.fn().mockResolvedValue(null);
const isBuildHidden = vi.fn().mockResolvedValue(false);
const auth = vi.hoisted(() => ({ isLoggedIn: false, userId: null as string | null }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoggedIn: auth.isLoggedIn, user: auth.userId ? { id: auth.userId } : null }),
}));
vi.mock("@/lib/moderation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/moderation")>()),
  isBuildHidden: (buildId: string) => isBuildHidden(buildId),
}));
vi.mock("@/lib/social", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/social")>()),
  getEngagementCounts: vi.fn(async () => ({})),
  listComments: vi.fn(async () => ({ comments: [], rows: [], nextAfter: null })),
  listPartCommentCounts: vi.fn(async () => ({})),
}));
vi.mock("@/lib/profile/makerName", () => ({ getMakerName: vi.fn(async () => "Maya Okafor") }));
vi.mock("@/lib/build/provenance", () => ({ getCreatedVia: (buildId: string) => getCreatedVia(buildId) }));
vi.mock("@/lib/bounty", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/bounty")>()),
  listBuildBounties: (input: unknown) => listBuildBounties(input),
  listSolverHandles: vi.fn(async () => new Map()),
  listSolutionBuilds: vi.fn(async () => new Map()),
}));
/* UI-P30 — the solve sheet is the bounty layer's own component; here it only has to open. */
vi.mock("@/components/bounty/SolvePanel", () => ({
  SolvePanel: ({ open, bounty, gapNode }: { open: boolean; bounty: { id: string }; gapNode: { title: string } }) =>
    open ? <div role="dialog" aria-label="Solve" data-bounty-id={bounty.id}>{`Solving ${gapNode.title}`}</div> : null,
}));
vi.mock("@/lib/build", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build")>()),
  getBuildBySlug: (slug: string) => getBuildBySlug(slug),
  getMediaForBuild: (buildId: string) => getMediaForBuild(buildId),
  getApprovedLayers: (buildId: string) => getApprovedLayers(buildId),
  listRebuilds: (buildId: string) => listRebuilds(buildId),
  getBuild: (id: string) => getBuild(id),
  getBuildHeader: (id: string) => getBuildHeader(id),
  recordReproduction: (input: unknown) => recordReproduction(input),
  recordSelfConfirmation: (input: unknown) => recordSelfConfirmation(input),
  getBuildFamily: (input: unknown) => getBuildFamily(input),
  getWhereNext: (input: unknown) => getWhereNext(input),
  listRebuildCards: (buildId: string) => listRebuildCards(buildId),
  signedMediaUrl: async (media: { path: string }) => `https://media.test/${media.path}`,
}));

import { BuildPage } from "./BuildPage";
import { shortDate } from "./buildModel";

const nodeTypes = [
  { key: "system_prompt", label: "System prompt", category: "instruction", renderer: "instruction", copyable: true, is_active: true, sort: 1,
    schema: { fields: [{ key: "text", label: "Text", type: "text" }] } },
  { key: "agent_config", label: "Agent configuration", category: "configuration", renderer: "agent_config", copyable: false, is_active: true, sort: 2,
    schema: { fields: [{ key: "model", label: "Model", type: "string" }, { key: "guardrails", label: "Guardrails", type: "list", of: [{ key: "rule", label: "Rule", type: "string" }] }] } },
  { key: "prerequisite", label: "Prerequisite", category: "narrative", renderer: "narrative", copyable: false, is_active: true, sort: 4,
    schema: { fields: [{ key: "requirement", label: "Requirement", type: "text" }] } },
  { key: "gap", label: "Gap", category: "narrative", renderer: "gap", copyable: false, is_active: true, sort: 5,
    schema: { fields: [{ key: "problem", label: "Problem", type: "text" }] } },
];

const node = (id: string, type: string, title: string, extra = {}) => ({
  id, build_id: "b", parent_id: null, position: 0, type, title, note: null,
  payload: {}, source_ref: null, event_id: null, is_gap: false, created_at: "", children: [], ...extra,
});

const header = {
  id: "b", slug: "inbox-triage", title: "Inbox triage agent", outcome: "Sorts a full inbox.", creator_id: "maker",
  shape: "agent", status: "published", made_for: ["founders"], made_with: ["claude-opus-4-5"],
  live_url: null, repo_url: null, hero_node_id: null, cover_media_id: null,
  cost_setup: 0, cost_monthly: 18.4, currency: "GBP", time_to_first_result: 35,
  completeness: 60, reproduction_count: 0, rebuild_count: 0, last_confirmed_at: null, last_confirmed_model: null,
  published_at: "2026-09-01T00:00:00Z", parent_build_id: null, root_build_id: null,
  source_title_at_fork: null, source_handle_at_fork: null,
};

const at = (minutes: number) => new Date(Date.parse("2026-09-09T10:00:00Z") + minutes * 60_000).toISOString();

const record = {
  build: header,
  tree: [
    node("n1", "system_prompt", "Triage system prompt", { payload: { text: "You triage a professional inbox." } }),
    node("n2", "agent_config", "Agent configuration", {
      position: 1,
      payload: { model: "claude-opus-4-5", guardrails: [{ rule: "Never send." }, { rule: "Never invent a date." }] },
      children: [node("n3", "prerequisite", "A Google account", { parent_id: "n2", payload: { requirement: "Gmail API access." } })],
    }),
    node("n4", "gap", "Calendar-aware delegation", { position: 2, is_gap: true, payload: { problem: "It cannot tell who to delegate to." } }),
  ],
  tray: [node("t1", "system_prompt", "A tray note nobody placed", { position: null })],
  events: [
    { ordinal: 1, kind: "prompt", visibility: "kept", payload: { text: "Wrote the outcome" }, occurred_at: at(0) },
    { ordinal: 2, kind: "note", visibility: "folded", payload: { text: "Folded away" }, occurred_at: at(2) },
    { ordinal: 3, kind: "breakage", visibility: "kept", payload: { symptom: "Long threads came back archive." }, occurred_at: at(11) },
    { ordinal: 4, kind: "milestone", visibility: "kept", payload: { text: "91% after the fix" }, occurred_at: at(26.5) },
  ].map((spec) => ({ id: `e${spec.ordinal}`, build_id: "b", phase: 1, phase_title: "Reading", produced_node_id: null, created_at: "", ...spec })),
  nodeTypes,
  maker: { username: "maya", displayName: "Maya Okafor" },
};

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="path">{`${location.pathname}${location.search}`}</span>;
}

function renderAt(slug = "inbox-triage") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/b2/${slug}`]}>
          <LocationProbe />
          <Routes>
            <Route path="/b2/:slug" element={<BuildPage />} />
            <Route path="*" element={<p>elsewhere</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  getBuildBySlug.mockResolvedValue(record);
  getMediaForBuild.mockResolvedValue([]);
  getApprovedLayers.mockResolvedValue([]);
  listRebuilds.mockResolvedValue([]);
  getBuild.mockResolvedValue(null);
  getCreatedVia.mockResolvedValue(null);
  isBuildHidden.mockResolvedValue(false);
  getWhereNext.mockResolvedValue({ rebuilds: [], sharedTool: null, fromMaker: [], makerName: null });
  listRebuildCards.mockResolvedValue([]);
  listBuildBounties.mockResolvedValue([]);
  auth.isLoggedIn = false;
  auth.userId = null;
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BuildPage (site frame)", () => {
  it("draws the first screen from the record, and never the tray", async () => {
    renderAt();
    expect(await screen.findByRole("heading", { level: 1, name: "Inbox triage agent" })).toBeTruthy();
    expect(screen.getByTestId("build-shape-tag").textContent).toBe("agent");
    expect(screen.getByText("0 ran it")).toBeTruthy();
    expect(screen.getByText("not yet reproduced")).toBeTruthy();
    expect(screen.getByText("£18.40")).toBeTruthy();
    expect(screen.getByText("35 min")).toBeTruthy();
    expect(screen.getByText("A Google account", { selector: "div" })).toBeTruthy();
    expect(screen.getByTestId("build-hero").textContent).toContain("made by @maya");

    const rows = screen.getAllByTestId("build-part-row");
    expect(rows.map((row) => row.getAttribute("data-part-id"))).toEqual(["n1", "n2", "n3", "n4"]);
    expect(screen.getByTestId("build-anatomy").textContent).toContain("4 parts · 1 left open");
    expect(rows[1].textContent).toContain("2 guardrails");
    expect(rows[3].hasAttribute("data-gap")).toBe(true);
    expect(screen.queryByText("A tray note nobody placed")).toBeNull();

    const timeline = screen.getByTestId("build-timeline");
    expect(timeline.textContent).toContain("26 minutes · 3 events kept");
    expect(within(timeline).getAllByRole("listitem")).toHaveLength(3);
  });

  it("shows the selected part in the viewer, and the switch reads it the other way", async () => {
    renderAt();
    await screen.findByRole("heading", { level: 1, name: "Inbox triage agent" });
    const viewer = screen.getByTestId("build-viewer");
    expect(viewer.textContent).toContain("01 · Triage system prompt");
    expect(viewer.textContent).toContain("You triage a professional inbox.");

    fireEvent.click(screen.getAllByTestId("build-part-row")[2]);
    expect(viewer.textContent).toContain("03 · A Google account");

    fireEvent.click(within(viewer).getByRole("button", { name: "Understand" }));
    expect(viewer.textContent).toContain("There is no plain-language reading of this part yet.");
    expect(within(viewer).getByRole("tab", { name: "Anatomy" }).getAttribute("aria-selected")).toBe("true");
  });

  it("opens every existing tab, and the switch moves between Run and Understand", async () => {
    renderAt();
    await screen.findByRole("heading", { level: 1, name: "Inbox triage agent" });
    const viewer = screen.getByTestId("build-viewer");
    const tab = (name: string) => within(viewer).getByRole("tab", { name });

    fireEvent.click(tab("Watch it get built"));
    expect(tab("Watch it get built").getAttribute("aria-selected")).toBe("true");
    // UI-P30: the replay is the site frame's own body now, not the legacy Replay.
    expect(within(viewer).getByTestId("build-replay")).toBeTruthy();

    fireEvent.click(tab("Run it yourself"));
    expect(within(viewer).getByRole("button", { name: "Run" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(viewer).getByRole("button", { name: "Understand" }));
    expect(tab("Understand it").getAttribute("aria-selected")).toBe("true");
    expect(viewer.textContent).toContain("There is no plain-language reading of this build yet.");

    fireEvent.click(tab("Where it broke"));
    expect(tab("Where it broke").getAttribute("aria-selected")).toBe("true");
    expect(viewer.textContent).toContain("Long threads came back archive.");

    expect(within(viewer).queryByRole("tab", { name: "Rebuilds" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Play the build" }));
    expect(tab("Watch it get built").getAttribute("aria-selected")).toBe("true");
  });

  it("copies the build for AI as markdown, and copies a part", async () => {
    renderAt();
    await screen.findByRole("heading", { level: 1, name: "Inbox triage agent" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy for AI" }));
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain("# Inbox triage agent");

    await act(async () => {
      fireEvent.click(within(screen.getByTestId("build-viewer")).getByRole("button", { name: "Copy" }));
    });
    expect(writeText).toHaveBeenLastCalledWith("You triage a professional inbox.");
  });

  it("downloads the portable file", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    renderAt();
    await screen.findByRole("heading", { level: 1, name: "Inbox triage agent" });
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(click).toHaveBeenCalledTimes(1);
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe("inbox-triage.neoscale.json");
  });

  it("sends a signed-out reader to sign in, for confirming and for rebuilding", async () => {
    renderAt();
    await screen.findByRole("heading", { level: 1, name: "Inbox triage agent" });
    fireEvent.click(screen.getByRole("button", { name: "Sign in to confirm" }));
    expect(screen.getByTestId("path").textContent).toBe("/login?redirect=%2Fb2%2Finbox-triage");
  });

  it("rebuilds through /rebuild/:slug, by way of sign-in when signed out", async () => {
    renderAt();
    await screen.findByRole("heading", { level: 1, name: "Inbox triage agent" });
    fireEvent.click(screen.getByRole("button", { name: "Rebuild" }));
    expect(screen.getByTestId("path").textContent).toBe("/login?redirect=%2Frebuild%2Finbox-triage");

    auth.isLoggedIn = true;
    auth.userId = "reader";
    renderAt();
    const rebuild = (await screen.findAllByRole("button", { name: "Rebuild" })).at(-1)!;
    fireEvent.click(rebuild);
    expect(screen.getAllByTestId("path").at(-1)?.textContent).toBe("/rebuild/inbox-triage");
  });

  it("records a reader's reproduction with the model they used, then shows the count the database holds", async () => {
    auth.isLoggedIn = true;
    auth.userId = "reader";
    recordReproduction.mockResolvedValue({ id: "r1" });
    getBuildHeader.mockResolvedValue({ ...header, reproduction_count: 1, last_confirmed_at: new Date().toISOString(), last_confirmed_model: "sonnet-4.5" });
    renderAt();
    await screen.findByRole("heading", { level: 1, name: "Inbox triage agent" });
    expect(screen.queryByTestId("build-completeness")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "I ran this and it worked" }));
    const dialog = await screen.findByRole("dialog", { name: "You ran this build" });
    fireEvent.change(within(dialog).getByLabelText("Which model did you run it on?"), { target: { value: "sonnet-4.5" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "It worked" }));
    });

    expect(recordReproduction).toHaveBeenCalledWith({ buildId: "b", worked: true, modelUsed: "sonnet-4.5", note: "" });
    expect(recordSelfConfirmation).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("1 ran it")).toBeTruthy());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lets the creator re-confirm without inserting a reproduction, and shows them completeness", async () => {
    auth.isLoggedIn = true;
    auth.userId = "maker";
    recordSelfConfirmation.mockResolvedValue({ id: "b" });
    getBuildHeader.mockResolvedValue({ ...header, last_confirmed_at: new Date().toISOString(), last_confirmed_model: "claude-opus-4-5" });
    renderAt();
    await screen.findByRole("heading", { level: 1, name: "Inbox triage agent" });

    const block = screen.getByTestId("build-completeness");
    expect(block.textContent).toContain("PUBLISH 60");
    expect(block.textContent).toMatch(/Next: /);

    fireEvent.click(screen.getByRole("button", { name: "Re-confirm it still works" }));
    const dialog = await screen.findByRole("dialog", { name: "You ran your own build" });
    expect(within(dialog).queryByLabelText("Anything worth adding? (optional)")).toBeNull();
    fireEvent.change(within(dialog).getByLabelText("Which model did you run it on?"), { target: { value: "claude-opus-4-5" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "It still works" }));
    });

    expect(recordSelfConfirmation).toHaveBeenCalledWith({ buildId: "b", modelUsed: "claude-opus-4-5" });
    expect(recordReproduction).not.toHaveBeenCalled();
    // The clock moves; the count, and so the plaque, stays other people's.
    await waitFor(() => expect(screen.getByText(`last ${shortDate(new Date().toISOString())}`)).toBeTruthy());
    expect(screen.getByText("0 ran it")).toBeTruthy();
    expect(screen.getByText("not yet reproduced")).toBeTruthy();
  });

  it("says why a reproduction could not be recorded, and keeps the dialog open", async () => {
    auth.isLoggedIn = true;
    auth.userId = "reader";
    recordReproduction.mockRejectedValue(new Error("recordReproduction failed: new row violates row-level security policy"));
    renderAt();
    await screen.findByRole("heading", { level: 1, name: "Inbox triage agent" });
    fireEvent.click(screen.getByRole("button", { name: "I ran this and it worked" }));
    const dialog = await screen.findByRole("dialog", { name: "You ran this build" });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "It worked" }));
    });
    expect(within(dialog).getByRole("alert").textContent).toContain("row-level security");
  });

  it("credits a rebuild's source and says what changed against it", async () => {
    const source = {
      ...record,
      build: { ...header, id: "src", slug: "inbox-sorter", title: "Inbox sorter" },
      tree: [node("s1", "system_prompt", "Triage system prompt", { payload: { text: "You sort an inbox." } })],
    };
    getBuildBySlug.mockResolvedValue({
      ...record,
      build: { ...header, parent_build_id: "src", source_title_at_fork: "Inbox sorter", source_handle_at_fork: "kofi" },
    });
    getBuild.mockResolvedValue(source);
    renderAt();
    await screen.findByRole("heading", { level: 1, name: "Inbox triage agent" });
    const hero = screen.getByTestId("build-hero");
    expect(hero.textContent).toContain("Rebuilt from Inbox sorter by @kofi · made by @maya");
    await waitFor(() => expect(hero.textContent).toMatch(/Δ .+/));
    expect(getBuild).toHaveBeenCalledWith("src");
  });

  it("tags a build that came through the connector", async () => {
    getCreatedVia.mockResolvedValue({ source: "connector", client: "claude", imports: ["i1"] });
    renderAt();
    await waitFor(() => expect(screen.getByTestId("build-shape-tag").textContent).toBe("agent · via connector"));
  });

  it("says when there is no build at the address", async () => {
    getBuildBySlug.mockResolvedValue(null);
    renderAt("nothing-here");
    expect(await screen.findByRole("heading", { level: 1, name: "No build at this address." })).toBeTruthy();
  });

  it("says when the build could not be read, and tries again", async () => {
    getBuildBySlug.mockRejectedValueOnce(new Error("boom"));
    renderAt();
    expect(await screen.findByRole("heading", { level: 1, name: "This build could not be loaded." })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Inbox triage agent" })).toBeTruthy();
  });
});

/* ── UI-P30 — the tab bodies and the sections under the first screen ── */

/** A build as a card reads it (GalleryBuild): the header, with its nodes, pictures and asks. */
const galleryCard = (id: string, title: string) => ({
  ...header,
  id,
  slug: id,
  title,
  rebuild_note: null,
  nodes: [],
  media: [],
  bounties: [],
});

async function openTab(name: string) {
  renderAt();
  await screen.findByRole("heading", { level: 1, name: "Inbox triage agent" });
  const viewer = screen.getByTestId("build-viewer");
  fireEvent.click(within(viewer).getByRole("tab", { name }));
  return viewer;
}

describe("BuildPage (site frame) — the tab bodies, UI-P30", () => {
  it("replays the build: a slider over the steps, play and pause, and the step's kind and line", async () => {
    const viewer = await openTab("Watch it get built");
    // A body that is not a reading of the part drops the switch and Copy.
    expect(within(viewer).queryByRole("button", { name: "Run" })).toBeNull();

    const slider = within(viewer).getByRole("slider", { name: "Step through the build" });
    expect(slider.getAttribute("max")).toBe("3");
    const current = within(viewer).getByTestId("build-replay-current");
    expect(current.textContent).toContain("prompt");
    expect(current.textContent).toContain("Wrote the outcome");

    fireEvent.change(slider, { target: { value: "2" } });
    expect(current.textContent).toContain("breakage");
    expect(current.textContent).toContain("Long threads came back archive.");
    expect(within(viewer).getByText("step 3 of 4")).toBeTruthy();

    const steps = within(viewer).getAllByTestId("build-replay-step");
    expect(steps).toHaveLength(4);
    fireEvent.click(steps[3]);
    expect(current.textContent).toContain("91% after the fix");
    expect(steps[3].getAttribute("aria-current")).toBe("step");

    fireEvent.click(within(viewer).getByRole("button", { name: "Play the build" }));
    expect(within(viewer).getByRole("button", { name: "Pause the build" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(viewer).getByRole("button", { name: "Rebuild from here" })).toBeTruthy();
  });

  it("marks a step somebody rebuilt from, and the Rebuilds tab draws them as cards with the way to the family", async () => {
    listRebuilds.mockResolvedValue([
      {
        id: "rb1",
        slug: "rb1",
        title: "Inbox triage, faster",
        creator: { id: "u2", username: "kofi", display_name: null, avatar_url: null },
        rebuild_note: null,
        created_at: "2026-09-20T00:00:00Z",
        forked_from_event_id: "e3",
        reproduction_count: 2,
      },
    ]);
    listRebuildCards.mockResolvedValue([galleryCard("rb1", "Inbox triage, faster")]);
    renderAt();
    await screen.findByRole("heading", { level: 1, name: "Inbox triage agent" });
    const viewer = screen.getByTestId("build-viewer");

    fireEvent.click(await within(viewer).findByRole("tab", { name: "Watch it get built" }));
    const marker = await within(viewer).findByTestId("divergence-marker");
    expect(marker.getAttribute("aria-label")).toBe("@kofi rebuilt from here");
    expect(marker.getAttribute("data-divergence-ordinal")).toBe("3");

    fireEvent.click(within(viewer).getByRole("tab", { name: "Rebuilds" }));
    await waitFor(() => expect(within(viewer).getAllByTestId("build-rebuild-card")).toHaveLength(1));
    expect(listRebuildCards).toHaveBeenCalledWith("b");
    expect(within(viewer).getByRole("link", { name: "Inbox triage, faster" }).getAttribute("href")).toBe("/b2/rb1");
    expect(within(viewer).getByRole("link", { name: "See the family tree" }).getAttribute("href")).toBe("/b2/inbox-triage/lineage");
  });

  it("lists the sequence to run: numbered steps in a well, each with its own Copy, and the checklist before them", async () => {
    const viewer = await openTab("Run it yourself");
    // Run and Understand stay a reading of the part, so the switch stays.
    expect(within(viewer).getByRole("button", { name: "Run" }).getAttribute("aria-pressed")).toBe("true");

    const steps = within(viewer).getAllByTestId("build-run-step");
    expect(steps).toHaveLength(1);
    expect(steps[0].textContent).toContain("01");
    expect(within(steps[0]).getByTestId("build-run-well").textContent).toBe("You triage a professional inbox.");
    expect(within(viewer).getByTestId("build-run-before").textContent).toContain("A Google account — Gmail API access.");

    await act(async () => {
      fireEvent.click(within(steps[0]).getByRole("button", { name: "Copy step 1: Triage system prompt" }));
    });
    expect(writeText).toHaveBeenLastCalledWith("You triage a professional inbox.");
    await act(async () => {
      fireEvent.click(within(viewer).getByRole("button", { name: "Copy all steps" }));
    });
    expect(writeText.mock.calls.at(-1)?.[0]).toContain("1. Triage system prompt\nYou triage a professional inbox.");
  });

  it("offers an approved run layer beside the sequence, in words that name their parts, under its attribution", async () => {
    getApprovedLayers.mockResolvedValue([
      { id: "l1", build_id: "b", layer: "run", status: "approved", content: { steps: [{ n: 1, title: "Paste the prompt", body: "Into a new chat.", node_ref: "n1" }] } },
    ]);
    const viewer = await openTab("Run it yourself");
    fireEvent.click(await within(viewer).findByRole("button", { name: "In words" }));
    expect(within(viewer).getByTestId("layer-attribution").textContent).toBe(
      "Written by buildgallery from this build’s record, reviewed by the creator.",
    );
    expect(within(viewer).getByTestId("build-layer-step").textContent).toContain("Paste the prompt");
    fireEvent.click(within(viewer).getByRole("button", { name: "Triage system prompt in the anatomy →" }));
    expect(within(viewer).getByRole("tab", { name: "Anatomy" }).getAttribute("aria-selected")).toBe("true");
  });

  it("lists where it broke, opens the replay at that step, and shows the gap still open", async () => {
    const viewer = await openTab("Where it broke");
    const rows = within(viewer).getAllByTestId("build-breakage-row");
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("Breakage at step 3");
    expect(rows[0].textContent).toContain("Long threads came back archive.");

    const gap = within(viewer).getByTestId("build-open-gap");
    expect(gap.textContent).toContain("Calendar-aware delegation");
    expect(gap.textContent).toContain("It cannot tell who to delegate to.");
    // No bounty pays for this gap, so there is nothing to solve through.
    expect(within(gap).queryByRole("button", { name: /Solve it/ })).toBeNull();

    fireEvent.click(within(rows[0]).getByRole("button", { name: "Watch step 3 in the replay" }));
    expect(within(viewer).getByRole("tab", { name: "Watch it get built" }).getAttribute("aria-selected")).toBe("true");
    expect(within(viewer).getByTestId("build-replay-current").textContent).toContain("Long threads came back archive.");
  });

  it("opens a gap's bounty from Where it broke: its reward, and Solve it", async () => {
    listBuildBounties.mockResolvedValue([
      { bounty: { id: "bounty-1", gap_node_id: "n4", status: "open", reward_gbp: 150, closes_at: null, me_too_count: 0 }, solutions: 0, meToo: false },
    ]);
    const viewer = await openTab("Where it broke");
    const gap = within(viewer).getByTestId("build-open-gap");
    await waitFor(() => expect(gap.textContent).toContain("£150"));
    fireEvent.click(within(gap).getByRole("button", { name: "Solve it: Calendar-aware delegation" }));
    const sheet = await screen.findByRole("dialog", { name: "Solve" });
    expect(sheet.getAttribute("data-bounty-id")).toBe("bounty-1");
    expect(sheet.textContent).toBe("Solving Calendar-aware delegation");
  });

  it("shows a result in its frame, with the evidence chip and the date it carries", async () => {
    getBuildBySlug.mockResolvedValue({
      ...record,
      nodeTypes: [
        ...nodeTypes,
        { key: "result", label: "Result", category: "evidence", renderer: "evidence", copyable: false, is_active: true, sort: 6,
          schema: { fields: [{ key: "summary", label: "Summary", type: "text" }] } },
      ],
      tree: [node("r1", "result", "Run log", { payload: { summary: "214 invoices routed." }, created_at: "2026-09-29T08:00:00Z" }), ...record.tree],
    });
    renderAt();
    await screen.findByRole("heading", { level: 1, name: "Inbox triage agent" });
    const result = within(screen.getByTestId("build-viewer")).getByTestId("build-result");
    expect(result.textContent).toContain("evidence");
    expect(result.textContent).toContain("29 Sep");
    expect(within(result).getByTestId("build-result-frame").textContent).toContain("214 invoices routed.");
  });

  it("puts the comments and where next in glass panels under the first screen", async () => {
    getWhereNext.mockResolvedValue({
      rebuilds: [],
      sharedTool: null,
      fromMaker: [galleryCard("m1", "Meeting notes agent")],
      makerName: "Maya Okafor",
    });
    renderAt();
    await screen.findByRole("heading", { level: 1, name: "Inbox triage agent" });
    const lower = screen.getByTestId("build-lower");
    expect(within(lower).getByTestId("build-comments-panel").closest('[data-ui="panel"]')).not.toBeNull();

    const row = await within(lower).findByTestId("where-next-maker");
    expect(row.closest('[data-ui="panel"]')).not.toBeNull();
    expect(within(row).getByRole("heading", { level: 2, name: "More from Maya Okafor" })).toBeTruthy();
    expect(within(row).getAllByTestId("where-next-card")).toHaveLength(1);
    expect(getWhereNext).toHaveBeenCalledWith({ buildId: "b", creatorId: "maker", madeWith: ["claude-opus-4-5"] });
    // A row with nothing in it is left out.
    expect(within(lower).queryByTestId("where-next-rebuilds")).toBeNull();
  });
});
