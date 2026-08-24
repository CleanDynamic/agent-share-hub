// Acceptance cover for what a reader is shown of a generated layer.
//
// Rendered through the build page rather than against the component alone,
// because three of the claims are about the PAGE, not about the renderer: an
// unapproved layer must not appear, Understand it must not be a tab until
// there is one, and the executable sequence must still be the thing the Run it
// yourself tab opens on.
//
// The read path is the real one down to the query: getApprovedLayers is
// stubbed here, and src/test/layers.test.ts asserts separately that the real
// one puts approved = true in the request. Between them, "unapproved text
// never reaches a reader" is covered at both ends.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getBuildBySlug = vi.fn();
const getMediaForBuild = vi.fn().mockResolvedValue([]);
const getApprovedLayers = vi.fn().mockResolvedValue([]);
const getForkOrigin = vi.fn().mockResolvedValue(null);

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoggedIn: false, user: null }),
}));

vi.mock("@/lib/build", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/build")>();
  return {
    ...actual,
    getBuildBySlug: (slug: string) => getBuildBySlug(slug),
    getMediaForBuild: (id: string) => getMediaForBuild(id),
    getApprovedLayers: (id: string) => getApprovedLayers(id),
    getForkOrigin: (build: unknown) => getForkOrigin(build),
  };
});

import BuildPage from "@/pages/BuildPage";
import { LAYER_ATTRIBUTION } from "@/lib/build";

const nodeTypes = [
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

const record = {
  build: {
    id: "b", slug: "inbox-triage", title: "Inbox triage agent",
    outcome: "Sorts a full inbox.", shape: "app", status: "published",
    made_for: null, made_with: null, live_url: null, repo_url: null,
    hero_node_id: null, cost_setup: null, cost_monthly: null, currency: "GBP",
    time_to_first_result: null, completeness: 70, reproduction_count: 0,
    last_confirmed_at: null,
  },
  tree: [
    {
      id: "n1", build_id: "b", parent_id: null, position: 0, type: "prompt",
      title: "The classify prompt", note: null, payload: { text: "Classify this email." },
      source_ref: null, event_id: null, is_gap: false, created_at: "", children: [],
    },
    {
      id: "n2", build_id: "b", parent_id: null, position: 1, type: "result",
      title: "What it produced", note: null, payload: { summary: "91% agreement." },
      source_ref: null, event_id: null, is_gap: false, created_at: "", children: [],
    },
  ],
  tray: [],
  events: [],
  nodeTypes,
};

function layer(overrides: Record<string, unknown> = {}) {
  return {
    id: "l-run",
    build_id: "b",
    layer: "run",
    content: {
      steps: [
        { n: 1, title: "Paste the prompt", body: "Open a new chat and paste it.", node_ref: "n1" },
        { n: 2, title: "Read the result", body: "It should agree with you.", node_ref: "gone" },
      ],
    },
    generated_at: "2026-08-20T10:00:00Z",
    generated_from_hash: "v1:abc",
    approved: true,
    approved_at: "2026-08-20T10:05:00Z",
    edited_by_creator: false,
    model_used: "claude",
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/b2/inbox-triage"]}>
        <Routes>
          <Route path="/b2/:slug" element={<BuildPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getBuildBySlug.mockResolvedValue(record);
  getMediaForBuild.mockResolvedValue([]);
  getForkOrigin.mockResolvedValue(null);
  getApprovedLayers.mockResolvedValue([]);
});

describe("a build with no approved layers", () => {
  it("has no Understand it tab and no two-state control", async () => {
    renderPage();
    expect(await screen.findByText("Inbox triage agent")).toBeTruthy();

    expect(screen.queryByRole("tab", { name: /Understand it/ })).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /Run it yourself/ }));
    // The tab is the sequence alone, exactly as NS-P06 left it.
    expect(screen.queryByRole("group", { name: /How to read this build/ })).toBeNull();
    expect(screen.getByText("The classify prompt")).toBeTruthy();
  });

  it("shows nothing of a layer the creator has not approved", async () => {
    // What an unapproved row looks like to this page: the query never returns
    // it, so the page cannot show it even by accident.
    getApprovedLayers.mockResolvedValue([]);
    const { container } = renderPage();
    expect(await screen.findByText("Inbox triage agent")).toBeTruthy();

    expect(container.innerHTML).not.toContain("Paste the prompt");
    expect(container.innerHTML).not.toContain(LAYER_ATTRIBUTION);
  });
});

describe("an approved run layer", () => {
  beforeEach(() => {
    getApprovedLayers.mockResolvedValue([layer()]);
  });

  it("opens on the executable sequence and offers the layer beside it", async () => {
    renderPage();
    expect(await screen.findByText("Inbox triage agent")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Run it yourself/ }));

    const control = screen.getByRole("group", { name: /How to read this build/ });
    const [sequence, words] = [
      screen.getByRole("button", { name: "The sequence" }),
      screen.getByRole("button", { name: "In words" }),
    ];
    expect(control.contains(sequence)).toBe(true);
    expect(sequence.getAttribute("aria-pressed")).toBe("true");
    expect(words.getAttribute("aria-pressed")).toBe("false");

    // The sequence is what a reader lands on: the material, not the words.
    expect(screen.getByText("Classify this email.")).toBeTruthy();
    expect(screen.queryByText("Paste the prompt")).toBeNull();

    fireEvent.click(words);
    expect(screen.getByText("Paste the prompt")).toBeTruthy();
    expect(screen.getByText("Open a new chat and paste it.")).toBeTruthy();
  });

  it("carries the attribution line wherever the layer is shown", async () => {
    renderPage();
    expect(await screen.findByText("Inbox triage agent")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Run it yourself/ }));
    fireEvent.click(screen.getByRole("button", { name: "In words" }));

    const line = screen.getByTestId("layer-attribution");
    expect(line.textContent).toBe(LAYER_ATTRIBUTION);
    expect(line.textContent).toContain("Written by NeoScale");
    expect(line.textContent).toContain("reviewed by the creator");
  });

  it("links a step to its node in the anatomy, and leaves a dead ref unlinked", async () => {
    renderPage();
    expect(await screen.findByText("Inbox triage agent")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Run it yourself/ }));
    fireEvent.click(screen.getByRole("button", { name: "In words" }));

    // Step two points at a node that is no longer in the tree.
    expect(screen.queryByRole("button", { name: /gone/ })).toBeNull();

    const link = screen.getByRole("button", { name: /The classify prompt in the anatomy/ });
    fireEvent.click(link);

    // Back in the anatomy, on the node the step named.
    expect(screen.getByRole("tab", { name: /Anatomy/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Classify this email.")).toBeTruthy();
  });
});

describe("an approved understand layer", () => {
  it("appears as its own tab, with the attribution line on it", async () => {
    getApprovedLayers.mockResolvedValue([
      layer({
        id: "l-u",
        layer: "understand",
        content: {
          steps: [
            { n: 1, title: "Why a system prompt", body: "It fixes the frame.", node_ref: null },
          ],
        },
      }),
    ]);

    renderPage();
    expect(await screen.findByText("Inbox triage agent")).toBeTruthy();

    const tab = await screen.findByRole("tab", { name: /Understand it/ });
    fireEvent.click(tab);

    expect(screen.getByText("Why a system prompt")).toBeTruthy();
    expect(screen.getByTestId("layer-attribution").textContent).toBe(LAYER_ATTRIBUTION);

    // The run tab is untouched: no approved run layer means no control on it.
    fireEvent.click(screen.getByRole("tab", { name: /Run it yourself/ }));
    expect(screen.queryByRole("group", { name: /How to read this build/ })).toBeNull();
  });
});
