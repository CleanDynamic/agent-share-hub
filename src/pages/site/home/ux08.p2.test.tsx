// UX-08 P2: a failed run becomes a topic. The window opens prefilled and nothing is written until the person presses Post.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createPost = vi.hoisted(() => vi.fn(async () => "new-topic"));
vi.mock("@/lib/openbuilds", async (original) => ({
  ...(await original<typeof import("@/lib/openbuilds")>()),
  createPost,
  listPostableSpaces: async () => [],
  readNamedWork: async () => ({ builds: new Map(), nodes: new Map() }),
  resolveMentionIds: async () => [],
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" }, profile: { username: "maker", display_name: "Maker", avatar_url: null } }) }));

import { NewPostWindow } from "../openbuilds/NewPostWindow";
import { failedRunDraft, failedRunLine } from "./runTopic";

beforeEach(() =>
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined })),
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  createPost.mockClear();
});

describe("UX-08 P2 · failedRunDraft", () => {
  it("attaches the build, writes the line and leaves an empty line, with no space", () => {
    const draft = failedRunDraft({ buildId: "b1", model: "opus-5.5" });
    expect(draft.body).toBe("Didn't work for me on Opus 5.5.\n\n");
    expect(draft.attachments.map((entry) => entry.input)).toEqual([{ kind: "build", buildId: "b1" }]);
    expect(draft.spaceIds).toEqual([]);
    // A run records no step, so no step is marked still open.
    expect(draft.stillOpen).toBe(false);
    expect(draft.openNodeId).toBeNull();
  });

  it("with a known step: the step in the words, marked still open, about that step", () => {
    const draft = failedRunDraft({ buildId: "b1", model: "opus-5.5", step: { number: "3", nodeId: "n3" } });
    expect(draft.body).toBe("Didn't work for me at Step 3 on Opus 5.5.\n\n");
    expect(draft.stillOpen).toBe(true);
    expect(draft.openNodeId).toBe("n3");
    expect(draft.added).toEqual(["open"]);
  });

  it("leaves out what is not known", () => {
    expect(failedRunLine({ model: null })).toBe("Didn't work for me.");
    expect(failedRunLine({ model: "  ", step: { number: "2", nodeId: "n" } })).toBe("Didn't work for me at Step 2.");
  });
});

describe("UX-08 P2 · the window opens with the attachment and the body, and writes nothing until Post", () => {
  it("shows the body, and sends the build, the step and no space only when Post is pressed", async () => {
    const draft = failedRunDraft({ buildId: "b1", model: "opus-5.5", step: { number: "3", nodeId: "n3" } });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <NewPostWindow draft={draft} onClose={() => undefined} onReopen={() => undefined} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const box = (await screen.findByRole("textbox")) as HTMLTextAreaElement;
    expect(box.value).toBe("Didn't work for me at Step 3 on Opus 5.5.\n\n");
    expect(createPost).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    expect(createPost).toHaveBeenCalledWith(
      expect.objectContaining({ spaceIds: [], aboutNodeId: "n3", stillOpen: true, attachments: [{ kind: "build", buildId: "b1" }] }),
    );
  });
});
