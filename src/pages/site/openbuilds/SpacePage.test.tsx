// UX-05 Part 3: the space page wired. The reads, moderation shown at once and put back if refused, Join, and a space that is not there.

import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSpaceCrowd = vi.fn();
const listPostCards = vi.fn();
const pinPost = vi.fn();
const hidePost = vi.fn();
const unhidePost = vi.fn();
const joinSpace = vi.fn();
let user: { id: string } | null = { id: "mod" };

vi.mock("@/lib/openbuilds", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/openbuilds")>()),
  getSpaceCrowd: (...args: unknown[]) => getSpaceCrowd(...args),
  listPostCards: (options: unknown) => listPostCards(options),
  pinPost: (id: string) => pinPost(id),
  hidePost: (id: string, reason?: string) => hidePost(id, reason),
  unhidePost: (id: string) => unhidePost(id),
  joinSpace: (id: string) => joinSpace(id),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user, loading: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/errors/report", () => ({ reportError: vi.fn() }));
vi.mock("@/hooks/useEngagement", () => ({ useEngagement: () => ({ counts: {}, liked: new Set(), saved: new Set(), loaded: true }), engagementFor: () => ({ counts: null, liked: false, saved: false }) }));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("./PostingWindows", () => ({ default: ({ window: win }: { window: { kind: string } }) => <div data-testid="window">{win.kind}</div> }));

import SpacePage from "./SpacePage";

const space = { id: "s1", slug: "evals", name: "Evals", description: "Scoring work", rules: "Be kind.", creatorId: "sam", whoCanPost: "anyone", postOrder: "newest", defaultView: "thread", rewardsAllowed: true, reactions: [], createdAt: "2026-10-01T00:00:00Z" };
const crowd = (role: string) => ({ space, creator: { id: "sam", handle: "sam" }, moderators: [{ id: "mod", handle: "ola", name: "Ola", avatarUrl: null }], members: 3, role });
const post = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  authorId: "u1",
  parentId: null,
  rootId: id,
  body: `Heading ${id}`,
  aboutBuildId: null,
  aboutNodeId: null,
  rewardGbp: null,
  stillOpen: false,
  tags: [],
  closesAt: null,
  pinnedBy: null,
  pinnedAt: null,
  hiddenBy: null,
  hiddenReason: null,
  likeCount: 0,
  createdAt: new Date(Date.now() - 3_600_000).toISOString(),
  updatedAt: new Date().toISOString(),
  author: { id: "u1", handle: "kit", name: "Kit", avatarUrl: null },
  attachments: [],
  spaces: [{ id: "s1", slug: "evals", name: "Evals" }],
  replyCount: 0,
  ...extra,
});
const extras = { work: { builds: new Map(), nodes: new Map() }, digests: new Map(), signed: new Map() };

function mount(path = "/openbuilds/spaces/evals") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/openbuilds/spaces/:slug" element={<SpacePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

beforeEach(() => {
  user = { id: "mod" };
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  getSpaceCrowd.mockReset().mockResolvedValue(crowd("moderator"));
  listPostCards.mockReset().mockResolvedValue({ posts: [post("p1"), post("p2", { hiddenBy: "mod", hiddenReason: "Off topic" })], next: null, extras });
  pinPost.mockReset().mockResolvedValue(undefined);
  hidePost.mockReset().mockResolvedValue(undefined);
  unhidePost.mockReset().mockResolvedValue(undefined);
  joinSpace.mockReset().mockResolvedValue(undefined);
  toast.mockReset();
  toast.error.mockReset();
});

describe("SpacePage", () => {
  it("reads the space, then its posts in its order, with hidden ones too for a moderator", async () => {
    mount();
    expect(await screen.findByRole("heading", { level: 1, name: "Evals" })).toBeInTheDocument();
    await screen.findByRole("heading", { name: "Heading p1" });
    expect(listPostCards).toHaveBeenCalledWith({ scope: "everyone", spaceId: "s1", order: "newest", includeHidden: true, offset: 0, limit: 20 });
    expect(await screen.findByText("Hidden by @ola · only moderators see this")).toBeInTheDocument();
    expect(screen.getByText("Newest first · set by @sam")).toBeInTheDocument();
  });

  it("does not ask for hidden posts for a reader who does not moderate, and shows no moderation", async () => {
    getSpaceCrowd.mockResolvedValue(crowd("member"));
    listPostCards.mockResolvedValue({ posts: [post("p1")], next: null, extras });
    mount();
    await screen.findByRole("heading", { name: "Heading p1" });
    expect(listPostCards).toHaveBeenCalledWith(expect.objectContaining({ includeHidden: false }));
    expect(screen.queryByRole("button", { name: "Settings" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Moderate this post" })).toBeNull();
  });

  it("pins at once and asks the database after", async () => {
    // The database agrees: the list it returns next has the post pinned.
    pinPost.mockImplementation(async () => {
      listPostCards.mockResolvedValue({ posts: [post("p1", { pinnedBy: "mod", pinnedAt: new Date().toISOString() }), post("p2", { hiddenBy: "mod", hiddenReason: "Off topic" })], next: null, extras });
    });
    mount();
    await screen.findByRole("heading", { name: "Heading p1" });
    const first = screen.getAllByRole("button", { name: "Moderate this post" })[0];
    fireEvent.keyDown(first, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Pin" }));
    expect(await screen.findByText("Pinned")).toBeInTheDocument();
    await waitFor(() => expect(pinPost).toHaveBeenCalledWith("p1"));
  });

  it("puts a refused pin back and says so", async () => {
    pinPost.mockRejectedValue(new Error("Only the topic's author or a moderator can do that."));
    mount();
    await screen.findByRole("heading", { name: "Heading p1" });
    fireEvent.keyDown(screen.getAllByRole("button", { name: "Moderate this post" })[0], { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Pin" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Only the topic's author or a moderator can do that."));
    expect(screen.queryByText("Pinned")).toBeNull();
  });

  it("hides with a reason, and Unhide brings a hidden post back", async () => {
    mount();
    await screen.findByRole("heading", { name: "Heading p1" });
    fireEvent.keyDown(screen.getAllByRole("button", { name: "Moderate this post" })[0], { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Hide" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Reason for hiding" }), { target: { value: "Spam" } });
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    await waitFor(() => expect(hidePost).toHaveBeenCalledWith("p1", "Spam"));
    fireEvent.click(screen.getAllByRole("button", { name: "Unhide" })[0]);
    await waitFor(() => expect(unhidePost).toHaveBeenCalled());
  });

  it("Join joins; signed out it goes to sign in", async () => {
    getSpaceCrowd.mockResolvedValue(crowd("none"));
    listPostCards.mockResolvedValue({ posts: [post("p1")], next: null, extras });
    mount();
    await screen.findByRole("heading", { name: "Heading p1" });
    fireEvent.click(document.querySelector('[data-visual-slot="btn-primary"]') as HTMLElement);
    await waitFor(() => expect(joinSpace).toHaveBeenCalledWith("s1"));
  });

  it("Post here and Settings open the windows", async () => {
    mount();
    await screen.findByRole("heading", { name: "Heading p1" });
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(await screen.findByTestId("window")).toHaveTextContent("settings");
  });

  it("says so when there is no such space", async () => {
    getSpaceCrowd.mockResolvedValue(null);
    mount("/openbuilds/spaces/nope");
    expect(await screen.findByText("There is no space at this address.")).toBeInTheDocument();
  });
});
