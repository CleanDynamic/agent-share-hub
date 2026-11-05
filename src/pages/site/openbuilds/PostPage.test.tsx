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
const reportTarget = vi.fn(async (_input: unknown) => undefined);
const openTopicThread = vi.fn(async (_author: string) => "thread-9");
vi.mock("@/lib/messaging/topics", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/messaging/topics")>()), openTopicThread: (author: string) => openTopicThread(author) }));
const siteHiddenPostsOf = vi.fn(async (_id: string) => [] as { id: string; kind: "topic" | "reply"; heading: string }[]);
vi.mock("@/lib/moderation/siteHidden", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/moderation/siteHidden")>()), siteHiddenPostsOf: (id: string) => siteHiddenPostsOf(id) }));
vi.mock("@/lib/moderation", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/moderation")>()), reportTarget: (input: unknown) => reportTarget(input) }));

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

/** UX-09 Q4: where Message @sam lands, and the topic it hands over. */
function Arrived() {
  const location = useLocation();
  return <p data-testid="arrived">{`${location.pathname} ${JSON.stringify(location.state)}`}</p>;
}

function mount(path = "/openbuilds/topics/p1") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/openbuilds/topics/:id" element={<><PostPage /><Where /></>} />
            <Route path="/messages/:threadId" element={<Arrived />} />
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

  it("gives a reader who neither wrote the post nor moderates no Pin or Hide (UX-09 P8: the menu holds Report alone)", async () => {
    mount();
    await screen.findByRole("heading", { level: 1 });
    const [first] = screen.getAllByTestId("reply");
    fireEvent.keyDown(within(first).getByRole("button", { name: "More for this reply" }), { key: "Enter" });
    expect(await screen.findByRole("menuitem", { name: "Report" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Pin" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Hide" })).toBeNull();
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

describe("UX-09 P8: reporting a topic or a reply", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    user = { id: "me" };
    getPost.mockReset().mockResolvedValue(thread());
    readPostExtras.mockReset().mockResolvedValue(extras());
    reportTarget.mockClear();
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  });

  it("a reader reports the topic, and the report is written with its target type", async () => {
    mount();
    await screen.findByRole("heading", { level: 1 });
    fireEvent.keyDown(screen.getByRole("button", { name: "More for this topic" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Report" }));
    const dialog = await screen.findByRole("dialog", { name: "Report this topic" });
    fireEvent.click(within(dialog).getByRole("radio", { name: "Spam" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Send report" }));
    await waitFor(() => expect(reportTarget).toHaveBeenCalledWith({ targetType: "openbuild_post", targetId: "p1", reason: "spam", note: "" }));
  });

  it("a reply is reported as a reply", async () => {
    mount();
    await screen.findByRole("heading", { level: 1 });
    const [first] = screen.getAllByTestId("reply");
    fireEvent.keyDown(within(first).getByRole("button", { name: "More for this reply" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Report" }));
    expect(await screen.findByRole("dialog", { name: "Report this reply" })).toBeInTheDocument();
  });

  it("the author sees no Report on their own topic or reply", async () => {
    user = { id: "sam" };
    getPost.mockResolvedValue(thread({ replies: [entry("sam-reply", 60, { authorId: "sam" })] }));
    mount();
    await screen.findByRole("heading", { level: 1 });
    // Their topic: no menu for a reader who is not a moderator of its space.
    expect(screen.queryByRole("button", { name: "More for this topic" })).toBeNull();
    // Their reply: Pin (they wrote the topic), no Report.
    const [first] = screen.getAllByTestId("reply");
    fireEvent.keyDown(within(first).getByRole("button", { name: "More for this reply" }), { key: "Enter" });
    expect(await screen.findByRole("menuitem", { name: "Pin" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Report" })).toBeNull();
  });
});

describe("UX-09 Q4: Message the topic's author", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    user = { id: "me" };
    getPost.mockReset().mockResolvedValue(thread({ author: { id: "sam", handle: "sam", name: "Sam", avatarUrl: null } }));
    readPostExtras.mockReset().mockResolvedValue(extras());
    openTopicThread.mockClear();
  });

  it("opens the one direct thread with the author, the topic waiting in its message box", async () => {
    mount();
    await screen.findByRole("heading", { level: 1 });
    fireEvent.keyDown(screen.getByRole("button", { name: "More for this topic" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Message @sam" }));
    const arrived = await screen.findByTestId("arrived");
    expect(openTopicThread).toHaveBeenCalledWith("sam");
    expect(arrived.textContent).toBe(`/messages/thread-9 ${JSON.stringify({ shareTopic: { id: "p1", label: "Can anyone make the scorer faster?", subtitle: "@sam" } })}`);
  });

  it("is not offered to the topic's author", async () => {
    user = { id: "sam" };
    mount();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("button", { name: "More for this topic" })).toBeNull();
    expect(openTopicThread).not.toHaveBeenCalled();
  });
});

describe("UX-09 Q5: the author of what the site hid is told", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    user = { id: "me" };
    getPost.mockReset().mockResolvedValue(thread());
    readPostExtras.mockReset().mockResolvedValue(extras());
    siteHiddenPostsOf.mockReset().mockResolvedValue([]);
  });

  it("a hidden topic says Hidden by the site's moderators to its author, with how reporting works", async () => {
    getPost.mockResolvedValue(null);
    siteHiddenPostsOf.mockResolvedValue([{ id: "p1", kind: "topic", heading: "Can anyone make the scorer faster?" }]);
    mount();
    const notice = await screen.findByTestId("site-hidden-notice");
    expect(siteHiddenPostsOf).toHaveBeenCalledWith("p1");
    expect(notice.textContent).toContain("Hidden by the site's moderators: your topic");
    expect(notice.textContent).toContain("“Can anyone make the scorer faster?”");
    expect(within(notice).getByRole("link", { name: "How reporting works" }).getAttribute("href")).toBe("/terms#reporting");
    expect(screen.queryByText("This post isn't available.")).toBeNull();
  });

  it("a hidden reply is named above the topic it was in", async () => {
    siteHiddenPostsOf.mockResolvedValue([{ id: "x1", kind: "reply", heading: "my reply" }]);
    mount();
    await screen.findByRole("heading", { level: 1 });
    const notice = await screen.findByTestId("site-hidden-notice");
    expect(notice.textContent).toContain("Hidden by the site's moderators: your reply");
  });

  it("anyone else is told only that the post isn't available", async () => {
    getPost.mockResolvedValue(null);
    mount();
    expect(await screen.findByText("This post isn't available.")).toBeInTheDocument();
    expect(screen.queryByTestId("site-hidden-notice")).toBeNull();
  });

  it("asks nothing signed out", async () => {
    user = null;
    getPost.mockResolvedValue(null);
    mount();
    expect(await screen.findByText("This post isn't available.")).toBeInTheDocument();
    expect(siteHiddenPostsOf).not.toHaveBeenCalled();
  });
});
