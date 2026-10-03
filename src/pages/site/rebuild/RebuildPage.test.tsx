// UI-P31 — the Rebuild and lineage containers: which data-layer function each
// step reaches, with what, and what the reader is shown. The data layer is
// stubbed and its calls read back, as the build page's test does.

import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getBuildHeaderBySlug = vi.fn();
const getRebuildDraft = vi.fn();
const startRebuild = vi.fn();
const getBuild = vi.fn();
const getBuildFamily = vi.fn();
const getBuildClocks = vi.fn();
const publishRebuild = vi.fn();
const auth = vi.hoisted(() => ({ isLoggedIn: true, loading: false, userId: "me" as string | null }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoggedIn: auth.isLoggedIn, loading: auth.loading, user: auth.userId ? { id: auth.userId } : null }),
}));
vi.mock("@/lib/build", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build")>()),
  getBuildHeaderBySlug: (slug: string) => getBuildHeaderBySlug(slug),
  getRebuildDraft: (input: unknown) => getRebuildDraft(input),
  startRebuild: (input: unknown) => startRebuild(input),
  getBuild: (id: string) => getBuild(id),
  getBuildFamily: (input: unknown) => getBuildFamily(input),
  getBuildClocks: (ids: string[]) => getBuildClocks(ids),
  publishRebuild: (draft: unknown, note: unknown) => publishRebuild(draft, note),
}));

import { serialiseChangeSet, changeSet, NO_CHANGES_REASON } from "@/lib/build";

import { LineagePage } from "./LineagePage";
import { RebuildPage } from "./RebuildPage";
import { PICK_PROMPT, ROOT_NOTE } from "./LineageView";

const nodeTypes = [
  { key: "system_prompt", label: "System prompt", category: "instruction", renderer: "instruction", copyable: true, is_active: true, sort: 1,
    schema: { fields: [{ key: "text", label: "Text", type: "text" }] } },
  { key: "result", label: "Result", category: "evidence", renderer: "evidence", copyable: false, is_active: true, sort: 2,
    schema: { fields: [{ key: "summary", label: "Summary", type: "text" }] } },
];

const node = (id: string, type: string, title: string, payload: Record<string, unknown> = {}) => ({
  id, build_id: "b", parent_id: null, position: 0, type, title, note: null, payload,
  source_ref: null, event_id: null, is_gap: false, created_at: "", children: [],
});

const header = (over: Record<string, unknown>) => ({
  id: "src", slug: "invoice-triage", title: "Invoice triage agent", outcome: "Routes invoices.", creator_id: "maya",
  shape: "agent", status: "published", made_for: [], made_with: [], live_url: null, repo_url: null,
  hero_node_id: null, cover_media_id: null, cost_setup: null, cost_monthly: null, currency: null, time_to_first_result: null,
  completeness: 60, reproduction_count: 4, rebuild_count: 0, last_confirmed_at: null, last_confirmed_model: null,
  published_at: "2026-09-01T00:00:00Z", parent_build_id: null, root_build_id: null, forked_from_event_id: null,
  rebuild_note: null, source_title_at_fork: null, source_handle_at_fork: null, created_at: "", updated_at: "",
  ...over,
});

const SOURCE = header({});
const DRAFT = header({
  id: "draft", slug: "multi-currency-triage", title: "Multi-currency triage", creator_id: "me", status: "draft",
  published_at: null, reproduction_count: 0, parent_build_id: "src", root_build_id: "src",
  source_title_at_fork: "Invoice triage agent", source_handle_at_fork: "maya", rebuild_note: "Euros too.",
});

const sourceRecord = {
  build: SOURCE,
  tree: [node("s1", "system_prompt", "System prompt", { text: "You triage invoices." }), node("s2", "result", "Run log", { summary: "Worked." })],
  tray: [], events: [], nodeTypes,
};
/** A draft that changed its prompt: it diverged, and carries evidence, so the gate is open. */
const readyDraft = {
  build: DRAFT,
  tree: [node("d1", "system_prompt", "System prompt", { text: "You triage invoices in any currency." }), node("d2", "result", "Run log", { summary: "Worked." })],
  tray: [], events: [], nodeTypes,
};
/** A fresh fork: nothing changed yet. */
const freshDraft = {
  build: DRAFT,
  tree: [node("d1", "system_prompt", "System prompt", { text: "You triage invoices." }), node("d2", "result", "Run log", { summary: "Worked." })],
  tray: [], events: [], nodeTypes,
};

const familyRow = (id: string, title: string, parent: string | null, depth: number, children: unknown[] = []) => ({
  id, parent_build_id: parent, depth, slug: `${id}-slug`, title, creator_id: `${id}-maker`,
  published_at: "2026-09-01T00:00:00Z", reproduction_count: 2, rebuild_note: null,
  maker: { id: `${id}-maker`, username: `${id}maker`, display_name: null, avatar_url: null }, children,
});

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="path">{`${location.pathname}${location.search}`}</span>;
}

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <LocationProbe />
          <Routes>
            <Route path="/rebuild/:slug" element={<RebuildPage />} />
            <Route path="/b2/:slug/lineage" element={<LineagePage />} />
            <Route path="*" element={<p>elsewhere</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.isLoggedIn = true;
  auth.loading = false;
  auth.userId = "me";
  getBuildHeaderBySlug.mockResolvedValue(SOURCE);
  getRebuildDraft.mockResolvedValue(DRAFT);
  startRebuild.mockResolvedValue(DRAFT);
  getBuild.mockImplementation(async (id: string) => (id === "src" ? sourceRecord : id === "draft" ? readyDraft : null));
  getBuildFamily.mockResolvedValue(familyRow("src", "Invoice triage agent", null, 0, [familyRow("other", "Triage for NGOs", "src", 1)]));
  getBuildClocks.mockResolvedValue(new Map());
  publishRebuild.mockResolvedValue({ ...DRAFT, status: "published" });
});

const settled = () => screen.findByTestId("rebuild-view");

describe("RebuildPage (site frame)", () => {
  it("sends a signed-out reader to sign in and back", async () => {
    auth.isLoggedIn = false;
    auth.userId = null;
    renderAt("/rebuild/invoice-triage");
    await waitFor(() => expect(screen.getByTestId("path").textContent).toBe("/login?redirect=%2Frebuild%2Finvoice-triage"));
    expect(startRebuild).not.toHaveBeenCalled();
  });

  it("comes back to the reader's own draft rather than forking a second", async () => {
    renderAt("/rebuild/invoice-triage");
    await settled();
    expect(getRebuildDraft).toHaveBeenCalledWith({ sourceBuildId: "src", creatorId: "me" });
    expect(startRebuild).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Multi-currency triage: Rebuilding Invoice triage agent by @maya.");
  });

  it("starts one, once, when the reader has none", async () => {
    getRebuildDraft.mockResolvedValue(null);
    renderAt("/rebuild/invoice-triage");
    await settled();
    expect(startRebuild).toHaveBeenCalledTimes(1);
    expect(startRebuild).toHaveBeenCalledWith({ sourceBuildId: "src" });
  });

  it("lists what changed, line for line with serialiseChangeSet()", async () => {
    renderAt("/rebuild/invoice-triage");
    await settled();
    const keys = screen.getAllByTestId("change-row").map((row) => row.getAttribute("data-change-key"));
    expect(keys).toEqual(serialiseChangeSet(changeSet(sourceRecord as never, readyDraft as never)).map((line) => line.key));
    expect(keys.length).toBeGreaterThan(0);
  });

  it("draws the family with the reader's draft, dashed, under its source", async () => {
    renderAt("/rebuild/invoice-triage");
    await settled();
    await waitFor(() => expect(screen.getAllByTestId("family-node")).toHaveLength(3));
    const draft = screen.getAllByTestId("family-node").find((element) => element.hasAttribute("data-draft"));
    expect(draft?.getAttribute("href")).toBe("/b2/multi-currency-triage");
    expect(screen.getByText("Family of Invoice triage agent")).toBeTruthy();
    expect(getBuildClocks).toHaveBeenCalledWith(["src", "other", "draft"]);
  });

  it("carries the credit the fork froze, and publishes through publishRebuild with the workspace's note", async () => {
    renderAt("/rebuild/invoice-triage");
    await settled();
    expect(screen.getByTestId("rebuild-credit-line").textContent).toBe("Rebuilt from Invoice triage agent by @maya");
    expect(screen.getByText("Ready to hang")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Publish rebuild" }));
    });
    expect(publishRebuild).toHaveBeenCalledWith({ id: "draft", status: "draft", published_at: null }, "Euros too.");
    await waitFor(() => expect(screen.getByTestId("path").textContent).toBe("/b2/multi-currency-triage"));
  });

  it("will not publish an untouched fork, and says why", async () => {
    getBuild.mockImplementation(async (id: string) => (id === "src" ? sourceRecord : freshDraft));
    renderAt("/rebuild/invoice-triage");
    await settled();
    const publish = screen.getByRole("button", { name: "Publish rebuild" }) as HTMLButtonElement;
    expect(publish.disabled).toBe(true);
    expect(screen.getByText("One thing before it can hang")).toBeTruthy();
    expect(screen.getByTestId("rebuild-next").textContent).toBe(NO_CHANGES_REASON);
    fireEvent.click(publish);
    expect(publishRebuild).not.toHaveBeenCalled();
  });

  it("keeps the draft by going back to its workspace", async () => {
    renderAt("/rebuild/invoice-triage");
    await settled();
    fireEvent.click(screen.getByRole("button", { name: "Keep as draft" }));
    expect(screen.getByTestId("path").textContent).toBe("/compose/draft?from=rebuild");
  });

  it("says so when the slug names no build, and forks nothing", async () => {
    getBuildHeaderBySlug.mockResolvedValue(null);
    renderAt("/rebuild/nothing-here");
    expect(await screen.findByRole("heading", { level: 1, name: "No build at this address." })).toBeTruthy();
    expect(startRebuild).not.toHaveBeenCalled();
  });

  it("says That didn't load. when the fork fails, naming the draft, never the cause, and asks again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getRebuildDraft.mockResolvedValue(null);
    startRebuild.mockRejectedValueOnce(new Error("startRebuild failed: permission denied")).mockResolvedValue(undefined);
    renderAt("/rebuild/invoice-triage");
    const failed = await screen.findByTestId("rebuild-error");
    expect(failed.textContent).toContain("That didn't load.");
    expect(failed.textContent).toContain("Your draft");
    expect(screen.queryByText(/permission denied/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(startRebuild).toHaveBeenCalledTimes(2));
    vi.restoreAllMocks();
  });
});

describe("LineagePage (site frame)", () => {
  const rebuildRecord = {
    build: header({ id: "other", slug: "other-slug", title: "Triage for NGOs", parent_build_id: "src" }),
    tree: [node("o1", "system_prompt", "System prompt", { text: "You triage NGO invoices." })],
    tray: [], events: [], nodeTypes,
  };

  beforeEach(() => {
    getBuild.mockImplementation(async (id: string) => (id === "src" ? sourceRecord : id === "other" ? rebuildRecord : null));
  });

  it("draws the family, and asks the reader to pick a build before reading anything else", async () => {
    renderAt("/b2/invoice-triage/lineage");
    await screen.findByTestId("lineage-view");
    await waitFor(() => expect(screen.getAllByTestId("family-node")).toHaveLength(2));
    expect(getBuildFamily).toHaveBeenCalledWith({ rootId: "src", currentId: "src" });
    expect(screen.getByTestId("changes-panel").textContent).toContain(PICK_PROMPT);
    expect(getBuild).not.toHaveBeenCalled();
    // The build in the address is marked as where the reader is.
    expect(screen.getAllByTestId("family-node")[0].getAttribute("aria-current")).toBe("page");
  });

  it("shows what a picked rebuild changed against the build it came from", async () => {
    renderAt("/b2/invoice-triage/lineage");
    await screen.findByTestId("lineage-view");
    const nodes = await screen.findAllByTestId("family-node");
    fireEvent.click(nodes[1]);
    await waitFor(() => expect(screen.getAllByTestId("change-row").length).toBeGreaterThan(0));
    expect(getBuild).toHaveBeenCalledWith("other");
    expect(getBuild).toHaveBeenCalledWith("src");
    const keys = screen.getAllByTestId("change-row").map((row) => row.getAttribute("data-change-key"));
    expect(keys).toEqual(serialiseChangeSet(changeSet(sourceRecord as never, rebuildRecord as never)).map((line) => line.key));
    const panel = screen.getByTestId("changes-panel");
    expect(within(panel).getByRole("link", { name: "Open Triage for NGOs" }).getAttribute("href")).toBe("/b2/other-slug");
    expect(nodes[1].getAttribute("aria-pressed")).toBe("true");
  });

  it("says the root has nothing to compare with", async () => {
    renderAt("/b2/invoice-triage/lineage");
    await screen.findByTestId("lineage-view");
    fireEvent.click((await screen.findAllByTestId("family-node"))[0]);
    expect(screen.getByTestId("changes-panel").textContent).toContain(ROOT_NOTE);
    expect(getBuild).not.toHaveBeenCalled();
  });

  it("says a build nobody has rebuilt has no rebuilds, and that nothing has changed", async () => {
    getBuildFamily.mockResolvedValue(familyRow("src", "Invoice triage agent", null, 0));
    renderAt("/b2/invoice-triage/lineage");
    await screen.findByTestId("lineage-view");
    expect((await screen.findByTestId("family-empty")).textContent).toBe("This build has no rebuilds yet.");
    expect(screen.getByTestId("changes-empty").textContent).toBe("Nothing has changed yet.");
  });

  it("says when there is no build at the address", async () => {
    getBuildHeaderBySlug.mockResolvedValue(null);
    renderAt("/b2/nothing-here/lineage");
    expect(await screen.findByRole("heading", { level: 1, name: "No build at this address." })).toBeTruthy();
  });
});
