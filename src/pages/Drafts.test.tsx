// Acceptance cover for the merged drafts list.
//
// The claim under test is the one NS-P25 rests on: a creator with work in both
// tools sees all of it, in one list, ordered by when each was last worked on,
// with every row saying which tool wrote it and opening in that tool. The two
// data sources are stubbed; this is about the merge, the labels and the links.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    isLoggedIn: true,
    loading: false,
    profile: { id: "creator-1", username: "ada", display_name: "Ada" },
  }),
}));

vi.mock("@/contexts/UploadPickerContext", () => ({
  useUploadPicker: () => ({ openUploadTypePicker: vi.fn() }),
}));

vi.mock("@/components/SeoHead", () => ({ SeoHead: () => null }));
vi.mock("@/components/shell/ShellHeader", () => ({ ShellHeader: () => null }));

/** The old path: content_items, then a block-count query. */
const contentRows: unknown[] = [];
vi.mock("@/integrations/supabase/client", () => {
  const chain = (rows: () => unknown[]) => {
    const thenable: Record<string, unknown> = {};
    for (const key of ["select", "eq", "in", "order", "limit", "range"]) {
      thenable[key] = () => thenable;
    }
    thenable.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: rows(), error: null }).then(resolve);
    return thenable;
  };
  return {
    supabase: {
      from: (table: string) =>
        table === "content_items" ? chain(() => contentRows) : chain(() => []),
    },
  };
});

/** The new path. */
const listDraftBuildsByCreator = vi.fn();
vi.mock("@/lib/build/builds", () => ({
  listDraftBuildsByCreator: (...args: unknown[]) => listDraftBuildsByCreator(...args),
}));

import DraftsPage from "@/pages/Drafts";

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DraftsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Drafts — both tools in one list", () => {
  beforeEach(() => {
    navigate.mockReset();
    listDraftBuildsByCreator.mockReset();
    contentRows.length = 0;
  });

  it("merges old-path and new-path drafts, most recently worked on first", async () => {
    contentRows.push(
      { id: "c-old", title: "An older blueprint", post_type: "blueprint", draft_saved_at: "2026-08-01T00:00:00Z", created_at: "2026-08-01T00:00:00Z" },
      { id: "c-new", title: "A recent blog", post_type: "blog", draft_saved_at: "2026-08-20T00:00:00Z", created_at: "2026-08-20T00:00:00Z" },
    );
    listDraftBuildsByCreator.mockResolvedValue([
      { id: "b-1", title: "A build in progress", shape: "agent", completeness: 40, updated_at: "2026-08-10T00:00:00Z", created_at: "2026-08-05T00:00:00Z" },
    ]);

    renderPage();

    await waitFor(() => expect(screen.getByText("A build in progress")).toBeTruthy());

    const titles = screen
      .getAllByText(/An older blueprint|A recent blog|A build in progress/)
      .map((n) => n.textContent);
    expect(titles).toEqual(["A recent blog", "A build in progress", "An older blueprint"]);
  });

  it("labels each row with the tool that wrote it", async () => {
    contentRows.push({ id: "c-1", title: "Old path draft", post_type: "blueprint", draft_saved_at: "2026-08-20T00:00:00Z", created_at: "2026-08-20T00:00:00Z" });
    listDraftBuildsByCreator.mockResolvedValue([
      { id: "b-1", title: "New path draft", shape: "app", completeness: 60, updated_at: "2026-08-19T00:00:00Z", created_at: "2026-08-19T00:00:00Z" },
    ]);

    renderPage();

    await waitFor(() => expect(screen.getByText("Build workspace")).toBeTruthy());
    expect(screen.getByText("Previous tool")).toBeTruthy();
    expect(screen.getByText("60% of this shape's record filled in")).toBeTruthy();
  });

  it("opens each draft in the tool it belongs to", async () => {
    contentRows.push({ id: "c-1", title: "Old path draft", post_type: "blueprint", draft_saved_at: "2026-08-20T00:00:00Z", created_at: "2026-08-20T00:00:00Z" });
    listDraftBuildsByCreator.mockResolvedValue([
      { id: "b-1", title: "New path draft", shape: "app", completeness: 60, updated_at: "2026-08-19T00:00:00Z", created_at: "2026-08-19T00:00:00Z" },
    ]);

    renderPage();
    await waitFor(() => expect(screen.getByText("New path draft")).toBeTruthy());

    const [oldRow, newRow] = screen.getAllByText("Continue editing").map((n) => n.closest("button")!);
    oldRow.click();
    expect(navigate).toHaveBeenCalledWith("/upload/blueprint?draft=c-1");

    newRow.click();
    expect(navigate).toHaveBeenCalledWith("/compose/b-1");
  });
});
