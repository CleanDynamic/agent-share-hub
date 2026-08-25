import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* ────────────────────────────────────────────────
   /drafts carries two tools' work in one list.

   What matters is that neither path's drafts go missing, that the list
   is ordered by when each was last saved regardless of which table it
   came from, and that each entry opens in the tool that owns it.
──────────────────────────────────────────────── */

const navigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isLoggedIn: true, profile: { id: "user-1" }, loading: false }),
}));
vi.mock("@/contexts/UploadPickerContext", () => ({
  useUploadPicker: () => ({ openUploadTypePicker: vi.fn() }),
}));
vi.mock("@/components/SeoHead", () => ({ SeoHead: () => null }));
vi.mock("@/components/shell/ShellHeader", () => ({ ShellHeader: () => null }));

/* content_items: one blueprint draft, saved a while back. */
const postRows = [
  {
    id: "post-1",
    title: "An older post draft",
    draft_name: "An older post draft",
    content_type: "agent",
    post_type: "blueprint",
    difficulty: "beginner",
    ai_tools: ["claude"],
    draft_saved_at: "2026-08-01T10:00:00.000Z",
    created_at: "2026-08-01T09:00:00.000Z",
  },
];

vi.mock("@/integrations/supabase/client", () => {
  const blocks = { select: () => ({ in: async () => ({ data: [{ content_id: "post-1" }] }) }) };
  const items = {
    select: () => ({
      eq: () => ({
        eq: () => ({ order: async () => ({ data: postRows, error: null }) }),
      }),
    }),
  };
  return {
    supabase: {
      from: (table: string) => (table === "content_blocks" ? blocks : items),
    },
  };
});

/* builds: one build draft, saved more recently than the post. */
const listBuildsByCreator = vi.fn(async () => [
  {
    id: "build-1",
    slug: "inbox-triage-agent-k3f9x1",
    title: "A newer build draft",
    shape: "app",
    status: "draft",
    completeness: 40,
    updated_at: "2026-08-20T10:00:00.000Z",
    created_at: "2026-08-19T10:00:00.000Z",
  },
]);
const deleteBuild = vi.fn();
vi.mock("@/lib/build", () => ({
  listBuildsByCreator: (...args: unknown[]) => listBuildsByCreator(...(args as [])),
  deleteBuild: (...args: unknown[]) => deleteBuild(...(args as [])),
}));

import DraftsPage from "./Drafts";

function renderDrafts() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/drafts"]}>
        <DraftsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DraftsPage", () => {
  beforeEach(() => {
    navigate.mockClear();
    listBuildsByCreator.mockClear();
  });

  it("shows drafts from both paths", async () => {
    renderDrafts();
    expect(await screen.findByText("A newer build draft")).toBeInTheDocument();
    expect(await screen.findByText("An older post draft")).toBeInTheDocument();
  });

  it("labels each entry with the tool it belongs to", async () => {
    renderDrafts();
    expect(await screen.findByText("Build workspace")).toBeInTheDocument();
    expect(await screen.findByText("Post editor")).toBeInTheDocument();
  });

  it("asks only for draft builds, by the signed-in creator", async () => {
    renderDrafts();
    await screen.findByText("A newer build draft");
    expect(listBuildsByCreator).toHaveBeenCalledWith("user-1", { status: "draft" });
  });

  it("sorts the two sources together by last saved, newest first", async () => {
    renderDrafts();
    await screen.findByText("An older post draft");
    const titles = screen.getAllByText(/draft$/).map((n) => n.textContent);
    expect(titles).toEqual(["A newer build draft", "An older post draft"]);
  });

  it("opens each draft in the tool that owns it", async () => {
    renderDrafts();
    await screen.findByText("A newer build draft");

    const build = within(screen.getByTestId("draft-build:build-1"));
    build.getByRole("button", { name: /continue editing/i }).click();
    expect(navigate).toHaveBeenCalledWith("/compose/build-1");

    const post = within(screen.getByTestId("draft-post:post-1"));
    post.getByRole("button", { name: /continue editing/i }).click();
    expect(navigate).toHaveBeenCalledWith("/upload/blueprint?draft=post-1");
  });

  it("previews a build at its reader route and a post at its own", async () => {
    renderDrafts();
    await screen.findByText("A newer build draft");

    within(screen.getByTestId("draft-build:build-1"))
      .getByRole("button", { name: /preview/i })
      .click();
    expect(navigate).toHaveBeenCalledWith("/b2/inbox-triage-agent-k3f9x1");

    within(screen.getByTestId("draft-post:post-1"))
      .getByRole("button", { name: /preview/i })
      .click();
    expect(navigate).toHaveBeenCalledWith("/content/post-1");
  });
});
