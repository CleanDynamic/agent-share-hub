// Acceptance cover for the checklist in the compose right rail.
//
// Two claims, both about what happens after a click. Every row names something
// in plain language and puts the creator in front of the thing that would tick
// it — a focused field, a selected node, or a node created and handed to the
// inspector. And filling two of those rows in raises builds.completeness in the
// row, through the same debounced write as a title.
//
// Rendered through the compose route so the write path is the real one: the
// panel's onPatch is the hook's patchBuild, and what this asserts on is the
// argument updateBuild is actually called with.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

const getBuild = vi.fn();
const updateBuild = vi.fn();
const upsertNode = vi.fn();
const getMediaForBuild = vi.fn().mockResolvedValue([]);

/** The four calls this route makes are stubbed; the rules layer is real. */
vi.mock("@/lib/build", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/build")>();
  return {
    ...actual,
    getBuild: (id: string) => getBuild(id),
    updateBuild: (id: string, patch: unknown) => updateBuild(id, patch),
    upsertNode: (input: unknown) => upsertNode(input),
    getMediaForBuild: (id: string) => getMediaForBuild(id),
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
    icon: "CircleCheck", renderer: "evidence", copyable: false, is_active: true, sort: 1,
    schema: { fields: [{ key: "text", label: "Text", type: "text" }] },
  },
  {
    key: "prerequisite", label: "Prerequisite", category: "narrative", colour: "#9CA3AF",
    icon: "ListChecks", renderer: "narrative", copyable: false, is_active: true, sort: 4,
    schema: { fields: [{ key: "requirement", label: "Requirement", type: "text" }] },
  },
];

const node = (id: string, type: string, title: string, extra = {}) => ({
  id, build_id: "b1", parent_id: null, position: 0, type, title, note: null,
  payload: {}, source_ref: null, event_id: null, is_gap: false,
  created_at: "2026-08-01T00:00:00Z", children: [], ...extra,
});

/** An app-shaped draft with nothing in it: all nine of its rows outstanding. */
function emptyDraft(overrides: Record<string, unknown> = {}) {
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

/** The nine instructions an empty app-shaped record is asked for, in order. */
const MISSING_COPY = [
  "add the one line that says what this does for someone",
  "add the prompt, configuration or artefact someone would run",
  "add one piece of evidence — a result, a screenshot or an eval run",
  "say who this is for",
  "list the models and tools this was made with",
  "add what it costs to run",
  "add how long it takes to get a first result",
  "add what someone needs in place before they start",
  "add a link to the live thing, or to the repository",
];

/** The row whose text is this instruction. */
function row(copy: string): HTMLElement {
  return screen.getByText(copy).closest("button") as HTMLElement;
}

describe("CompletenessPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMediaForBuild.mockResolvedValue([]);
    updateBuild.mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({
      ...emptyDraft(),
      ...patch,
    }));
  });

  it("lists what is missing in plain language, and how much is filled in", async () => {
    getBuild.mockResolvedValue(record(emptyDraft()));

    renderCompose();
    await screen.findByLabelText("Build title");

    for (const copy of MISSING_COPY) {
      expect(screen.getByText(copy)).toBeTruthy();
    }
    expect(screen.getByText("0% filled in · 9 things left")).toBeTruthy();
    expect(
      screen.getByText(
        "Everything you publish is live, searchable and forkable. The gallery asks for a bit more."
      )
    ).toBeTruthy();
    // A checklist state, never a mark: the bar carries the number.
    const bar = screen.getByRole("progressbar", {
      name: "How much of this record is filled in",
    });
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
  });

  it("focuses the field behind every header row that is clicked", async () => {
    getBuild.mockResolvedValue(record(emptyDraft()));

    renderCompose();
    await screen.findByLabelText("Build title");

    const fieldRows: [string, string][] = [
      ["add the one line that says what this does for someone", "The one line"],
      ["say who this is for", "Who it is for"],
      ["list the models and tools this was made with", "Models and tools"],
      ["add what it costs to run", "To set up (GBP)"],
      ["add how long it takes to get a first result", "Minutes to a first result"],
      ["add a link to the live thing, or to the repository", "The live thing"],
    ];

    for (const [copy, label] of fieldRows) {
      fireEvent.click(row(copy));
      const field = await screen.findByLabelText(label);
      expect(document.activeElement).toBe(field);
      // Clicking the row again closes it, so the next one starts clean.
      fireEvent.click(row(copy));
    }
  });

  it("creates and selects a node for a row nothing in the tree satisfies", async () => {
    const wanted: [string, string][] = [
      ["add the prompt, configuration or artefact someone would run", "prompt"],
      ["add one piece of evidence — a result, a screenshot or an eval run", "result"],
      ["add what someone needs in place before they start", "prerequisite"],
    ];

    for (const [copy, typeKey] of wanted) {
      vi.clearAllMocks();
      getBuild.mockResolvedValue(record(emptyDraft()));
      upsertNode.mockResolvedValue(node("new-1", typeKey, ""));

      const view = renderCompose();
      await screen.findByLabelText("Build title");
      fireEvent.click(row(copy));

      await waitFor(() =>
        expect(upsertNode).toHaveBeenCalledWith(
          expect.objectContaining({ build_id: "b1", type: typeKey })
        )
      );
      // Created AND selected: the inspector is showing the new node.
      expect(await screen.findByLabelText("Title")).toBeTruthy();
      view.unmount();
    }
  });

  it("selects the node that already satisfies a ticked row", async () => {
    getBuild.mockResolvedValue(
      record(emptyDraft(), [node("n2", "result", "91% agreement")])
    );

    renderCompose();
    await screen.findByLabelText("Build title");

    // Ticked rows read as a fact about the record, and say what did it.
    expect(screen.getByText("evidence that it worked")).toBeTruthy();
    fireEvent.click(row("evidence that it worked"));

    const title = (await screen.findByLabelText("Title")) as HTMLInputElement;
    expect(title.value).toBe("91% agreement");
  });

  it("raises builds.completeness when cost and made_for are filled in", async () => {
    getBuild.mockResolvedValue(record(emptyDraft()));

    renderCompose();
    await screen.findByLabelText("Build title");
    expect(screen.getByText("0% filled in · 9 things left")).toBeTruthy();

    fireEvent.click(row("say who this is for"));
    fireEvent.change(await screen.findByLabelText("Who it is for"), {
      target: { value: "founders, solo developers" },
    });

    fireEvent.click(row("add what it costs to run"));
    fireEvent.change(await screen.findByLabelText("To set up (GBP)"), {
      target: { value: "40" },
    });

    await waitFor(
      () => expect(updateBuild).toHaveBeenCalled(),
      { timeout: 3000 }
    );

    // The two columns and the number they moved, in the row the write carries.
    const calls = updateBuild.mock.calls;
    const patch = calls[calls.length - 1][1] as Record<string, unknown>;
    expect(patch.made_for).toEqual(["founders", "solo developers"]);
    expect(patch.cost_setup).toBe(40);
    expect(patch.completeness).toBeGreaterThan(0);
    // Two of an app's nine rules, weighted 6 each out of 100.
    expect(patch.completeness).toBe(12);
    await waitFor(() =>
      expect(screen.getByText("12% filled in · 7 things left")).toBeTruthy()
    );
  });
});
