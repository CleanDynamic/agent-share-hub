// UX-06 Part 2: the reply box. Someone else's work cannot be attached and Mention instead puts their handle in the box; the reply is
// in the thread at once; a refusal from the authorship rule shows its words unchanged and keeps the content; a reply about a step
// says so and saves the step.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PostThread } from "@/lib/openbuilds/types";

const createReply = vi.fn();
const listAttachableWork = vi.fn();

vi.mock("@/lib/openbuilds", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/openbuilds")>()),
  createReply: (input: unknown) => createReply(input),
  resolveMentionIds: async () => [],
  listAttachableWork: (options: unknown) => listAttachableWork(options),
  labelAttachable: async (works: { title: string; buildTitle: string; origin: string }[]) =>
    works.map((work) => ({ ...work, label: work.origin === "others" ? `@kit · ${work.title}` : work.title, context: work.buildTitle, handle: work.origin === "others" ? "kit" : null })),
  readNamedWork: async () => ({ builds: new Map(), nodes: new Map() }),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" }, profile: { username: "me", display_name: "Me", avatar_url: null }, loading: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/errors/report", () => ({ reportError: vi.fn() }));

import { PostError } from "@/lib/openbuilds";

import { entry } from "./postModel.fixtures";
import { postPageKey } from "./postModel";
import { ReplyBox } from "./ReplyBox";

const work = (origin: string, title: string) => ({ size: "build", origin, buildId: `b-${title}`, buildTitle: "Resume screener", nodeId: null, partKey: null, sessionKey: null, title, makerId: origin === "others" ? "kit" : "me" });

let client: QueryClient;

function draw(extra: Partial<Parameters<typeof ReplyBox>[0]> = {}) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(postPageKey("p1"), entry("p1", 100, { parentId: null, replies: [] }));
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ReplyBox pageId="p1" rootId="p1" parentId="p1" about={null} onRemoveAbout={vi.fn()} signInTo="/login" {...extra} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const box = () => screen.getByPlaceholderText("Reply with words, work, or both") as HTMLTextAreaElement;

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  createReply.mockReset().mockResolvedValue("r-new");
  listAttachableWork.mockReset().mockResolvedValue([work("draft", "Scorer draft"), work("others", "Cover letter checker")]);
});

describe("the reply box", () => {
  it("cannot attach someone else's work, and Mention instead puts their @handle in the box", async () => {
    draw();
    fireEvent.change(box(), { target: { value: "Try this" } });
    fireEvent.click(screen.getByRole("button", { name: "Attach work" }));
    const others = await screen.findByRole("region", { name: "Other people's" });
    fireEvent.click(within(others).getByText("@kit · Cover letter checker"));
    // Nothing was attached: the picker is still open on the same row.
    expect(screen.queryByRole("button", { name: "Remove the attachment" })).toBeNull();
    fireEvent.click(within(others).getByRole("button", { name: "Mention @kit instead" }));
    expect(box().value).toBe("Try this @kit ");
  });

  it("puts the reply in the thread at once, then asks the database", async () => {
    let answer: (value: string) => void = () => undefined;
    createReply.mockReturnValue(new Promise<string>((resolve) => (answer = resolve)));
    draw();
    fireEvent.change(box(), { target: { value: "Same here, it halves the time." } });
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    await waitFor(() => expect((client.getQueryData(postPageKey("p1")) as PostThread).replies.map((reply) => reply.body)).toEqual(["Same here, it halves the time."]));
    expect(box().value).toBe("");
    answer("r-new");
    await waitFor(() => expect(createReply).toHaveBeenCalledWith(expect.objectContaining({ parentId: "p1", body: "Same here, it halves the time." })));
  });

  it("shows the authorship rule's words unchanged under the box, keeps the content, and takes the reply back out", async () => {
    createReply.mockRejectedValue(new PostError("createReply", "A reply can attach only your own work.", "P0001", 400));
    draw();
    fireEvent.change(box(), { target: { value: "Look at this one" } });
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A reply can attach only your own work.");
    expect(box().value).toBe("Look at this one");
    expect((client.getQueryData(postPageKey("p1")) as PostThread).replies).toHaveLength(0);
  });

  it("says a reply is about a step, with Remove, and saves the step", async () => {
    const onRemoveAbout = vi.fn();
    draw({ about: { buildId: "b-post", nodeId: "n4", label: "Step 4 · Prompt" }, onRemoveAbout });
    expect(screen.getByText("On Step 4 · Prompt")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove Step 4 · Prompt" }));
    expect(onRemoveAbout).toHaveBeenCalled();
    fireEvent.change(box(), { target: { value: "Prompt 4 needs the rubric" } });
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    await waitFor(() => expect(createReply).toHaveBeenCalledWith(expect.objectContaining({ aboutNodeId: "n4", aboutBuildId: "b-post" })));
  });

  it("asks for words or work before sending", () => {
    draw();
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Write something or attach work.");
    expect(createReply).not.toHaveBeenCalled();
  });
});
