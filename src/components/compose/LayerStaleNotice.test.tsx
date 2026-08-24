// Acceptance cover for the staleness line.
//
// The claim is narrow and important: a creator is ASKED. Nothing in the app
// regenerates a layer a creator has approved without a press, nothing does it
// on a timer, and force: true — the flag that lets a regeneration overwrite
// approved words — is set from this one place and only after the press.
//
// The staleness itself is real, not stubbed: the rows carry a hash, the
// workspace computes the record's own hash from the tree it loaded, and the
// line appears because those two differ.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

const getBuild = vi.fn();
const updateBuild = vi.fn();
const getMediaForBuild = vi.fn().mockResolvedValue([]);
const getLayers = vi.fn();
const generateLayers = vi.fn();
const commitLayerReview = vi.fn();

vi.mock("@/lib/build", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/build")>();
  return {
    ...actual,
    getBuild: (id: string) => getBuild(id),
    updateBuild: (id: string, patch: unknown) => updateBuild(id, patch),
    getMediaForBuild: (id: string) => getMediaForBuild(id),
    getLayers: (id: string) => getLayers(id),
    generateLayers: (input: unknown) => generateLayers(input),
    commitLayerReview: (decisions: unknown) => commitLayerReview(decisions),
  };
});

const auth = { user: { id: "me" }, isLoggedIn: true, loading: false };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

import Compose from "@/pages/Compose";
import { hashNodeTree } from "@/lib/build";
import type { BuildLayer, Layer, NodeTree } from "@/lib/build";

let recordHash: string | null = null;

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
];

const node = (id: string, type: string, title: string) => ({
  id, build_id: "b1", parent_id: null, position: 0, type, title, note: null,
  payload: {}, source_ref: null, event_id: null, is_gap: false,
  created_at: "2026-08-01T00:00:00Z", children: [],
});

function liveRecord(status = "published") {
  return {
    build: {
      id: "b1", creator_id: "me", slug: "inbox-triage-agent-demo",
      title: "Inbox triage agent", outcome: "Triages an inbox in under a minute.",
      shape: "app", status, made_for: null, made_with: null, live_url: null,
      repo_url: null, hero_node_id: null, cost_setup: null, cost_monthly: null,
      currency: "GBP", time_to_first_result: null, completeness: 60,
      reproduction_count: 0, last_confirmed_at: null, last_confirmed_model: null,
      published_at: "2026-08-01T00:00:00Z",
    },
    tree: [node("n1", "prompt", "The triage prompt"), node("n2", "result", "What it did")],
    tray: [],
    events: [],
    nodeTypes: NODE_TYPES,
  };
}

function layerRow(layer: Layer, overrides: Partial<BuildLayer> = {}): BuildLayer {
  return {
    id: `l-${layer}`,
    build_id: "b1",
    layer,
    content: {
      steps: [{ n: 1, title: "Paste the prompt", body: "Into a new chat.", node_ref: "n1" }],
    },
    generated_at: "2026-08-02T00:00:00Z",
    // Written from a record that has since moved on.
    generated_from_hash: "v1:written-from-an-older-record",
    approved: true,
    approved_at: "2026-08-02T00:01:00Z",
    edited_by_creator: false,
    model_used: "claude",
    ...overrides,
  } as BuildLayer;
}

/** What the generator answers with after a forced rewrite: new words, and the
 *  approval reset that comes with them. */
function regenerated(layers: Layer[]) {
  return {
    buildId: "b1",
    hash: recordHash,
    modelUsed: "claude",
    stale: false,
    warnings: [],
    layers: layers.map((layer) => ({
      layer,
      status: "generated" as const,
      stale: false,
      protectedBy: null,
      row: layerRow(layer, {
        generated_from_hash: recordHash as string,
        approved: false,
        approved_at: null,
        content: {
          steps: [
            { n: 1, title: "Paste the new prompt", body: "Into a new chat.", node_ref: "n1" },
          ],
        },
      }),
      error: null,
    })),
  };
}

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

function notice(): HTMLElement | null {
  return document.querySelector('[data-visual-slot="layer-stale-notice"]');
}

beforeEach(async () => {
  vi.clearAllMocks();
  window.localStorage.clear();
  recordHash = await hashNodeTree(liveRecord().tree as unknown as NodeTree[]);
  getBuild.mockResolvedValue(liveRecord());
  getMediaForBuild.mockResolvedValue([]);
  getLayers.mockResolvedValue([layerRow("run"), layerRow("understand")]);
  commitLayerReview.mockResolvedValue([]);
  generateLayers.mockResolvedValue(regenerated(["run", "understand"]));
  updateBuild.mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({
    ...liveRecord().build,
    ...patch,
  }));
});

describe("the staleness line", () => {
  // ACCEPTANCE 6
  it("asks, and does not regenerate on its own", async () => {
    renderCompose();

    await waitFor(() => expect(notice()).not.toBeNull());
    expect(notice()).toHaveTextContent(/The record changed since/i);
    expect(notice()).toHaveTextContent(/Run it and Understand it/);

    // What pressing costs, before it is pressed.
    expect(notice()).toHaveTextContent(/replaces what is on your build page now/i);
    expect(notice()).toHaveTextContent(/nothing is shown until you approve it/i);

    // Nothing has been asked of the generator, and time passing changes that
    // for nobody: there is no timer to wait out.
    expect(generateLayers).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(generateLayers).not.toHaveBeenCalled();
  });

  it("regenerates through force, and only the layers that went stale", async () => {
    getLayers.mockResolvedValue([
      layerRow("run"),
      layerRow("understand", {
        generated_from_hash: recordHash as string,
        approved: true,
      }),
    ]);

    renderCompose();
    await waitFor(() => expect(notice()).not.toBeNull());
    expect(notice()).toHaveTextContent(/since Run it was written/i);

    generateLayers.mockResolvedValue(regenerated(["run"]));
    fireEvent.click(screen.getByRole("button", { name: /Rewrite it/ }));

    await waitFor(() => expect(generateLayers).toHaveBeenCalledTimes(1));
    expect(generateLayers.mock.calls[0][0]).toMatchObject({
      buildId: "b1",
      layers: ["run"],
      force: true,
    });

    // The new words are shown for approval, not published behind the creator.
    expect(await screen.findByDisplayValue("Paste the new prompt")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve these" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Not now" })).toBeTruthy();
  });

  it("goes away once the rewritten rows are in hand, approved or not", async () => {
    renderCompose();
    await waitFor(() => expect(notice()).not.toBeNull());

    fireEvent.click(screen.getByRole("button", { name: /Rewrite them/ }));
    // Both layers were rewritten, so both carry the new words.
    expect(await screen.findAllByDisplayValue("Paste the new prompt")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    // The row was regenerated whatever the creator then decided, so the line
    // does not go on offering to regenerate what has just been regenerated.
    await waitFor(() => expect(notice()).toBeNull());
  });

  it("says nothing on a draft, or about a layer nobody has approved", async () => {
    getBuild.mockResolvedValue({
      ...liveRecord("draft"),
      build: { ...liveRecord("draft").build, status: "draft", published_at: null },
    });
    const draft = renderCompose();
    await screen.findByLabelText("Build title");
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(notice()).toBeNull();
    draft.unmount();

    // Live, but the stale rows are unapproved and untouched: invisible to
    // readers, regenerated freely by the review pass, not worth a line.
    getLayers.mockResolvedValue([
      layerRow("run", { approved: false, approved_at: null }),
      layerRow("understand", { approved: false, approved_at: null }),
    ]);
    renderCompose();
    await screen.findByLabelText("Build title");
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(notice()).toBeNull();
  });

  it("stays out of the way once the creator has left them", async () => {
    renderCompose();
    await waitFor(() => expect(notice()).not.toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Leave them" }));

    await waitFor(() => expect(notice()).toBeNull());
    expect(generateLayers).not.toHaveBeenCalled();
  });
});
