// UX-05 Part 2: the feed wired. The reads it asks, the address (default values leave it), the old list staying while a new
// one arrives, and Post for a signed-out reader.

import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listPostCards = vi.fn();
const listMySpaces = vi.fn();
const listBusySpaces = vi.fn();
const listRecentPostTimes = vi.fn();
const joinSpace = vi.fn();
let user: { id: string } | null = { id: "me" };

vi.mock("@/lib/openbuilds", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/openbuilds")>()),
  listPostCards: (options: unknown) => listPostCards(options),
  listMySpaces: () => listMySpaces(),
  listBusySpaces: (options: unknown) => listBusySpaces(options),
  listRecentPostTimes: (ids: unknown) => listRecentPostTimes(ids),
  joinSpace: (id: string) => joinSpace(id),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user, loading: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/errors/report", () => ({ reportError: vi.fn() }));
vi.mock("@/hooks/useEngagement", () => ({ useEngagement: () => ({ counts: {}, liked: new Set(), saved: new Set(), loaded: true }), engagementFor: () => ({ counts: null, liked: false, saved: false }) }));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("./PostingWindows", () => ({ default: ({ window: win }: { window: { kind: string } }) => <div data-testid="window">{win.kind}</div> }));

import OpenBuildsFeedPage from "./OpenBuildsFeedPage";

const post = (id: string, body: string) => ({
  id,
  authorId: "u1",
  parentId: null,
  rootId: id,
  body,
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
  createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  updatedAt: new Date().toISOString(),
  author: { id: "u1", handle: "sam", name: "Sam Ellis", avatarUrl: null },
  attachments: [],
  spaces: [{ id: "s1", slug: "claude-code", name: "Claude Code" }],
  replyCount: 0,
});
const extras = { work: { builds: new Map(), nodes: new Map() }, digests: new Map(), signed: new Map() };
const cards = (...posts: ReturnType<typeof post>[]) => ({ posts, next: null, extras });

let where = "";
function Where() {
  where = useLocation().search;
  return null;
}

function mount(path = "/openbuilds") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <OpenBuildsFeedPage />
          <Where />
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

beforeEach(() => {
  user = { id: "me" };
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  listPostCards.mockReset().mockResolvedValue(cards(post("p1", "Can anyone make the scorer faster?")));
  listMySpaces.mockReset().mockResolvedValue([{ id: "s1", slug: "claude-code", name: "Claude Code", whoCanPost: "anyone", role: "member" }]);
  listBusySpaces.mockReset().mockResolvedValue([
    { space: { id: "s1", slug: "claude-code", name: "Claude Code", whoCanPost: "anyone" }, creatorHandle: "sam", members: 12, recent: 5 },
    { space: { id: "s9", slug: "evals", name: "Evals", whoCanPost: "anyone" }, creatorHandle: "ola", members: 412, recent: 4 },
  ]);
  listRecentPostTimes.mockReset().mockResolvedValue({ s1: [new Date().toISOString(), new Date().toISOString()] });
  joinSpace.mockReset().mockResolvedValue(undefined);
  toast.mockReset();
  window.localStorage.clear();
});

describe("OpenBuildsFeedPage", () => {
  it("starts on Your spaces: reads the reader's spaces' posts, 20 a page, and draws the cards", async () => {
    mount();
    expect(await screen.findByRole("heading", { name: "Can anyone make the scorer faster?" })).toBeInTheDocument();
    expect(listPostCards).toHaveBeenCalledWith({ scope: "spaces", stillOpen: undefined, offset: 0, limit: 20 });
    expect(await screen.findByText("2 new")).toBeInTheDocument();
  });

  it("shows Busy this week without the spaces the reader is already in", async () => {
    mount();
    expect(await screen.findByRole("button", { name: "Join Evals" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Join Claude Code" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Join Evals" }));
    await waitFor(() => expect(joinSpace).toHaveBeenCalledWith("s9"));
  });

  it("switching to Everyone and Still open changes the address, and a default value leaves it", async () => {
    mount();
    await screen.findByRole("heading", { name: "Can anyone make the scorer faster?" });
    fireEvent.click(screen.getByRole("tab", { name: "Everyone" }));
    await waitFor(() => expect(where).toBe("?scope=everyone"));
    fireEvent.click(screen.getByRole("button", { name: "Still open" }));
    await waitFor(() => expect(where).toBe("?scope=everyone&open=1"));
    await waitFor(() => expect(listPostCards).toHaveBeenLastCalledWith({ scope: "everyone", stillOpen: true, offset: 0, limit: 20 }));
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    fireEvent.click(screen.getByRole("tab", { name: "Your spaces" }));
    await waitFor(() => expect(where).toBe(""));
  });

  it("keeps the old list on screen until the new one arrives", async () => {
    mount();
    await screen.findByRole("heading", { name: "Can anyone make the scorer faster?" });
    let release: (value: unknown) => void = () => undefined;
    listPostCards.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    fireEvent.click(screen.getByRole("tab", { name: "Everyone" }));
    await waitFor(() => expect(listPostCards).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("heading", { name: "Can anyone make the scorer faster?" })).toBeInTheDocument();
    release(cards(post("p2", "Another post")));
    expect(await screen.findByRole("heading", { name: "Another post" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Can anyone make the scorer faster?" })).toBeNull();
  });

  it("signed out: Everyone only, and Post goes to sign-in and back", async () => {
    user = null;
    mount("/openbuilds?open=1");
    await screen.findByRole("heading", { name: "Can anyone make the scorer faster?" });
    expect(listPostCards).toHaveBeenCalledWith({ scope: "everyone", stillOpen: true, offset: 0, limit: 20 });
    expect(listMySpaces).not.toHaveBeenCalled();
    expect(screen.queryByRole("tablist")).toBeNull();
    fireEvent.click(document.querySelector('[data-visual-slot="btn-primary"]') as HTMLElement);
    await waitFor(() => expect(where).toBe("?redirect=%2Fopenbuilds%3Fopen%3D1"));
  });

  it("Post opens the window for a signed-in reader", async () => {
    mount();
    await screen.findByRole("heading", { name: "Can anyone make the scorer faster?" });
    fireEvent.click(document.querySelector('[data-visual-slot="btn-primary"]') as HTMLElement);
    expect(await screen.findByTestId("window")).toHaveTextContent("post");
  });

  it("says Posts didn't load, with Retry, when the read fails", async () => {
    listPostCards.mockReset().mockRejectedValue(new Error("boom"));
    mount();
    expect(await screen.findByText("Posts didn't load.")).toBeInTheDocument();
    listPostCards.mockResolvedValue(cards(post("p1", "Back again")));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Back again" })).toBeInTheDocument();
  });
});
