// Acceptance cover for the conversion offer (NS-P24).
//
// What a type checker cannot see: that a creator is shown the real plan rather
// than a promise of one, that a post already converted offers the draft that
// exists instead of making a second, that someone else's post refuses, and
// that every state on this surface keeps a way back to the original post —
// which is still published, and still where it was.
//
// planConversion is deliberately NOT stubbed. The list on screen is the write.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const readSource = vi.fn();
const findConversion = vi.fn();
const convertContentItem = vi.fn();
const getNodeTypes = vi.fn();

const auth = vi.hoisted(() => ({
  user: null as { id: string } | null,
  isLoggedIn: false,
  loading: false,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: auth.user, isLoggedIn: auth.isLoggedIn, loading: auth.loading }),
}));

/** The reads and the one write are stubbed; the planning is the real thing. */
vi.mock("@/lib/build", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/build")>();
  return {
    ...actual,
    readSource: (id: string) => readSource(id),
    findConversion: (id: string) => findConversion(id),
    convertContentItem: (id: string) => convertContentItem(id),
    getNodeTypes: () => getNodeTypes(),
  };
});

import ConvertPrompt from "@/components/build/ConvertPrompt";

const ITEM_ID = "11111111-2222-4333-8444-555555555555";
const CREATOR = "creator-1";
const BUILD_ID = "build-1";

const nodeTypes = [
  { key: "prompt", label: "Prompt", category: "instruction", colour: "#E8571A", icon: null,
    renderer: "prompt", copyable: true, is_active: true, sort: 1, schema: { fields: [] } },
  { key: "note", label: "Note", category: "narrative", colour: "#9CA3AF", icon: null,
    renderer: "narrative", copyable: false, is_active: true, sort: 1, schema: { fields: [] } },
  { key: "document", label: "Document", category: "artefact", colour: "#F59E0B", icon: null,
    renderer: "artefact", copyable: false, is_active: true, sort: 5, schema: { fields: [] } },
];

let counter = 0;
const block = (overrides: Record<string, unknown> = {}) => {
  counter += 1;
  return {
    id: `block-${counter}`, content_id: ITEM_ID, position: counter,
    block_type: "text", text_content: null, file_url: null, file_name: null,
    image_url: null, image_description: null, external_file_url: null,
    github_url: null, sub_blocks: null, use_instructions: null,
    ...overrides,
  };
};

function source(overrides: Record<string, unknown> = {}) {
  return {
    item: {
      id: ITEM_ID, creator_id: CREATOR, title: "Inbox triage agent",
      description: "Drafts replies without sending them.",
      ai_tools: ["Claude"], use_cases: ["Lawyer"], difficulty: "Intermediate",
      file_url: null, use_instructions: null, what_to_expect: null,
      monetisation_type: "free", price_gbp: null, donation_enabled: false,
      ...overrides,
    },
    blocks: [
      block({ block_type: "prompt", text_content: "Summarise this thread." }),
      block({ block_type: "text", text_content: "Why I built it." }),
      block({ block_type: "resource", text_content: "The paper", file_url: "https://arxiv.org/abs/1" }),
    ],
  };
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="path">{`${location.pathname}${location.search}`}</span>;
}

function renderPrompt() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/convert/${ITEM_ID}`]}>
        <LocationProbe />
        <Routes>
          <Route path="/convert/:contentItemId" element={<ConvertPrompt />} />
          <Route path="/login" element={<span>sign in</span>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  counter = 0;
  auth.user = { id: CREATOR };
  auth.isLoggedIn = true;
  auth.loading = false;

  readSource.mockReset().mockResolvedValue(source());
  findConversion.mockReset().mockResolvedValue(null);
  convertContentItem.mockReset().mockResolvedValue({ id: BUILD_ID, status: "draft" });
  getNodeTypes.mockReset().mockResolvedValue(nodeTypes);
});

describe("the conversion offer", () => {
  it("shows the real plan, block by block, before anything is written", async () => {
    renderPrompt();

    await screen.findByText(/Convert “Inbox triage agent”/);
    expect(screen.getByText(/3 blocks → 2 in the tree, 1 in the tray/)).toBeTruthy();

    expect(screen.getByText("Summarise this thread.")).toBeTruthy();
    expect(screen.getByText("Why I built it.")).toBeTruthy();
    // The one that does not map says so, in words, in the tray section.
    expect(screen.getByText(/What waits in the tray/)).toBeTruthy();
    expect(screen.getByText(/has no node type that means the same thing/i)).toBeTruthy();

    expect(convertContentItem).not.toHaveBeenCalled();
  });

  it("promises the post is untouched, and keeps a link back to it", async () => {
    renderPrompt();
    await screen.findByText(/Convert “Inbox triage agent”/);

    expect(screen.getByText(/published, unchanged, at the same URL/i)).toBeTruthy();
    const back = screen.getByText("← Back to the post") as HTMLAnchorElement;
    expect(back.getAttribute("href")).toBe(`/content/${ITEM_ID}`);
  });

  it("converts once and then offers the draft", async () => {
    renderPrompt();
    await screen.findByText(/Convert “Inbox triage agent”/);

    fireEvent.click(screen.getByRole("button", { name: /Convert to a build record/ }));

    await screen.findByText("Converted");
    expect(convertContentItem).toHaveBeenCalledTimes(1);
    expect(convertContentItem).toHaveBeenCalledWith(ITEM_ID);

    const open = screen.getByText("Open the draft") as HTMLAnchorElement;
    expect(open.getAttribute("href")).toBe(`/compose/${BUILD_ID}`);
    expect((screen.getByText("Back to the post") as HTMLAnchorElement).getAttribute("href")).toBe(
      `/content/${ITEM_ID}`
    );
  });

  it("offers the existing draft rather than a second conversion", async () => {
    findConversion.mockResolvedValue({ id: BUILD_ID, status: "draft" });

    renderPrompt();

    await screen.findByText(/already converted this post/i);
    expect((screen.getByText("Open the draft") as HTMLAnchorElement).getAttribute("href")).toBe(
      `/compose/${BUILD_ID}`
    );
    expect(screen.queryByRole("button", { name: /Convert to a build record/ })).toBeNull();
    expect(convertContentItem).not.toHaveBeenCalled();
  });

  it("refuses a post the reader did not write", async () => {
    auth.user = { id: "someone-else" };

    renderPrompt();

    await screen.findByText("This post is not yours");
    expect(screen.queryByRole("button", { name: /Convert to a build record/ })).toBeNull();
  });

  it("sends a signed-out reader to sign in and back", async () => {
    auth.user = null;
    auth.isLoggedIn = false;

    renderPrompt();

    await waitFor(() =>
      expect(screen.getByTestId("path").textContent).toBe(
        `/login?redirect=${encodeURIComponent(`/convert/${ITEM_ID}`)}`
      )
    );
    expect(readSource).not.toHaveBeenCalled();
  });

  it("says what went wrong rather than silently doing nothing", async () => {
    convertContentItem.mockRejectedValue(new Error("convertContentItem failed: network"));

    renderPrompt();
    await screen.findByText(/Convert “Inbox triage agent”/);
    fireEvent.click(screen.getByRole("button", { name: /Convert to a build record/ }));

    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toMatch(/network/);
  });
});
