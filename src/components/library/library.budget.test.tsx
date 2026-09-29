// RC-P18 — the Library's budgets, counted in the rendered DOM
// ⟦hicks-law › Enforcing It in the Code⟧.
//
// Exactly two tabs; at most one filled button in any view of either tab
// (STATES.md row 19: an empty view's one way out is primary, a populated view
// has none) ⟦von-restorff-effect⟧; the add-to-collection dialog shows at most
// seven collections before its list scrolls ⟦hicks-law › Budgets⟧; and the
// page and its data layer read nothing legacy. A failing budget means the
// change is wrong, not the test.

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "reader-1" }, profile: { username: "reader" }, isLoggedIn: true }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
    storage: { from: () => ({ createSignedUrl: vi.fn() }) },
  },
}));

const listMySavedBuilds = vi.fn();
vi.mock("@/lib/social", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/social")>()),
  listMySavedBuilds: (...args: unknown[]) => listMySavedBuilds(...args),
  getEngagementCounts: vi.fn(async () => ({})),
  getMyLikes: vi.fn(async () => new Set()),
  getMySaves: vi.fn(async () => new Set()),
}));

const listCollections = vi.fn();
const getCollection = vi.fn();
const listCollectionBuilds = vi.fn();
vi.mock("@/lib/library", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/library")>()),
  listCollections: (...args: unknown[]) => listCollections(...args),
  getCollection: (...args: unknown[]) => getCollection(...args),
  listCollectionBuilds: (...args: unknown[]) => listCollectionBuilds(...args),
}));

import {
  AddToCollectionDialog,
  COLLECTIONS_VISIBLE,
  COLLECTION_ROW_HEIGHT,
} from "@/components/library/AddToCollectionDialog";
import LibraryPage, { LIBRARY_TABS } from "@/pages/Library";
import type { GalleryBuild } from "@/lib/build";

const CARD = {
  id: "build-1",
  creator_id: "maker-1",
  slug: "build-1",
  title: "Saved build",
  outcome: "Does a thing.",
  shape: "other",
  status: "published",
  made_for: [],
  made_with: [],
  live_url: null,
  repo_url: null,
  hero_node_id: null,
  cover_media_id: null,
  completeness: 90,
  reproduction_count: 3,
  last_confirmed_at: null,
  last_confirmed_model: null,
  published_at: "2026-09-01T00:00:00.000Z",
  parent_build_id: null,
  rebuild_count: 0,
  rebuild_note: null,
  source_title_at_fork: null,
  source_handle_at_fork: null,
  nodes: [],
  media: [],
  bounties: [],
} as GalleryBuild;

const COLLECTION = {
  id: "col-1",
  ownerId: "reader-1",
  name: "Invoices",
  isPrivate: true,
  itemCount: 1,
  lastUsedAt: "2026-09-28T10:00:00.000Z",
};

function withProviders(node: ReactElement, path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/library" element={node} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const filled = (root: ParentNode = document) => root.querySelectorAll('[data-visual-slot="btn-primary"]').length;

beforeEach(() => {
  vi.clearAllMocks();
  listMySavedBuilds.mockResolvedValue({ items: [], nextBefore: null });
  listCollections.mockResolvedValue([]);
  getCollection.mockResolvedValue(null);
  listCollectionBuilds.mockResolvedValue({ items: [], nextBefore: null });
});

describe("the Library's budgets", () => {
  it("has exactly two tabs, Saved then Collections", async () => {
    withProviders(<LibraryPage />, "/library");
    expect(LIBRARY_TABS.map((tab) => tab.label)).toEqual(["Saved", "Collections"]);

    const saved = await screen.findByRole("button", { name: "Saved" });
    const row = saved.parentElement as HTMLElement;
    expect([...row.querySelectorAll("button")].map((button) => button.textContent)).toEqual(["Saved", "Collections"]);
  });

  const views: Array<{ name: string; path: string; arrange: () => void; ready: string }> = [
    {
      name: "Saved, with builds",
      path: "/library",
      arrange: () => listMySavedBuilds.mockResolvedValue({ items: [{ savedAt: "2026-09-28T10:00:00.000Z", build: CARD }], nextBefore: "x" }),
      ready: "library-card",
    },
    { name: "Saved, empty", path: "/library", arrange: () => undefined, ready: "library-saved-empty" },
    {
      name: "Collections, listed",
      path: "/library?tab=collections",
      arrange: () => listCollections.mockResolvedValue([COLLECTION]),
      ready: "library-collection",
    },
    { name: "Collections, empty", path: "/library?tab=collections", arrange: () => undefined, ready: "library-collections-empty" },
    {
      name: "a collection, open",
      path: "/library?tab=collections&collection=col-1",
      arrange: () => {
        getCollection.mockResolvedValue(COLLECTION);
        listCollectionBuilds.mockResolvedValue({ items: [{ addedAt: "2026-09-28T10:00:00.000Z", build: CARD }], nextBefore: null });
      },
      ready: "library-card",
    },
    {
      name: "a collection, open and empty",
      path: "/library?tab=collections&collection=col-1",
      arrange: () => getCollection.mockResolvedValue(COLLECTION),
      ready: "library-collection-empty",
    },
  ];

  for (const view of views) {
    it(`shows at most one filled button: ${view.name}`, async () => {
      view.arrange();
      withProviders(<LibraryPage />, view.path);
      await waitFor(() => expect(screen.getAllByTestId(view.ready).length).toBeGreaterThan(0));
      expect(filled()).toBeLessThanOrEqual(1);
    });
  }

  it("shows seven collections at most before the dialog's list scrolls", async () => {
    listCollections.mockResolvedValue(
      Array.from({ length: 9 }, (_, index) => ({ ...COLLECTION, id: `col-${index}`, name: `Collection ${index}` })),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AddToCollectionDialog buildId="build-1" onClose={vi.fn()} />
      </QueryClientProvider>,
    );

    const list = await screen.findByTestId("collection-choices");
    await waitFor(() => expect(screen.getAllByTestId("collection-choice")).toHaveLength(9));
    expect(COLLECTIONS_VISIBLE).toBe(7);
    expect(list.style.maxHeight).toBe(`${COLLECTION_ROW_HEIGHT * COLLECTIONS_VISIBLE}px`);
    expect(list.style.overflowY).toBe("auto");
    for (const row of screen.getAllByTestId("collection-choice")) expect(row.style.height).toBe(`${COLLECTION_ROW_HEIGHT}px`);
    expect(filled(screen.getByTestId("add-to-collection-dialog"))).toBe(0);
  });

  it("reads nothing legacy: no user_saves, curator picks or learning paths", () => {
    const root = resolve(__dirname, "../../..");
    const libraryDir = resolve(root, "src/lib/library");
    const files = [
      resolve(root, "src/pages/Library.tsx"),
      resolve(root, "src/components/library/LibraryBuilds.tsx"),
      resolve(root, "src/components/library/AddToCollectionDialog.tsx"),
      ...readdirSync(libraryDir)
        .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
        .map((name) => resolve(libraryDir, name)),
    ];
    // A read is a .from("<table>") call; a comment naming the table is not one.
    const legacyRead = /\.from\(\s*["'`](user_saves|curators|curator_recommendations|curator_applications|learning_paths|learning_path_steps|learning_path_progress)["'`]/;
    const hits = files.filter((file) => legacyRead.test(readFileSync(file, "utf8")));
    expect(hits).toEqual([]);
  });
});
