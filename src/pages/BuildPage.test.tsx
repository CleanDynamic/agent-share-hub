import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getBuildBySlug = vi.fn();
const getMediaForBuild = vi.fn().mockResolvedValue([]);

/**
 * The record and the media are stubbed; the rest of the lib layer is real.
 *
 * signedMediaUrl is the one thing on the read path that talks to storage —
 * build-media is private, so what reaches an <img src> is signed — and jsdom
 * cannot sign anything. The stub keeps the transform visible in the URL so the
 * width each slot asks for can be asserted.
 */
vi.mock("@/lib/build", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/build")>();
  return {
    ...actual,
    getBuildBySlug: (slug: string) => getBuildBySlug(slug),
    getMediaForBuild: (buildId: string) => getMediaForBuild(buildId),
    signedMediaUrl: async (media: { path: string }, options?: { width?: number }) =>
      `https://project.supabase.co/storage/v1/render/image/sign/build-media/${media.path}` +
      `?width=${options?.width}&quality=75&token=t`,
  };
});

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

beforeEach(() => {
  vi.clearAllMocks();
  getMediaForBuild.mockResolvedValue([]);
});

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

  it("switches to the run view, which shows only the copyable nodes", async () => {
    getBuildBySlug.mockResolvedValue(record);
    const { container } = renderAt("inbox-triage-agent-demo");

    expect(await screen.findByText("Inbox triage agent")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Run it yourself/ }));

    const steps = container.querySelectorAll('[data-visual-slot="build-run-step"]');
    expect([...steps].map((step) => step.getAttribute("data-node-type"))).toEqual([
      "system_prompt",
      "prompt",
    ]);

    // The prerequisite is a checklist item, and the anatomy is gone with its
    // non-copyable nodes and its notes.
    const checklist = container.querySelector('[data-visual-slot="build-run-prerequisites"]') as HTMLElement;
    expect(within(checklist).getByText(/A Google account/)).toBeTruthy();
    expect(container.querySelector('[data-visual-slot="build-anatomy-tree"]')).toBeNull();
    expect(container.innerHTML).not.toContain("The running agent");

    fireEvent.click(screen.getByRole("tab", { name: "Anatomy" }));
    expect(container.querySelector('[data-visual-slot="build-anatomy-tree"]')).toBeTruthy();
  });

  it("leaves the three unbuilt tabs disabled", async () => {
    getBuildBySlug.mockResolvedValue(record);
    renderAt("inbox-triage-agent-demo");
    await screen.findByText("Inbox triage agent");

    for (const label of [/Watch it get built/, /Where it broke/, /Forks/]) {
      expect(screen.getByRole("tab", { name: label }).hasAttribute("disabled")).toBe(true);
    }
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

// --- media (NS-P12) ----------------------------------------------------------
//
// Two properties of the PAGE rather than of any component: a build full of
// media nodes issues exactly ONE media query, and hero_node_id alone is enough
// to put a node's media in the header — with BuildHeader.tsx unchanged since
// NS-P04.

const MEDIA_BUILD_ID = "11111111-0000-4000-8000-000000000001";

function mediaRow(id: string) {
  return {
    id,
    build_id: MEDIA_BUILD_ID,
    node_id: null,
    bucket: "build-media",
    path: `${MEDIA_BUILD_ID}/n/${id}.png`,
    kind: "image",
    mime: "image/png",
    bytes: 200_000,
    width: 2400,
    height: 1350,
    duration: null,
    poster_path: null,
    created_at: "2026-08-23T10:00:00Z",
  };
}

/** A build whose whole tree is media: three screenshots, one media query. */
function mediaRecord(heroNodeId: string | null) {
  return {
    build: {
      id: MEDIA_BUILD_ID,
      slug: "media-build",
      title: "A build made of screenshots",
      outcome: null,
      // Not 'app', so the header's live_url path stays out of the way.
      shape: "study",
      status: "published",
      made_for: [],
      made_with: [],
      live_url: null,
      hero_node_id: heroNodeId,
      cost_setup: null,
      cost_monthly: null,
      currency: "GBP",
      time_to_first_result: null,
      reproduction_count: 0,
      last_confirmed_at: null,
    },
    tree: [
      node("m1", "screenshot", "The queue", { payload: { media_id: "media-1" } }),
      node("m2", "screenshot", "The triage view", { position: 1, payload: { media_id: "media-2" } }),
      node("m3", "screenshot", "The digest", { position: 2, payload: { media_id: "media-3" } }),
    ],
    tray: [],
    events: [],
    nodeTypes,
  };
}

describe("BuildPage media", () => {
  beforeEach(() => {
    getMediaForBuild.mockResolvedValue([mediaRow("media-1"), mediaRow("media-2"), mediaRow("media-3")]);
  });

  it("asks for the build's media once, however many media nodes it holds", async () => {
    getBuildBySlug.mockResolvedValue(mediaRecord(null));
    renderAt("media-build");

    await screen.findByText("A build made of screenshots");
    await waitFor(() => expect(document.querySelectorAll("img").length).toBe(3));

    expect(getMediaForBuild).toHaveBeenCalledTimes(1);
    expect(getMediaForBuild).toHaveBeenCalledWith(MEDIA_BUILD_ID);
  });

  it("serves every in-tree figure transformed, never at original size", async () => {
    getBuildBySlug.mockResolvedValue(mediaRecord(null));
    renderAt("media-build");

    await waitFor(() => expect(document.querySelectorAll("img").length).toBe(3));
    for (const image of Array.from(document.querySelectorAll("img"))) {
      expect(image.getAttribute("src")).toContain("/render/image/");
      expect(image.getAttribute("src")).toContain("width=640");
    }
  });

  it("makes hero_node_id the header hero, with no edit to BuildHeader", async () => {
    getBuildBySlug.mockResolvedValue(mediaRecord("m2"));
    renderAt("media-build");

    const hero = await waitFor(() => {
      const element = document.querySelector('[data-visual-slot="build-hero"] img');
      expect(element).toBeTruthy();
      return element as HTMLImageElement;
    });

    // m2's media, at hero width rather than the tree's.
    expect(hero.getAttribute("src")).toContain("media-2.png");
    expect(hero.getAttribute("src")).toContain("width=1200");
    expect(hero.getAttribute("alt")).toBe("The triage view");

    // And still one query: the hero resolved through the same list.
    expect(getMediaForBuild).toHaveBeenCalledTimes(1);
  });

  it("leads with the title when hero_node_id points at nothing renderable", async () => {
    getBuildBySlug.mockResolvedValue(mediaRecord("m-missing"));
    renderAt("media-build");

    await screen.findByText("A build made of screenshots");
    await waitFor(() => expect(document.querySelectorAll("img").length).toBe(3));
    expect(document.querySelector('[data-visual-slot="build-hero"]')).toBeNull();
  });
});
