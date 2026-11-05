// UX-06 Part 1: the post page wired. The post first, then its extras; a missing or hidden post; an error with Retry; who gets
// Pin and Hide; the step filter from the address.

import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PostPageExtras } from "@/lib/openbuilds/postPage";
import type { PostThread } from "@/lib/openbuilds/types";

const getPost = vi.fn();
const readPostExtras = vi.fn();
let user: { id: string } | null = { id: "me" };

vi.mock("@/lib/openbuilds", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/openbuilds")>()),
  getPost: (id: string) => getPost(id),
  pinPost: vi.fn(async () => undefined),
  likePost: vi.fn(async () => undefined),
}));
vi.mock("@/lib/openbuilds/postPage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/openbuilds/postPage")>()),
  readPostExtras: (thread: unknown, viewer: unknown) => readPostExtras(thread, viewer),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user, profile: null, loading: false, isLoggedIn: user !== null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/errors/report", () => ({ reportError: vi.fn() }));
vi.mock("@/hooks/useEngagement", () => ({ useEngagement: () => ({ counts: {}, liked: new Set(), saved: new Set(), loaded: true }), engagementFor: () => ({ counts: null, liked: false, saved: false }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import { attachment, entry } from "./postModel.fixtures";
import PostPage from "./PostPage";

const crowd = (role: "none" | "member" | "moderator") => ({
  space: { id: "s1", slug: "claude-code", name: "Claude Code", description: "Work made with Claude Code", rules: "", creatorId: "sam", whoCanPost: "anyone", postOrder: "newest", defaultView: "thread", rewardsAllowed: false, reactions: [], createdAt: "" },
  creator: { id: "sam", handle: "sam" },
  moderators: [{ id: "sam", handle: "sam", name: "Sam", avatarUrl: null }],
  members: 412,
  role,
});

const extras = (role: "none" | "member" | "moderator" = "member"): PostPageExtras => ({ work: { builds: new Map(), nodes: new Map() }, signed: new Map(), facts: new Map(), steps: new Map(), liked: new Set(), crowd: crowd(role) as PostPageExtras["crowd"] });

const thread = (extra: Partial<PostThread> = {}): PostThread =>
  entry("p1", 120, {
    parentId: null,
    authorId: "sam",
    body: "Can anyone make the scorer faster?\nIt takes four seconds a CV.",
    spaces: [{ id: "s1", slug: "claude-code", name: "Claude Code" }],
    replyCount: 2,
    replies: [entry("kit", 60, { aboutNodeId: "n4" }), entry("ola", 30)],
    ...extra,
  });

let where = "";
function Where() {
  where = useLocation().search;
  return null;
}

function mount(path = "/openbuilds/topics/p1") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/openbuilds/topics/:id" element={<><PostPage /><Where /></>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

describe("the post page", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    user = { id: "me" };
    getPost.mockReset().mockResolvedValue(thread());
    readPostExtras.mockReset().mockResolvedValue(extras());
  });

  it("reads the post, then its extras with the post in hand", async () => {
    mount();
    expect(await screen.findByRole("heading", { level: 1, name: "Can anyone make the scorer faster?" })).toBeInTheDocument();
    expect(getPost).toHaveBeenCalledWith("p1");
    expect(readPostExtras).toHaveBeenCalledWith(expect.objectContaining({ id: "p1" }), "me");
    expect(screen.getAllByTestId("reply")).toHaveLength(2);
  });

  it("says a missing post isn't available, with a way back", async () => {
    getPost.mockResolvedValue(null);
    mount();
    expect(await screen.findByText("This post isn't available.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to OpenBuilds" })).toHaveAttribute("href", "/openbuilds");
  });

  it("says a hidden post isn't available to a reader who doesn't moderate", async () => {
    getPost.mockResolvedValue(thread({ hiddenBy: "sam" }));
    mount();
    expect(await screen.findByText("This post isn't available.")).toBeInTheDocument();
  });

  it("says an error in one sentence, with Retry", async () => {
    getPost.mockRejectedValue(new Error("boom"));
    mount();
    expect(await screen.findByText("This post didn't load.")).toBeInTheDocument();
    getPost.mockResolvedValue(thread());
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("gives a reader who neither wrote the post nor moderates no reply menu", async () => {
    mount();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryAllByRole("button", { name: "More for this reply" })).toHaveLength(0);
  });

  it("gives the post's author Pin but not Hide", async () => {
    user = { id: "sam" };
    mount();
    await screen.findByRole("heading", { level: 1 });
    const [first] = screen.getAllByTestId("reply");
    fireEvent.keyDown(within(first).getByRole("button", { name: "More for this reply" }), { key: "Enter" });
    expect(await screen.findByRole("menuitem", { name: "Pin" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Hide" })).toBeNull();
  });

  it("gives a moderator Pin and Hide", async () => {
    readPostExtras.mockResolvedValue(extras("moderator"));
    mount();
    await screen.findByRole("heading", { level: 1 });
    const [first] = screen.getAllByTestId("reply");
    fireEvent.keyDown(within(first).getByRole("button", { name: "More for this reply" }), { key: "Enter" });
    expect(await screen.findByRole("menuitem", { name: "Pin" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Hide" })).toBeInTheDocument();
  });

  it("filters the Thread to a step from the address, and Show all replies takes the filter away", async () => {
    mount("/openbuilds/topics/p1?step=n4");
    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(screen.getAllByTestId("reply")).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Show all replies" }));
    await waitFor(() => expect(where).toBe(""));
    expect(screen.getAllByTestId("reply")).toHaveLength(2);
  });

  it("keeps one reply box open: at the foot, then under the reply whose Reply was pressed, then back at the foot", async () => {
    mount();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getAllByTestId("reply-box")).toHaveLength(1);
    const thread = screen.getByRole("region", { name: "Thread" });
    expect(within(thread).queryAllByTestId("reply").some((reply) => within(reply).queryByTestId("reply-box"))).toBe(false);

    const [kit] = screen.getAllByTestId("reply");
    fireEvent.click(within(kit).getByRole("button", { name: "Reply" }));
    expect(screen.getAllByTestId("reply-box")).toHaveLength(1);
    expect(within(kit).getByTestId("reply-box")).toBeInTheDocument();
    expect(document.querySelectorAll('[data-visual-slot="btn-primary"]')).toHaveLength(1);
  });

  describe("Line up steps", () => {
    const withBuilds = () =>
      thread({
        attachments: [attachment("build", { buildId: "b-post" })],
        replies: Array.from({ length: 3 }, (_, n) => entry(`r${n}`, 60 - n, { attachments: [attachment("build", { buildId: `b-${n}` })] })),
      });
    const extrasWith = (rebuilds: number): PostPageExtras => {
      const base = extras();
      const card = (id: string) => ({ id, slug: id, title: id, madeWith: null, status: "published", reproduction_count: 0, last_confirmed_at: null, last_confirmed_model: null, published_at: null });
      return {
        ...base,
        work: { builds: new Map(["b-post", "b-0", "b-1", "b-2"].map((id) => [id, card(id)])), nodes: new Map() },
        facts: new Map(["b-0", "b-1", "b-2"].map((id, n) => [id, { id, slug: id, title: id, status: "published", creatorId: "x", parentBuildId: n < rebuilds ? "b-post" : null, sourceHandle: "sam" }])),
      };
    };
    const at = (width: number) =>
      vi.stubGlobal("matchMedia", (query: string) => ({ matches: width >= Number(/min-width:\s*(\d+)/.exec(query)?.[1] ?? 0), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));

    it("offers the checkbox on the Wall with two rebuilds of the post's build, and keeps it in the address", async () => {
      getPost.mockResolvedValue(withBuilds());
      readPostExtras.mockResolvedValue(extrasWith(2));
      mount("/openbuilds/topics/p1?view=wall");
      fireEvent.click(await screen.findByRole("checkbox", { name: "Line up steps" }));
      await waitFor(() => expect(where).toBe("?view=wall&lineup=1"));
      expect(await screen.findByRole("table", { name: /Where the builds differ/ })).toBeInTheDocument();
    });

    it("does not offer it with one rebuild", async () => {
      getPost.mockResolvedValue(withBuilds());
      readPostExtras.mockResolvedValue(extrasWith(1));
      mount("/openbuilds/topics/p1?view=wall");
      await screen.findAllByTestId("wall-card");
      expect(screen.queryByRole("checkbox", { name: "Line up steps" })).toBeNull();
    });

    it("does not offer it below 760 wide, even from the address", async () => {
      at(759);
      getPost.mockResolvedValue(withBuilds());
      readPostExtras.mockResolvedValue(extrasWith(2));
      mount("/openbuilds/topics/p1?view=wall&lineup=1");
      await screen.findAllByTestId("wall-card");
      expect(screen.queryByRole("checkbox", { name: "Line up steps" })).toBeNull();
      expect(screen.queryByRole("table")).toBeNull();
    });
  });
});

describe("UX-09 P1: #reply-box", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    user = { id: "me" };
    getPost.mockReset().mockResolvedValue(thread());
    readPostExtras.mockReset().mockResolvedValue(extras());
  });

  it("opens the topic with the reply box's field focused (Reply on a gap)", async () => {
    mount("/openbuilds/topics/p1#reply-box");
    await screen.findByRole("heading", { level: 1 });
    const box = await screen.findByTestId("reply-box");
    expect(box.id).toBe("reply-box");
    await waitFor(() => expect(document.activeElement).toBe(within(box).getByRole("textbox")));
  });
});
