// Acceptance cover for the review pass at publish.
//
// Rendered through the compose route, so the flow is the real one: the press
// on Publish, the screen that appears before the confirmation, and the write
// that follows whichever control is used. What the writes contain is asserted
// against PostgREST in src/test/layers.test.ts; what this file asserts is the
// promise the screen makes to a creator —
//
//   declining is ONE PRESS, always available, and never explained;
//   publication happens either way, and is never blocked by this screen;
//   a declined layer is left unapproved and NOT deleted;
//   editing a step carries that step's words into the write.

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
import type { BuildLayer, Layer, LayerDecision, NodeTree } from "@/lib/build";

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

/** The minimum publishable record: an outcome, an instruction, an evidence. */
function publishableRecord() {
  return {
    build: {
      id: "b1", creator_id: "me", slug: "inbox-triage-agent-demo",
      title: "Inbox triage agent", outcome: "Triages an inbox in under a minute.",
      shape: "app", status: "draft", made_for: null, made_with: null,
      live_url: null, repo_url: null, hero_node_id: null, cost_setup: null,
      cost_monthly: null, currency: "GBP", time_to_first_result: null,
      completeness: 0, reproduction_count: 0, last_confirmed_at: null,
      last_confirmed_model: null, published_at: null,
    },
    tree: [node("n1", "prompt", "The triage prompt"), node("n2", "result", "What it did")],
    tray: [],
    events: [],
    nodeTypes: NODE_TYPES,
  };
}

function layerRow(layer: Layer, steps: { title: string; body: string }[]): BuildLayer {
  return {
    id: `l-${layer}`,
    build_id: "b1",
    layer,
    content: {
      steps: steps.map((step, index) => ({
        n: index + 1,
        title: step.title,
        body: step.body,
        node_ref: index === 0 ? "n1" : null,
      })),
    },
    generated_at: "2026-08-24T09:00:00Z",
    generated_from_hash: "v1:fresh",
    approved: false,
    approved_at: null,
    edited_by_creator: false,
    model_used: "claude",
  } as BuildLayer;
}

/**
 * The generator's answer, carrying the SAME hash the browser computes for this
 * record — which is what the real function returns, and what src/test/
 * layers.test.ts proves the two agree on. A decline is remembered against it,
 * so a fixture that invented a hash would never be recognised again.
 */
function generated(hash: string | null) {
  const rows = [
    layerRow("run", [
      { title: "Paste the prompt", body: "Open a new chat and paste it." },
      { title: "Check the result", body: "It should agree with you." },
    ]),
    layerRow("understand", [{ title: "Why a prompt", body: "It fixes the frame." }]),
  ];
  return {
    buildId: "b1",
    hash,
    modelUsed: "claude",
    stale: false,
    warnings: [],
    layers: rows.map((row) => ({
      layer: row.layer,
      status: "generated" as const,
      stale: false,
      protectedBy: null,
      row,
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

async function pressPublish() {
  const button = await screen.findByRole("button", { name: "Publish" });
  await waitFor(() => expect(button).not.toBeDisabled());
  fireEvent.click(button);
  return button;
}

function review() {
  return screen.getByRole("dialog", { name: /Review what NeoScale wrote/i });
}

/** The patches updateBuild was called with, ignoring the completeness autosave. */
function publishPatches(): Record<string, unknown>[] {
  return updateBuild.mock.calls
    .map((call) => call[1] as Record<string, unknown>)
    .filter((patch) => "status" in patch || "published_at" in patch);
}

function decisions(): LayerDecision[] {
  return (commitLayerReview.mock.calls[0]?.[0] ?? []) as LayerDecision[];
}

function decisionFor(layer: Layer): LayerDecision | undefined {
  return decisions().find((decision) => decision.row.layer === layer);
}

let recordHash: string | null = null;

beforeEach(async () => {
  vi.clearAllMocks();
  window.localStorage.clear();
  recordHash = await hashNodeTree(publishableRecord().tree as unknown as NodeTree[]);
  getBuild.mockResolvedValue(publishableRecord());
  getMediaForBuild.mockResolvedValue([]);
  getLayers.mockResolvedValue([]);
  generateLayers.mockResolvedValue(generated(recordHash));
  commitLayerReview.mockResolvedValue([]);
  updateBuild.mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({
    ...publishableRecord().build,
    ...patch,
  }));
});

describe("the review pass", () => {
  // ACCEPTANCE 1, first half
  it("comes between the press and the confirmation, with both layers on it", async () => {
    renderCompose();
    await pressPublish();

    const dialog = await screen.findByRole("dialog", { name: /Review what NeoScale wrote/i });
    // Every step is editable where it stands, so they are fields, not text.
    expect(await screen.findByDisplayValue("Paste the prompt")).toBeTruthy();
    expect(screen.getByDisplayValue("Open a new chat and paste it.")).toBeTruthy();
    expect(screen.getByDisplayValue("Why a prompt")).toBeTruthy();
    expect(dialog).toHaveTextContent(/Run it/);
    expect(dialog).toHaveTextContent(/Understand it/);

    // The confirmation has not happened yet, and neither has the write.
    expect(screen.queryByRole("dialog", { name: /Your build is live/i })).toBeNull();
    expect(publishPatches()).toHaveLength(0);

    // The reader-facing promise is on the screen the creator approves from.
    expect(screen.getByTestId("layer-attribution").textContent).toContain(
      "Written by NeoScale"
    );
  });

  // ACCEPTANCE 1, second half
  it("publishes in one press of Publish without these, approving nothing", async () => {
    renderCompose();
    await pressPublish();
    await screen.findByDisplayValue("Paste the prompt");

    fireEvent.click(screen.getByRole("button", { name: "Publish without these" }));

    // One press: the build is live and the confirmation is up.
    await screen.findByRole("dialog", { name: /Your build is live/i });
    await waitFor(() => expect(publishPatches()).toHaveLength(1));
    expect(publishPatches()[0].status).toBe("published");

    // Nothing was approved, and nothing was deleted: the rows stay as
    // generated so a creator who changes their mind pays for no second one.
    expect(decisions().every((decision) => decision.approve === false)).toBe(true);
    expect(decisions().every((decision) => !decision.steps)).toBe(true);
    expect(decisions().map((decision) => decision.row.layer).sort()).toEqual([
      "run",
      "understand",
    ]);
  });

  it("never asks a declining creator to explain, or asks a second question", async () => {
    renderCompose();
    await pressPublish();
    await screen.findByDisplayValue("Paste the prompt");

    const skip = screen.getByRole("button", { name: "Publish without these" });
    const approve = screen.getByRole("button", { name: "Approve and publish" });

    // Same geometry: the easy press is not the approving one.
    expect(skip.style.height).toBe(approve.style.height);
    expect(skip.style.padding).toBe(approve.style.padding);
    expect(skip.style.borderRadius).toBe(approve.style.borderRadius);
    expect(skip).toBeEnabled();

    fireEvent.click(skip);

    // Straight to the confirmation. No "are you sure", no reason field.
    await screen.findByRole("dialog", { name: /Your build is live/i });
    expect(screen.queryByRole("dialog", { name: /Review what NeoScale wrote/i })).toBeNull();
  });

  // ACCEPTANCE 5
  it("carries an edited step into the write, for that layer only", async () => {
    renderCompose();
    await pressPublish();
    await screen.findByDisplayValue("Paste the prompt");

    fireEvent.change(screen.getByLabelText("Run it step 1 text"), {
      target: { value: "Open Claude, paste it, press enter." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Approve and publish" }));
    await waitFor(() => expect(commitLayerReview).toHaveBeenCalled());

    const run = decisionFor("run");
    expect(run?.steps?.[0].body).toBe("Open Claude, paste it, press enter.");
    // The one nobody touched is approved as generated, not rewritten.
    expect(decisionFor("understand")?.steps).toBeFalsy();
    expect(decisionFor("understand")?.approve).toBe(true);
  });

  it("keeps an edited layer even when the creator then declines the rest", async () => {
    renderCompose();
    await pressPublish();
    await screen.findByDisplayValue("Paste the prompt");

    fireEvent.change(screen.getByLabelText("Run it step 1 title"), {
      target: { value: "Paste it into a new chat" },
    });
    // The screen says so before the press does anything.
    expect(review()).toHaveTextContent(/Edited by you/);

    fireEvent.click(screen.getByRole("button", { name: "Publish without these" }));
    await waitFor(() => expect(commitLayerReview).toHaveBeenCalled());

    // Editing is approving: the words the creator wrote are written, and the
    // layer they never touched stays unapproved.
    expect(decisionFor("run")?.steps?.[0].title).toBe("Paste it into a new chat");
    expect(decisionFor("understand")?.steps).toBeFalsy();
    expect(decisionFor("understand")?.approve).toBe(false);
  });

  it("publishes anyway when nothing could be generated", async () => {
    generateLayers.mockRejectedValue(new Error("No model is configured for this project."));
    renderCompose();
    await pressPublish();

    // The failure is said out loud, and the way out is still one press.
    expect(
      await screen.findByText("No model is configured for this project.")
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Publish without these" }));

    await screen.findByRole("dialog", { name: /Your build is live/i });
    await waitFor(() => expect(publishPatches()).toHaveLength(1));
  });

  it("asks the generator once, and never again without a press", async () => {
    renderCompose();
    await pressPublish();
    await screen.findByDisplayValue("Paste the prompt");

    expect(generateLayers).toHaveBeenCalledTimes(1);
    // Not forced: a row a creator has approved or rewritten is protected, and
    // only the staleness line is allowed to overrule that.
    expect(generateLayers.mock.calls[0][0]).toMatchObject({ buildId: "b1" });
    expect((generateLayers.mock.calls[0][0] as { force?: boolean }).force).toBeUndefined();

    fireEvent.click(screen.getByRole("button", { name: "Publish without these" }));
    await screen.findByRole("dialog", { name: /Your build is live/i });
    expect(generateLayers).toHaveBeenCalledTimes(1);
  });

  it("goes back on Escape without publishing or writing anything", async () => {
    renderCompose();
    await pressPublish();
    await screen.findByDisplayValue("Paste the prompt");

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: /Review what NeoScale wrote/i })).toBeNull()
    );
    expect(publishPatches()).toHaveLength(0);
    expect(commitLayerReview).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: /Your build is live/i })).toBeNull();
  });

  it("is not offered again once declined for this record", async () => {
    const { unmount } = renderCompose();
    await pressPublish();
    await screen.findByDisplayValue("Paste the prompt");
    fireEvent.click(screen.getByRole("button", { name: "Publish without these" }));
    await screen.findByRole("dialog", { name: /Your build is live/i });

    unmount();
    vi.clearAllMocks();
    getBuild.mockResolvedValue({
      ...publishableRecord(),
      build: { ...publishableRecord().build, status: "published", published_at: "2026-08-24T10:00:00Z" },
    });
    getLayers.mockResolvedValue([]);
    updateBuild.mockResolvedValue(publishableRecord().build);

    renderCompose();
    const button = await screen.findByRole("button", { name: "Published" });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);

    // Straight through: the same record, already answered, is not asked again.
    await screen.findByRole("dialog", { name: /Your build is live/i });
    expect(generateLayers).not.toHaveBeenCalled();
  });
});
