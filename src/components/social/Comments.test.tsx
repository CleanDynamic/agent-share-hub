// RC-P17 — the comments section, rendered.
//
// The claims: a body is text, never markup; a reply cannot be answered; only
// the author sees Edit and Delete, and Delete asks first, in a dialog whose
// primary button names the act; a signed-in reader may Report somebody else's
// comment (RC-P17b) and never their own; an empty build says "No comments
// yet."; at most three actions on any comment; and no body ever reaches an
// error or a toast. The data layer is stubbed at src/lib/social; the section
// is real.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: auth.user, isLoggedIn: auth.user !== null }),
}));

const toast = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast }));

const listComments = vi.fn();
const listPartCommentCounts = vi.fn();
const addComment = vi.fn();
const editComment = vi.fn();
const deleteComment = vi.fn();
vi.mock("@/lib/social", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/social")>()),
  listComments: (...args: unknown[]) => listComments(...args),
  listPartCommentCounts: (...args: unknown[]) => listPartCommentCounts(...args),
  addComment: (...args: unknown[]) => addComment(...args),
  editComment: (...args: unknown[]) => editComment(...args),
  deleteComment: (...args: unknown[]) => deleteComment(...args),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { Comments } from "@/components/social/Comments";
import { SocialError, nestComments, type BuildComment } from "@/lib/social";

const ME = "reader-1";

function comment(id: string, over: Partial<BuildComment> = {}): BuildComment {
  return {
    id,
    buildId: "b1",
    nodeId: null,
    parentId: null,
    authorId: "someone-else",
    author: { id: "someone-else", username: "rae", displayName: "Rae", avatarUrl: null },
    body: `Body of ${id}`,
    isHidden: false,
    createdAt: `2026-09-2${id.length % 9}T09:00:00.000Z`,
    editedAt: null,
    ...over,
  };
}

function page(rows: BuildComment[]) {
  return { comments: nestComments(rows), rows, nextAfter: null };
}

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/b2/invoice-reader"]}>
        <Comments
          build={{ id: "b1", slug: "invoice-reader" }}
          parts={new Map([["n3", { position: 3, title: "Parse the invoice" }]])}
          attachRequest={null}
          onOpenPart={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const items = () => screen.getAllByTestId("comment");
const actionsOf = (item: HTMLElement) =>
  within(item)
    .queryAllByRole("button")
    .map((button) => button.textContent)
    .filter((text) => text === "Reply" || text === "Report" || text === "Edit" || text === "Delete");

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: ME };
  listPartCommentCounts.mockResolvedValue({});
});

describe("Comments", () => {
  it("shows a body's angle brackets as text, never as markup", async () => {
    listComments.mockResolvedValue(page([comment("c1", { body: "<b>x</b>\nsecond line" })]));
    renderSection();

    const body = await screen.findByTestId("comment-body");
    expect(body.textContent).toBe("<b>x</b>\nsecond line");
    expect(body.querySelector("b")).toBeNull();
  });

  it("offers Reply and Report on somebody else's comment, and only Report on their reply", async () => {
    listComments.mockResolvedValue(
      page([comment("c1"), comment("r1", { parentId: "c1", createdAt: "2026-09-29T09:00:00.000Z" })]),
    );
    renderSection();
    await screen.findAllByTestId("comment");

    const [top, reply] = items();
    expect(actionsOf(top)).toEqual(["Reply", "Report"]);
    expect(actionsOf(reply)).toEqual(["Report"]);
    expect(within(screen.getByTestId("comment-replies")).getAllByTestId("comment")).toHaveLength(1);
  });

  it("gives the author Reply, Edit and Delete, at most three, and never Report on their own", async () => {
    const mine = { authorId: ME, author: { id: ME, username: "me", displayName: "Me", avatarUrl: null } };
    listComments.mockResolvedValue(
      page([
        comment("c1", mine),
        comment("c22"),
        comment("r1", { ...mine, parentId: "c22", createdAt: "2026-09-29T09:00:00.000Z" }),
      ]),
    );
    renderSection();
    await screen.findAllByTestId("comment");

    const [own, others, ownReply] = items();
    expect(actionsOf(own)).toEqual(["Reply", "Edit", "Delete"]);
    expect(actionsOf(others)).toEqual(["Reply", "Report"]);
    expect(actionsOf(ownReply)).toEqual(["Edit", "Delete"]);
    for (const item of items()) expect(actionsOf(item).length).toBeLessThanOrEqual(3);
  });

  it("says so on a hidden comment its reader can still see, and offers no Report on it", async () => {
    listComments.mockResolvedValue(page([comment("c1", { isHidden: true })]));
    renderSection();
    await screen.findAllByTestId("comment");

    expect(items()[0].querySelector("time")?.textContent).toContain("hidden by an admin");
    expect(actionsOf(items()[0])).toEqual(["Reply"]);
  });

  it("opens the report dialog on somebody else's comment", async () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    try {
      listComments.mockResolvedValue(page([comment("c1")]));
      renderSection();
      await screen.findAllByTestId("comment");

      fireEvent.click(within(items()[0]).getByRole("button", { name: "Report" }));
      const dialog = await screen.findByTestId("report-dialog");
      expect(within(dialog).getByRole("heading", { name: "Report this comment" })).toBeTruthy();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("asks before deleting, in a dialog whose button says Delete comment", async () => {
    listComments.mockResolvedValue(page([comment("c1", { authorId: ME })]));
    deleteComment.mockResolvedValue(undefined);
    renderSection();
    await screen.findAllByTestId("comment");

    fireEvent.click(within(items()[0]).getByRole("button", { name: "Delete" }));
    expect(deleteComment).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Delete this comment?")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete comment" }));

    await waitFor(() => expect(deleteComment).toHaveBeenCalledWith("c1"));
    await waitFor(() => expect(screen.queryAllByTestId("comment")).toHaveLength(0));
  });

  it("says No comments yet. when there are none, with the box as the action", async () => {
    listComments.mockResolvedValue(page([]));
    renderSection();

    expect((await screen.findByTestId("comments-empty")).textContent).toBe("No comments yet.");
    expect(screen.getByLabelText("Add a comment")).toBeTruthy();
  });

  it("shows a signed-out reader the list and a sign-in link instead of the box", async () => {
    auth.user = null;
    listComments.mockResolvedValue(page([comment("c1")]));
    renderSection();
    await screen.findAllByTestId("comment");

    expect(screen.queryByLabelText("Add a comment")).toBeNull();
    expect(screen.getByRole("link", { name: "Sign in to comment" }).getAttribute("href")).toBe(
      "/login?redirect=%2Fb2%2Finvoice-reader%23comments",
    );
    expect(actionsOf(items()[0])).toEqual([]);
  });

  it("never puts a body in an error: a refused post says so, and keeps the words in the box", async () => {
    const words = "the client is Acme Holdings, invoice 4471";
    listComments.mockResolvedValue(page([]));
    addComment.mockRejectedValue(new SocialError("addComment", "failed", { buildId: "b1" }, "23514", 400));
    renderSection();

    const box = (await screen.findByLabelText("Add a comment")) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: words } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(toast).toHaveBeenCalledWith("Something went wrong.");
    const said = JSON.stringify(toast.mock.calls);
    expect(said).not.toContain("Acme");
    expect(box.value).toBe(words);
    const [thrown] = await addComment.mock.results.map((result) => result.value.catch((error: Error) => error));
    expect(String((thrown as Error).message)).not.toContain("Acme");
  });

  it("posts a trimmed comment and shows it in the list", async () => {
    listComments.mockResolvedValue(page([]));
    addComment.mockImplementation(async (input: { body: string }) =>
      comment("new", { authorId: ME, body: input.body.trim(), createdAt: "2026-09-29T10:00:00.000Z" }),
    );
    renderSection();

    const box = await screen.findByLabelText("Add a comment");
    const post = screen.getByRole("button", { name: "Post" }) as HTMLButtonElement;
    expect(post.disabled).toBe(true);
    fireEvent.change(box, { target: { value: "  Works on scans too.  " } });
    expect(post.disabled).toBe(false);
    fireEvent.click(post);

    await waitFor(() => expect(screen.getAllByTestId("comment")).toHaveLength(1));
    expect(addComment).toHaveBeenCalledWith({ buildId: "b1", nodeId: null, body: "  Works on scans too.  " });
    expect(screen.getByTestId("comment-body").textContent).toBe("Works on scans too.");
  });
});
