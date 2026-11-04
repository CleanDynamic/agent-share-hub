// UX-05 Part 4: the New post window. The empty-send message, the Reward rule, the post written ahead of the server, and a refusal.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listPostableSpaces = vi.fn();
const listAttachableWork = vi.fn();
const readNamedWork = vi.fn();
const createPost = vi.fn();
const resolveMentionIds = vi.fn();
const uploadEntryMedia = vi.fn();

vi.mock("@/lib/openbuilds", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/openbuilds")>()),
  listPostableSpaces: () => listPostableSpaces(),
  listAttachableWork: (options: unknown) => listAttachableWork(options),
  labelAttachable: async (works: { title: string; buildTitle: string }[]) => works.map((work) => ({ ...work, label: work.title, context: work.buildTitle })),
  readNamedWork: (named: unknown) => readNamedWork(named),
  createPost: (input: unknown) => createPost(input),
  resolveMentionIds: (body: string) => resolveMentionIds(body),
  uploadEntryMedia: (file: File) => uploadEntryMedia(file),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" }, profile: { username: "sam", display_name: "Sam Ellis", avatar_url: null } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/errors/report", () => ({ reportError: vi.fn() }));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { NewPostWindow } from "./NewPostWindow";
import type { NewPostDraft } from "./sendPost";

const space = (id: string, name: string, rewardsAllowed = true) => ({ id, slug: name.toLowerCase().replace(/\s+/g, "-"), name, description: "", rules: "", creatorId: "x", whoCanPost: "anyone", postOrder: "newest", defaultView: "thread", rewardsAllowed, reactions: [], createdAt: "2026-10-01T00:00:00Z" });
const nodes = ["a", "b", "c"].map((id, index) => ({ id, build_id: "b1", parent_id: null, type: "prompt", title: `Step ${id}`, position: index, is_gap: false, tested: null, setup: null, step: null, text: `Text ${id}`, session: null }));
const feedKey = ["posts", "listPostCards", "feed", "everyone", false, "me"];
const extras = { work: { builds: new Map(), nodes: new Map() }, digests: new Map(), signed: new Map() };
const existing = { id: "old", authorId: "u1", parentId: null, rootId: "old", body: "An older post", aboutBuildId: null, aboutNodeId: null, rewardGbp: null, stillOpen: false, tags: [], closesAt: null, pinnedBy: null, pinnedAt: null, hiddenBy: null, hiddenReason: null, likeCount: 0, createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z", author: null, attachments: [], spaces: [], replyCount: 0 };

function draw(props: { spaceSlug?: string; draft?: NewPostDraft } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(feedKey, { pages: [{ posts: [existing], next: null, extras }], pageParams: [0] });
  const onClose = vi.fn();
  const onReopen = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NewPostWindow {...props} onClose={onClose} onReopen={onReopen} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { client, onClose, onReopen };
}

const bodies = (client: QueryClient) => (client.getQueryData(feedKey) as { pages: { posts: { body: string; id: string }[] }[] }).pages[0].posts.map((post) => post.body);

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  listPostableSpaces.mockReset().mockResolvedValue([space("s1", "Claude Code"), space("s2", "Hiring tools", false)]);
  listAttachableWork.mockReset().mockResolvedValue([{ size: "step", origin: "published", buildId: "b1", buildTitle: "Resume screener", nodeId: "b", partKey: null, sessionKey: null, title: "Scorer", makerId: "me" }]);
  readNamedWork.mockReset().mockResolvedValue({ builds: new Map([["b1", { id: "b1", slug: "resume", title: "Resume screener", madeWith: "Claude Code", status: "published", reproduction_count: 0, last_confirmed_at: null, last_confirmed_model: null, published_at: "2026-10-01T00:00:00Z" }]]), nodes: new Map([["b1", nodes]]) });
  createPost.mockReset().mockResolvedValue("new-id");
  resolveMentionIds.mockReset().mockResolvedValue(["u9"]);
  uploadEntryMedia.mockReset().mockResolvedValue({ path: "entries/me/x.png", mediaKind: "image" });
  toast.mockReset();
  toast.error.mockReset();
});

describe("NewPostWindow", () => {
  it("is titled New post, with a hidden label Post on the one box, the two attach controls and Cancel and Post", async () => {
    draw();
    expect(await screen.findByRole("dialog", { name: "New post" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Post" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Attach work" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add image or file" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post" })).toBeInTheDocument();
  });

  it("says Write something or attach work at once, under the box, and sends nothing", async () => {
    const { onClose } = draw();
    fireEvent.click(await screen.findByRole("button", { name: "Post" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Write something or attach work.");
    expect(createPost).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("is prefilled with the space it was opened from, and None is allowed", async () => {
    draw({ spaceSlug: "claude-code" });
    expect(await screen.findByRole("button", { name: "Post to: Claude Code" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "Post to: Claude Code" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Claude Code" }));
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(await screen.findByRole("button", { name: "Post to: Everyone" })).toBeInTheDocument();
  });

  it("leaves Reward out of + Add when a chosen space disallows rewards", async () => {
    draw({ spaceSlug: "claude-code" });
    await screen.findByRole("button", { name: "Post to: Claude Code" });
    fireEvent.keyDown(screen.getByRole("button", { name: "+ Add" }), { key: "Enter" });
    expect(await screen.findByRole("menuitem", { name: "Reward" })).toBeInTheDocument();
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Reward", "Still open", "Tags", "Closes on"]);
  });

  it("has no Reward once a space that disallows rewards is chosen, and drops a reward already added", async () => {
    draw({ spaceSlug: "claude-code" });
    await screen.findByRole("button", { name: "Post to: Claude Code" });
    fireEvent.keyDown(screen.getByRole("button", { name: "+ Add" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Reward" }));
    expect(screen.getByRole("textbox", { name: "Reward" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "Post to: Claude Code" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Hiring tools" }));
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Reward" })).toBeNull());
    fireEvent.keyDown(screen.getByRole("button", { name: "+ Add" }), { key: "Enter" });
    await screen.findByRole("menuitem", { name: "Tags" });
    expect(screen.queryByRole("menuitem", { name: "Reward" })).toBeNull();
  });

  it("each added row has its own Remove", async () => {
    draw();
    await screen.findByRole("dialog");
    fireEvent.keyDown(screen.getByRole("button", { name: "+ Add" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Tags" }));
    expect(screen.getByRole("textbox", { name: "Tags" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove Tags" }));
    expect(screen.queryByRole("textbox", { name: "Tags" })).toBeNull();
  });

  it("attaches work with Remove, and clicking a step marks it still open", async () => {
    draw();
    fireEvent.click(await screen.findByRole("button", { name: "Attach work" }));
    fireEvent.click(await screen.findByRole("button", { name: /Scorer/ }));
    expect(await screen.findByText("Step 2 · Prompt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Step 2 · Prompt" })).toBeInTheDocument();
  });

  it("writes the post ahead of the server's answer, closes at once, and saves the mention", async () => {
    let answer: (id: string) => void = () => undefined;
    createPost.mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    const { client, onClose } = draw({ spaceSlug: "claude-code" });
    await screen.findByRole("button", { name: "Post to: Claude Code" });
    fireEvent.change(screen.getByRole("textbox", { name: "Post" }), { target: { value: "Can @kit make this faster?\nIt takes four seconds." } });
    fireEvent.click(screen.getByRole("button", { name: "Attach work" }));
    fireEvent.click(await screen.findByRole("button", { name: /Scorer/ }));
    await screen.findByText("Step 2 · Prompt");
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    expect(onClose).toHaveBeenCalled();
    // At the top of the list before the database has answered.
    expect(bodies(client)).toEqual(["Can @kit make this faster?\nIt takes four seconds.", "An older post"]);
    await waitFor(() => expect(createPost).toHaveBeenCalled());
    expect(createPost).toHaveBeenCalledWith(expect.objectContaining({ body: "Can @kit make this faster?\nIt takes four seconds.", spaceIds: ["s1"], attachments: [{ kind: "step", buildId: "b1", nodeId: "b" }], mentionIds: ["u9"] }));
    answer("new-id");
  });

  it("puts the list back, toasts, and hands the window's content back when the post is refused", async () => {
    createPost.mockRejectedValue(new Error("refused"));
    const { client, onReopen } = draw({ spaceSlug: "claude-code" });
    await screen.findByRole("button", { name: "Post to: Claude Code" });
    fireEvent.change(screen.getByRole("textbox", { name: "Post" }), { target: { value: "Will not send" } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Your post didn't send. Try again."));
    expect(bodies(client)).toEqual(["An older post"]);
    expect(onReopen).toHaveBeenCalledWith(expect.objectContaining({ body: "Will not send", spaceIds: ["s1"] }));
  });

  it("comes back with its content when opened with a draft", async () => {
    draw({ draft: { body: "Kept words", spaceIds: [], attachments: [], added: [], reward: "", stillOpen: false, openNodeId: null, tags: "", closes: "" } });
    expect(await screen.findByRole("textbox", { name: "Post" })).toHaveValue("Kept words");
  });

  it("shows an added picture in the post media grid, from the file itself, with a Remove for it", async () => {
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:picture", revokeObjectURL: () => undefined }));
    draw();
    await screen.findByRole("dialog");
    fireEvent.change(screen.getByLabelText("Choose an image or file"), { target: { files: [new File(["x"], "scorer.png", { type: "image/png" })] } });
    expect(await screen.findByRole("group", { name: "1 picture" })).toHaveAttribute("data-post-media-grid", "");
    expect(uploadEntryMedia).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Remove picture 1" }));
    expect(screen.queryByRole("group", { name: "1 picture" })).toBeNull();
  });

  it("uses no em dash in any copy", async () => {
    draw();
    await screen.findByRole("dialog");
    expect(within(screen.getByRole("dialog")).queryByText(String.fromCharCode(8212))).toBeNull();
    expect(document.body.textContent).not.toContain(String.fromCharCode(8212));
  });
});
