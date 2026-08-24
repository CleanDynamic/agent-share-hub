// Acceptance cover for the publish action.
//
// Rendered through the compose route rather than against the control alone, so
// the write path is the real one: onPublish is the hook's publish, and what
// these assertions read is the argument updateBuild is actually called with.
//
// The claim under test is the one the handover is explicit about: publication
// is ungated on completeness. A record with an outcome, one prompt node and one
// result node publishes — and the app-shaped build in this file scores 60 out
// of 100 while doing it, missing six of its nine rules. If a future change ever
// makes the score the gate, this file fails.
//
// Every build here is past NS-P23's review pass — there is nothing unreviewed
// to show — so pressing Publish goes straight to the write. That screen, and
// the rule that decides when it appears, are covered in LayerReview.test.tsx;
// this file is about the write, and about the fact that nothing was allowed to
// gate it.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    // Nothing to review, so Publish publishes. NS-P23's review pass decides
    // this for real from the rows and the record's hash; here it is pinned so
    // the write below is the only thing under test.
    shouldOfferLayerReview: () => false,
  };
});

const auth = { user: { id: "me" }, isLoggedIn: true, loading: false };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

import Compose from "@/pages/Compose";

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

function draft(overrides: Record<string, unknown> = {}) {
  return {
    id: "b1",
    creator_id: "me",
    slug: "inbox-triage-agent-demo",
    title: "Inbox triage agent",
    outcome: null,
    shape: "app",
    status: "draft",
    made_for: null,
    made_with: null,
    live_url: null,
    repo_url: null,
    hero_node_id: null,
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

function record(build: Record<string, unknown>, tree: unknown[] = []) {
  return { build, tree, tray: [], events: [], nodeTypes: NODE_TYPES };
}

/** The minimum publishable record: an outcome, an instruction, an evidence. */
function minimumRecord() {
  return record(draft({ outcome: "Triages an inbox in under a minute." }), [
    node("n1", "prompt", "The triage prompt"),
    node("n2", "result", "What it did"),
  ]);
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

function publishButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: /^Publish$|^Published$|^Publishing/ }) as HTMLButtonElement;
}

/** The patches updateBuild was called with, ignoring the completeness autosave. */
function publishPatches(): Record<string, unknown>[] {
  return updateBuild.mock.calls
    .map((call) => call[1] as Record<string, unknown>)
    .filter((patch) => "status" in patch || "published_at" in patch);
}

describe("the publish action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMediaForBuild.mockResolvedValue([]);
    getLayers.mockResolvedValue([]);
    updateBuild.mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({
      ...draft(),
      ...patch,
    }));
  });

  // ACCEPTANCE 1
  it("publishes a build with an outcome, one prompt node and one result node, and sets published_at", async () => {
    getBuild.mockResolvedValue(minimumRecord());
    renderCompose();

    const button = await screen.findByRole("button", { name: "Publish" });
    await waitFor(() => expect(button).not.toBeDisabled());

    fireEvent.click(button);

    await waitFor(() => expect(publishPatches()).toHaveLength(1));
    const patch = publishPatches()[0];
    expect(patch.status).toBe("published");
    expect(typeof patch.published_at).toBe("string");
    expect(Number.isFinite(Date.parse(patch.published_at as string))).toBe(true);
  });

  it("does not gate publication on completeness", async () => {
    getBuild.mockResolvedValue(minimumRecord());
    renderCompose();

    const button = await screen.findByRole("button", { name: "Publish" });
    await waitFor(() => expect(button).not.toBeDisabled());

    // The same record the button just accepted scores 60 of an app's 100 — the
    // three core rules and none of the other six. Publication is ungated, and
    // this is the number that proves it was not quietly gated on the score.
    await waitFor(() =>
      expect(
        updateBuild.mock.calls.some(
          ([, patch]) => (patch as Record<string, unknown>).completeness === 60
        )
      ).toBe(true)
    );
  });

  it("stays disabled and names the missing piece when the record is short", async () => {
    // An outcome and a prompt, but nothing showing it worked.
    getBuild.mockResolvedValue(
      record(draft({ outcome: "Triages an inbox." }), [node("n1", "prompt", "The prompt")])
    );
    renderCompose();

    const button = await screen.findByRole("button", { name: "Publish" });
    expect(button).toBeDisabled();

    // The reason is what a creator reads off the control, and it names ONE
    // thing: the next one to do, not the list of everything outstanding.
    fireEvent.focus(button);
    await waitFor(() => {
      expect(
        screen.getAllByText(/add one piece of evidence/i).length
      ).toBeGreaterThan(0);
    });
    expect(updateBuild.mock.calls.filter(([, p]) => "status" in (p as object))).toHaveLength(0);
  });

  it("shows the /b2/:slug link and what would put it in the gallery", async () => {
    getBuild.mockResolvedValue(minimumRecord());
    renderCompose();

    const button = await screen.findByRole("button", { name: "Publish" });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("/b2/inbox-triage-agent-demo");

    // Live and forkable, on the profile — the gallery is a further thing, never
    // a refusal. The words matter here, so they are asserted.
    expect(dialog).toHaveTextContent(/live and forkable/i);
    expect(dialog).toHaveTextContent(/sits on your profile/i);
    expect(dialog.textContent ?? "").not.toMatch(/reject|not good enough|denied/i);

    // An app at 60 is short of its 72 bar; the heaviest outstanding item leads.
    expect(dialog).toHaveTextContent(/add a link to the live thing/i);
  });

  it("carries unsaved header edits into the publish write rather than racing them", async () => {
    getBuild.mockResolvedValue(
      record(draft({ outcome: "Triages an inbox." }), [
        node("n1", "prompt", "The prompt"),
        node("n2", "result", "It worked"),
      ])
    );
    renderCompose();

    const title = await screen.findByLabelText("Build title");
    fireEvent.change(title, { target: { value: "Inbox triage, rewritten" } });

    const button = publishButton();
    await waitFor(() => expect(button).not.toBeDisabled(), { timeout: 3000 });
    fireEvent.click(button);

    await waitFor(() => expect(publishPatches()).toHaveLength(1));
    // One write, carrying both. Not a title update followed by a status update.
    expect(publishPatches()[0]).toMatchObject({
      title: "Inbox triage, rewritten",
      status: "published",
    });
  });

  it("keeps published_at and the gallery status on a re-publish", async () => {
    getBuild.mockResolvedValue(
      record(
        draft({
          outcome: "Triages an inbox.",
          status: "gallery",
          published_at: "2026-01-01T00:00:00Z",
        }),
        [node("n1", "prompt", "The prompt"), node("n2", "result", "It worked")]
      )
    );
    renderCompose();

    const button = await screen.findByRole("button", { name: "Published" });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);

    await screen.findByRole("dialog");
    // Nothing to write: an editorial promotion is not undone by its creator
    // opening the confirmation, and the original date is not moved.
    expect(publishPatches()).toHaveLength(0);
  });
});
