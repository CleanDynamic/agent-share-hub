// UX-15 P5: Privacy and blocking. The list and Unblock, the Block confirmation, each `···` entry (profile, topic, reply), the blocked
// profile from both sides, and the collapsed reply. The pair rules themselves are T1 to T15 in design/audits/ux-15/rls-plan.sql.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  insert: vi.fn(async () => ({ error: null })),
  del: vi.fn(async () => ({ error: null })),
  update: vi.fn(async () => ({ error: null })),
  blocks: [] as unknown[],
  isPrivate: false,
  pair: false,
  mine: null as unknown,
}));
vi.mock("@/integrations/supabase/client", () => {
  const select = (table: string, columns: string) => {
    const chain: Record<string, unknown> = {};
    const result = () => {
      if (table === "profiles") return { data: { is_private: db.isPrivate }, error: null };
      if (columns.startsWith("blocked_id, created_at")) return { data: db.blocks, error: null };
      return { data: db.mine, error: null };
    };
    chain.order = () => chain;
    chain.limit = () => Object.assign(Promise.resolve(result()), { maybeSingle: async () => result() });
    chain.eq = () => chain;
    chain.maybeSingle = async () => result();
    return chain;
  };
  return {
    supabase: {
      auth: {},
      rpc: vi.fn(async () => ({ data: db.pair, error: null })),
      from: (table: string) => ({
        select: (columns: string) => select(table, columns),
        insert: db.insert,
        delete: () => ({ eq: () => ({ eq: db.del }) }),
        update: () => ({ eq: db.update }),
      }),
    },
  };
});
const toasts = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: Object.assign(toasts, { error: toasts }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" } }) }));

import { BlockDialog } from "@/components/block/BlockDialog";
import { PostCard } from "@/components/post/PostCard";
import type { PostCardData } from "@/components/post/postCardModel";
import { BLOCK_COPY, blockStateOf, isCollapsed, type BlockedPerson } from "@/lib/settings/blocks";
import { ProfileHead, type ProfileHeadProps } from "@/pages/site/profile/ProfileHead";
import { metaParts, recordParts } from "@/pages/site/profile/profileFeedModel";
import { ReplyList, type ReplyActions } from "@/pages/site/openbuilds/PostReplies";
import type { ReplyItem } from "@/pages/site/openbuilds/postModel";

import { PrivacySection } from "./containers";
import { PrivacyView } from "./PrivacyView";

beforeEach(() => {
  vi.clearAllMocks();
  db.blocks = [];
  db.isPrivate = false;
  db.pair = false;
  db.mine = null;
});
afterEach(cleanup);

const person = (id: string, username: string, displayName: string): BlockedPerson => ({ id, username, displayName, avatarUrl: null, blockedAt: "2026-11-01T10:00:00Z" });

describe("the list", () => {
  it("says so when nobody is blocked", () => {
    render(<MemoryRouter><PrivacyView isPrivate={false} onTogglePrivate={vi.fn()} blocked={[]} onUnblock={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText("You haven't blocked anyone.")).toBeTruthy();
  });

  it("draws each person with name, @handle and Unblock, in the order given", () => {
    const onUnblock = vi.fn();
    render(<MemoryRouter><PrivacyView isPrivate={false} onTogglePrivate={vi.fn()} blocked={[person("b", "ben", "Ben Ode"), person("c", "cy", "Cy Ray")]} onUnblock={onUnblock} /></MemoryRouter>);
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByText("Ben Ode")).toBeTruthy();
    expect(within(rows[0]).getByText("@ben")).toBeTruthy();
    fireEvent.click(within(rows[1]).getByRole("button", { name: "Unblock @cy" }));
    expect(onUnblock).toHaveBeenCalledWith(expect.objectContaining({ id: "c" }));
  });

  it("explains blocking in the words that match the database", () => {
    render(<MemoryRouter><PrivacyView isPrivate={false} onTogglePrivate={vi.fn()} blocked={[]} onUnblock={vi.fn()} /></MemoryRouter>);
    expect(BLOCK_COPY.how).toBe(
      "When you block someone, you stop following each other. They can't follow you, message you, reply to you, mention you or like your work, and you won't see each other's builds, topics or replies in your feeds. They aren't told. Your public builds stay public.",
    );
    expect(screen.getByText(BLOCK_COPY.how)).toBeTruthy();
  });

  it("has the Private profile switch and a link to Customise profile, not a copy of Who sees", () => {
    const onTogglePrivate = vi.fn();
    render(
      <MemoryRouter>
        <PrivacyView isPrivate onTogglePrivate={onTogglePrivate} blocked={[]} onUnblock={vi.fn()} />
      </MemoryRouter>,
    );
    const sw = screen.getByRole("switch", { name: "Private profile" });
    expect(sw.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(sw);
    expect(onTogglePrivate).toHaveBeenCalledWith(false);
    expect(screen.getByRole("link", { name: "Customise profile" }).getAttribute("href")).toBe("/profile?customise=1");
    expect(screen.queryByText("Notes in your feed")).toBeNull();
  });
});

describe("the container", () => {
  const mount = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <PrivacySection />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  it("loads the blocked people and Unblock removes the row and deletes the block", async () => {
    db.blocks = [{ blocked_id: "b", created_at: "2026-11-02", blocked: { id: "b", username: "ben", display_name: "Ben Ode", avatar_url: null } }];
    mount();
    expect(await screen.findByText("Ben Ode")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Unblock @ben" }));
    await waitFor(() => expect(screen.queryByText("Ben Ode")).toBeNull());
    expect(db.del).toHaveBeenCalledTimes(1);
    expect(screen.getByText("You haven't blocked anyone.")).toBeTruthy();
  });

  it("writes is_private from the switch", async () => {
    mount();
    fireEvent.click(await screen.findByRole("switch", { name: "Private profile" }));
    await waitFor(() => expect(db.update).toHaveBeenCalledTimes(1));
  });
});

describe("the Block confirmation", () => {
  it("asks once, writes one row on Block, and tells the page", async () => {
    const onClose = vi.fn();
    const onBlocked = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BlockDialog target={{ id: "u-maya", handle: "maya" }} viewerId="me" onClose={onClose} onBlocked={onBlocked} />
      </QueryClientProvider>,
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Block @maya?")).toBeTruthy();
    expect(within(dialog).getByText("They won't be told.")).toBeTruthy();
    expect(db.insert).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Block" }));
    await waitFor(() => expect(db.insert).toHaveBeenCalledWith({ blocker_id: "me", blocked_id: "u-maya" }));
    await waitFor(() => expect(onBlocked).toHaveBeenCalledWith({ id: "u-maya", handle: "maya" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("writes nothing on Cancel", async () => {
    const onClose = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BlockDialog target={{ id: "u-maya", handle: "maya" }} viewerId="me" onClose={onClose} />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(db.insert).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("says Couldn't block them when the write fails, and stays open", async () => {
    db.insert.mockResolvedValueOnce({ error: { code: "42501" } } as never);
    const onClose = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BlockDialog target={{ id: "u-maya", handle: "maya" }} viewerId="me" onClose={onClose} />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Block" }));
    expect(await screen.findByText("Couldn't block them. Try again.")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});

const headProps = (over: Partial<ProfileHeadProps> = {}): ProfileHeadProps => ({
  userId: "u-maya",
  name: "Maya Ali",
  handle: "maya",
  avatarUrl: null,
  avatarAlt: null,
  header: null,
  meta: metaParts({ handle: "maya", place: null, joined: "Feb 2026", followers: 3, following: 1 }),
  level: null,
  oneLine: null,
  links: [],
  record: recordParts("maya", { builds: 1, reproducedByOthers: 0, rebuiltFrom: 0, firstRebuildSlug: null, topicsAndReplies: 0 }),
  isOwn: false,
  following: false,
  onFollow: vi.fn(),
  onUnfollow: vi.fn(),
  onMessage: vi.fn(),
  onEdit: vi.fn(),
  onCopyLink: vi.fn(),
  onReport: vi.fn(),
  ...over,
});

describe("the profile, from both sides", () => {
  it("offers Block @maya in ···, for someone else's profile only", async () => {
    const onBlock = vi.fn();
    render(<MemoryRouter><ProfileHead {...headProps({ onBlock })} /></MemoryRouter>);
    fireEvent.keyDown(screen.getByRole("button", { name: "More for this profile" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Block @maya" }));
    expect(onBlock).toHaveBeenCalledTimes(1);
    cleanup();
    render(<MemoryRouter><ProfileHead {...headProps({ isOwn: true, onBlock })} /></MemoryRouter>);
    expect(screen.queryByRole("button", { name: "More for this profile" })).toBeNull();
  });

  it("after you block: the sentence, Unblock, and no Follow or Message", () => {
    const onUnblock = vi.fn();
    render(<MemoryRouter><ProfileHead {...headProps({ blocked: "by_me", privateLine: BLOCK_COPY.youBlocked("maya"), onUnblock })} /></MemoryRouter>);
    expect(screen.getByText("You blocked @maya.")).toBeTruthy();
    const actions = screen.getByTestId("profile-actions");
    expect(within(actions).getAllByRole("button").map((b) => b.textContent)).toEqual(["Unblock", "···"]);
    fireEvent.click(within(actions).getByRole("button", { name: "Unblock" }));
    expect(onUnblock).toHaveBeenCalledTimes(1);
  });

  it("when they blocked you: the head and a sentence that gives no reason, and no actions", () => {
    render(<MemoryRouter><ProfileHead {...headProps({ blocked: "by_them", privateLine: BLOCK_COPY.cannotSee("maya") })} /></MemoryRouter>);
    expect(screen.getByText("You can't see @maya's builds or posts.")).toBeTruthy();
    expect(screen.queryByText(/block/i)).toBeNull();
    expect(within(screen.getByTestId("profile-actions")).queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByRole("heading", { level: 1, name: "Maya Ali" })).toBeTruthy();
  });
});

describe("the blocked state of a pair", () => {
  it("reads by_me from my own row, by_them from the pair check, and none otherwise", async () => {
    db.mine = { blocked_id: "u" };
    expect(await blockStateOf("me", "u")).toBe("by_me");
    db.mine = null;
    db.pair = true;
    expect(await blockStateOf("me", "u")).toBe("by_them");
    db.pair = false;
    expect(await blockStateOf("me", "u")).toBe("none");
    expect(await blockStateOf("me", "me")).toBe("none");
  });

  it("collapses a reply only for an author I blocked", () => {
    expect(isCollapsed("b", new Set(["b"]))).toBe(true);
    expect(isCollapsed("c", new Set(["b"]))).toBe(false);
    expect(isCollapsed(null, new Set(["b"]))).toBe(false);
  });
});

const card: PostCardData = {
  id: "p1",
  to: "/openbuilds/topics/p1",
  author: { id: "u1", name: "Sam Ellis", handle: "sam", avatarUrl: null },
  age: "2h",
  spaces: [],
  reward: null,
  heading: "A topic",
  text: "Words.",
  attachments: [],
  stillOpen: false,
  tags: [],
  closes: null,
  replies: null,
  pinned: false,
  hidden: null,
  engagementBuild: null,
};

describe("a topic's ···", () => {
  it("offers Block @sam when the page passes it, and not otherwise", async () => {
    const onSelect = vi.fn();
    render(<MemoryRouter><PostCard card={card} onBlock={{ label: BLOCK_COPY.action("sam"), onSelect }} /></MemoryRouter>);
    fireEvent.keyDown(screen.getByRole("button", { name: "More for this topic" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Block @sam" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    cleanup();
    render(<MemoryRouter><PostCard card={card} /></MemoryRouter>);
    expect(screen.queryByRole("button", { name: "More for this topic" })).toBeNull();
  });
});

const reply = (id: string, extra: Partial<ReplyItem> = {}): ReplyItem => ({
  id,
  depth: 0,
  author: { id: `u-${id}`, name: id.toUpperCase(), handle: id, avatarUrl: null },
  age: "20m",
  body: `Words of ${id}`,
  about: null,
  attachments: [],
  likes: 0,
  liked: false,
  pinnedBy: null,
  build: null,
  step: null,
  children: [],
  more: 0,
  canPin: false,
  canHide: false,
  canReport: true,
  ...extra,
});
const replyActions = (over: Partial<ReplyActions> = {}): ReplyActions => ({ onReply: vi.fn(), onLike: vi.fn(), onPin: vi.fn(), onUnpin: vi.fn(), onHide: vi.fn(), branchHref: (id) => `?reply=${id}`, ...over });

describe("a reply", () => {
  it("offers Block @ola in its ···", async () => {
    const onBlock = vi.fn();
    render(<MemoryRouter><ReplyList items={[reply("ola")]} actions={replyActions({ onBlock })} /></MemoryRouter>);
    fireEvent.keyDown(screen.getByRole("button", { name: "More for this reply" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Block @ola" }));
    expect(onBlock).toHaveBeenCalledWith("ola");
  });

  it("collapses a blocked person's reply to one row and keeps the thread around it", () => {
    const items = [reply("ola", { children: [reply("sam", { depth: 1 })] }), reply("ben")];
    render(<MemoryRouter><ReplyList items={items} actions={replyActions({ blockedAuthors: new Set(["u-ola"]) })} /></MemoryRouter>);
    const collapsed = screen.getAllByTestId("reply-collapsed");
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].textContent).toBe("A reply from someone you blocked");
    expect(screen.queryByText("Words of ola")).toBeNull();
    expect(screen.getByText("Words of sam")).toBeTruthy();
    expect(screen.getByText("Words of ben")).toBeTruthy();
  });
});
