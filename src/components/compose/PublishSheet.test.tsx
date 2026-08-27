// Acceptance cover for the publish sheet (NS-P29).
//
// The claim is that pressing Publish shows a creator the POST they are about to
// make — the gallery's own card, fed from the workspace they are sitting in —
// with the remaining asks beside it in the checklist's own words, and that
// nothing about the publish gate moved when that surface was put in front of it.
//
// The card assertion is deliberately made against data-visual-slot="gallery-card"
// rather than against the markup inside it. That attribute is GalleryCard's, set
// nowhere else in the codebase, so the test fails the moment the preview stops
// being the same component /gallery renders — which is the whole point of the
// preview and the one thing a screenshot could not prove.

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
    shouldOfferLayerReview: () => false,
  };
});

/** The card signs its media exactly as the gallery page does: one per row. */
const createSignedUrl = vi.fn();

vi.mock("@/integrations/supabase/client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/integrations/supabase/client")>();
  return {
    ...actual,
    supabase: {
      ...actual.supabase,
      storage: { from: () => ({ createSignedUrl }) },
    },
  };
});

const auth = { user: { id: "me" }, isLoggedIn: true, loading: false };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

import Compose from "@/pages/Compose";
import { PublishSheet } from "./PublishSheet";
import type { Build, NodeTree, PublishReadiness } from "@/lib/build";

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

const COVER_PATH = "b1/unplaced/cover.png";

function coverRow() {
  return {
    id: "m1",
    build_id: "b1",
    node_id: null,
    bucket: "build-media",
    path: COVER_PATH,
    kind: "image",
    mime: "image/png",
    bytes: 2000,
    width: 1600,
    height: 900,
    duration: null,
    poster_path: null,
    created_at: "2026-08-27T10:00:00Z",
  };
}

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

/** The minimum publishable record: an outcome, an instruction, an evidence. */
function publishable(over: Record<string, unknown> = {}) {
  return record(draft(over), [
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

/** Press the pill and wait for the lazily-loaded sheet. */
async function openSheet(name: "Publish" | "Published" = "Publish") {
  const pill = await screen.findByRole("button", { name });
  fireEvent.click(pill);
  return screen.findByTestId("publish-sheet");
}

describe("the publish sheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMediaForBuild.mockResolvedValue([]);
    getLayers.mockResolvedValue([]);
    createSignedUrl.mockImplementation(async (path: string) => ({
      data: { signedUrl: `https://signed.test/${path}` },
      error: null,
    }));
    updateBuild.mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({
      ...draft(),
      ...patch,
    }));
  });

  // ACCEPTANCE 1
  it("shows the feed's own card, fed from what the workspace holds", async () => {
    getBuild.mockResolvedValue(publishable());
    renderCompose();

    const sheet = await openSheet();
    expect(sheet).toHaveTextContent("This is your post.");

    const preview = await screen.findByTestId("publish-card-preview");
    // GalleryCard's own slot attribute, set nowhere else. If the preview ever
    // stops being that component, this is the line that says so.
    const card = preview.querySelector('[data-visual-slot="gallery-card"]');
    expect(card).not.toBeNull();
    expect(preview).toHaveTextContent("Inbox triage agent");
    // The card's own chain, not a second one written here: with no picture it
    // leads with the first evidence node's words, exactly as /gallery does.
    expect(preview).toHaveTextContent("What it did");
    expect(preview).toHaveTextContent("not confirmed by anyone yet");
  });

  it("falls through to the outcome, set large, when the record has neither picture nor words", async () => {
    getBuild.mockResolvedValue(
      record(draft(), [
        node("n1", "prompt", "The triage prompt"),
        { ...node("n2", "result", ""), title: null },
      ])
    );
    renderCompose();
    await openSheet();

    const preview = await screen.findByTestId("publish-card-preview");
    expect(preview).toHaveTextContent("Triages a full inbox in under a minute.");
  });

  it("does not carry a creator off to the build page when the preview is clicked", async () => {
    getBuild.mockResolvedValue(publishable());
    renderCompose();
    await openSheet();

    const preview = await screen.findByTestId("publish-card-preview");
    const card = preview.querySelector('[data-visual-slot="gallery-card"]') as HTMLElement;
    fireEvent.click(card);

    // Still on the sheet, still on /compose. A preview is not a link.
    expect(await screen.findByTestId("publish-sheet")).toBeInTheDocument();
  });

  // ACCEPTANCE 2
  it("nudges for a picture when nothing resolves to one, and lands focus on the cover strip", async () => {
    getBuild.mockResolvedValue(publishable());
    renderCompose();

    const sheet = await openSheet();
    const nudge = within(sheet).getByRole("button", {
      name: /Add a picture — posts with one get seen\./i,
    });

    fireEvent.click(nudge);

    await waitFor(() => {
      const drop = document.querySelector('[data-testid="cover-drop"]');
      expect(drop?.contains(document.activeElement)).toBe(true);
    });
    // The sheet got out of the way rather than sitting over the thing it asked for.
    expect(screen.queryByTestId("publish-sheet")).toBeNull();
  });

  it("leads the card with the resolved cover, and does not nudge for one", async () => {
    getMediaForBuild.mockResolvedValue([coverRow()]);
    getBuild.mockResolvedValue(publishable({ cover_media_id: "m1" }));
    renderCompose();

    const sheet = await openSheet();
    const preview = await screen.findByTestId("publish-card-preview");

    await waitFor(() => {
      const image = preview.querySelector("img");
      expect(image?.getAttribute("src")).toBe(`https://signed.test/${COVER_PATH}`);
    });
    expect(
      within(sheet).queryByRole("button", { name: /Add a picture/i })
    ).toBeNull();
  });

  // ACCEPTANCE 3 — the gate did not move with the surface.
  it("asks for what is left in the checklist's own words, and takes a press to the field", async () => {
    // No description yet, so the row that asks for one is on the list — and
    // that row is the reason the sheet's Publish is not armed.
    getBuild.mockResolvedValue(publishable({ outcome: null }));
    renderCompose();

    const sheet = await openSheet();
    expect(screen.getByTestId("publish-confirm")).toBeDisabled();
    // signals.ts's sentence, unedited. An app short of its audience says this.
    expect(sheet).toHaveTextContent("say who this is for");

    // The description is the line the card renders, so its row goes to the
    // header field rather than anywhere else.
    fireEvent.click(
      within(sheet).getByRole("button", {
        name: /add the one line that says what this does for someone/i,
      })
    );

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId("outcome-input"));
    });
  });

  it("says publishing is not a one-way door", async () => {
    getBuild.mockResolvedValue(publishable());
    renderCompose();

    const sheet = await openSheet();
    expect(sheet).toHaveTextContent("You can keep editing after publishing.");
  });

  // The extension slot NS-P39 and NS-P51 plug into. Rendered directly: the
  // point of the assertion is the contract, not the route.
  it("renders an extension section between the checklist and the primary action", () => {
    const readiness: PublishReadiness = { ready: true, blocking: [], reason: null };
    render(
      <MemoryRouter>
        <PublishSheet
          build={draft() as unknown as Build}
          tree={[] as NodeTree[]}
          completeness={{ score: 60, missing: [] }}
          readiness={readiness}
          open
          onOpenChange={() => {}}
          onConfirm={() => {}}
          isPublishing={false}
          publishError={null}
          sections={<div data-testid="extra-section">A later prompt's section</div>}
        />
      </MemoryRouter>
    );

    const sheet = screen.getByTestId("publish-sheet");
    const extra = screen.getByTestId("extra-section");
    const confirm = screen.getByTestId("publish-confirm");

    expect(sheet).toContainElement(extra);
    // Before the button, in document order.
    expect(
      extra.compareDocumentPosition(confirm) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("renders nothing extra when no sections are passed", () => {
    const readiness: PublishReadiness = { ready: true, blocking: [], reason: null };
    render(
      <MemoryRouter>
        <PublishSheet
          build={draft() as unknown as Build}
          tree={[] as NodeTree[]}
          completeness={{ score: 100, missing: [] }}
          readiness={readiness}
          open
          onOpenChange={() => {}}
          onConfirm={() => {}}
          isPublishing={false}
          publishError={null}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId("publish-sheet")).toHaveTextContent(
      "Nothing left. This one is ready."
    );
  });
});
