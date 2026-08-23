import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const getBuildBySlug = vi.fn();
vi.mock("@/lib/build", () => ({ getBuildBySlug: (s: string) => getBuildBySlug(s) }));

import BuildPage from "@/pages/BuildPage";

const nodeTypes = [
  { key: "live_app", label: "Live app", category: "artefact", colour: "#F59E0B", icon: "Globe", renderer: "artefact", copyable: false, is_active: true, sort: 2,
    schema: { fields: [{ key: "url", label: "URL", type: "string", format: "url" }, { key: "credentials_note", label: "Credentials note", type: "text" }] } },
  { key: "agent_config", label: "Agent configuration", category: "configuration", colour: "#7C3AED", icon: "Bot", renderer: "agent_config", copyable: false, is_active: true, sort: 2,
    schema: { fields: [{ key: "model", label: "Model", type: "string" }, { key: "temperature", label: "Temperature", type: "number" },
      { key: "guardrails", label: "Guardrails", type: "list", of: [{ key: "rule", label: "Rule", type: "string" }] }] } },
  { key: "system_prompt", label: "System prompt", category: "instruction", colour: "#E8571A", icon: "ScrollText", renderer: "instruction", copyable: true, is_active: true, sort: 2,
    schema: { fields: [{ key: "text", label: "Text", type: "text" }] } },
  { key: "prompt", label: "Prompt", category: "instruction", colour: "#E8571A", icon: "MessageSquare", renderer: "prompt", copyable: true, is_active: true, sort: 1,
    schema: { fields: [{ key: "text", label: "Text", type: "text" }] } },
  { key: "gap", label: "Gap", category: "narrative", colour: "#EF4444", icon: "CircleHelp", renderer: "gap", copyable: false, is_active: true, sort: 5,
    schema: { fields: [{ key: "problem", label: "Problem", type: "text" }] } },
  { key: "prerequisite", label: "Prerequisite", category: "narrative", colour: "#9CA3AF", icon: "ListChecks", renderer: "narrative", copyable: false, is_active: true, sort: 4,
    schema: { fields: [{ key: "requirement", label: "Requirement", type: "text" }] } },
  { key: "screenshot", label: "Screenshot", category: "evidence", colour: "#2EC4B6", icon: "Camera", renderer: "evidence", copyable: false, is_active: true, sort: 4,
    schema: { fields: [{ key: "media_id", label: "Media", type: "string" }] } },
];

const node = (id: string, type: string, title: string, extra = {}) => ({
  id, build_id: "b", parent_id: null, position: 0, type, title, note: null,
  payload: {}, source_ref: null, event_id: null, is_gap: false, created_at: "", children: [], ...extra,
});

const record = {
  build: {
    id: "b", slug: "inbox-triage-agent-demo", title: "Inbox triage agent", outcome: "Sorts a full inbox.",
    shape: "app", status: "published", made_for: ["founder"], made_with: ["Claude Opus 4.5"],
    live_url: "https://inbox-triage.demo.neoscaleai.com", repo_url: null,
    hero_node_id: "n1", cost_setup: 0, cost_monthly: 18.4, currency: "GBP", time_to_first_result: 35,
    completeness: 86, reproduction_count: 0, last_confirmed_at: null,
  },
  tree: [
    node("n1", "live_app", "The running agent", { payload: { url: "https://x.test", credentials_note: "Google sign-in." } }),
    node("n2", "agent_config", "Triage agent configuration", {
      position: 1,
      payload: { model: "claude-opus-4-5", temperature: 0.2, guardrails: [{ rule: "Never send." }, { rule: "Never invent a date." }] },
      children: [
        node("n7", "system_prompt", "Triage system prompt", { parent_id: "n2", payload: { text: "You triage a professional inbox." },
          children: [node("n11", "prompt", "Per-email classify call", { parent_id: "n7", payload: { text: "Classify." } })] }),
        node("n8", "prerequisite", "A Google account", { parent_id: "n2", position: 1, payload: { requirement: "Gmail API access." } }),
      ],
    }),
    node("n3", "gap", "Calendar-aware delegation", { position: 2, is_gap: true, payload: { problem: "It cannot tell who to delegate to." } }),
  ],
  tray: [
    node("t1", "screenshot", "Triage view, second draft", { position: null }),
    node("t2", "note", "Cost note, unfinished", { position: null }),
  ],
  events: [],
  nodeTypes,
};

function renderAt(slug: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/b2/${slug}`]}>
        <Routes><Route path="/b2/:slug" element={<BuildPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("BuildPage", () => {
  it("renders header, tabs and the node tree, and never the tray", async () => {
    getBuildBySlug.mockResolvedValue(record);
    const { container } = renderAt("inbox-triage-agent-demo");

    expect(await screen.findByText("Inbox triage agent")).toBeTruthy();
    expect(screen.getByText("first result in 35 minutes")).toBeTruthy();
    expect(screen.getByText("not yet confirmed by anyone")).toBeTruthy();
    expect(screen.getByText("Load it here")).toBeTruthy();

    for (const tab of ["Anatomy", "Watch it get built", "Run it yourself", "Where it broke", "Forks"]) {
      expect(screen.getByText(tab)).toBeTruthy();
    }

    expect(screen.getByText("Per-email classify call")).toBeTruthy();
    expect(screen.getByText("Never invent a date.")).toBeTruthy();
    expect(screen.getAllByText("A Google account").length).toBeGreaterThan(0);

    expect(container.innerHTML).not.toContain("Triage view, second draft");
    expect(container.innerHTML).not.toContain("Cost note, unfinished");

    const gap = container.querySelector('[data-node-id="n3"]') as HTMLElement;
    expect(gap.style.borderLeft).toBe("3px solid #EF4444");
  });

  it("renders a not-found state for an unknown slug", async () => {
    getBuildBySlug.mockResolvedValue(null);
    renderAt("does-not-exist");
    expect(await screen.findByText("No build at this address")).toBeTruthy();
  });

  it("renders an error state when the accessor throws", async () => {
    getBuildBySlug.mockRejectedValue(new Error("getBuildBySlug failed: boom"));
    renderAt("kaboom");
    expect(await screen.findByText("This build could not be loaded")).toBeTruthy();
  });
});
