// RC-P18 — the Library, rendered.
//
// The claims: it opens on Saved, whose builds are the gallery's own cards,
// newest save first, with a secondary "Show more"; Collections lists the
// reader's collections in the order the data layer gives (the one used last
// first) and opens one as cards; each empty view is one sentence and one
// action; and another reader's library is their public collections, with no
// tabs. The data layer is stubbed at src/lib/library and src/lib/social; the
// page and the cards are real.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  user: { id: "reader-1" } as { id: string } | null,
  profile: { username: "reader" } as { username: string } | null,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: auth.user, profile: auth.profile, isLoggedIn: auth.user !== null }),
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
const getLibraryOwner = vi.fn();
vi.mock("@/lib/library", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/library")>()),
  listCollections: (...args: unknown[]) => listCollections(...args),
  getCollection: (...args: unknown[]) => getCollection(...args),
  listCollectionBuilds: (...args: unknown[]) => listCollectionBuilds(...args),
  getLibraryOwner: (...args: unknown[]) => getLibraryOwner(...args),
}));

import LibraryPage from "@/pages/Library";
import type { GalleryBuild } from "@/lib/build";
import type { BuildCollection } from "@/lib/library";

function card(n: number): GalleryBuild {
  return {
    id: `build-${n}`,
    creator_id: "maker-1",
    slug: `build-${n}`,
    title: `Saved build ${n}`,
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
  };
}

function collection(n: number, over: Partial<BuildCollection> = {}): BuildCollection {
  return {
    id: `col-${n}`,
    ownerId: "reader-1",
    name: `Collection ${n}`,
    isPrivate: true,
    itemCount: n,
    lastUsedAt: "2026-09-28T10:00:00.000Z",
    ...over,
  };
}

function Where() {
  const location = useLocation();
  return <span data-testid="where">{`${location.pathname}${location.search}`}</span>;
}

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Where />
        <Routes>
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/library/:handle" element={<LibraryPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const cardTitles = () =>
  screen.getAllByTestId("library-card").map((item) => within(item).getByRole("heading").textContent);

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: "reader-1" };
  auth.profile = { username: "reader" };
  listMySavedBuilds.mockResolvedValue({ items: [], nextBefore: null });
  listCollections.mockResolvedValue([]);
  getCollection.mockResolvedValue(null);
  listCollectionBuilds.mockResolvedValue({ items: [], nextBefore: null });
  getLibraryOwner.mockResolvedValue(null);
});

describe("Library", () => {
  it("opens on Saved: the gallery's cards, newest save first, then a secondary Show more", async () => {
    listMySavedBuilds.mockResolvedValue({
      items: [
        { savedAt: "2026-09-29T10:00:00.000Z", build: card(2) },
        { savedAt: "2026-09-28T10:00:00.000Z", build: card(1) },
      ],
      nextBefore: "2026-09-28T10:00:00.000Z",
    });
    renderAt("/library");

    await waitFor(() => expect(screen.getAllByTestId("library-card")).toHaveLength(2));
    expect(cardTitles()).toEqual(["Saved build 2", "Saved build 1"]);
    expect(screen.getAllByTestId("library-card")[0].querySelector('[data-visual-slot="gallery-card"]')).not.toBeNull();

    const more = screen.getByRole("button", { name: "Show more" });
    expect(more.getAttribute("data-visual-slot")).toBe("btn-secondary");
    fireEvent.click(more);
    await waitFor(() => expect(listMySavedBuilds).toHaveBeenLastCalledWith({ before: "2026-09-28T10:00:00.000Z" }));
  });

  it("says so when nothing is saved, with Browse the gallery as its one action", async () => {
    renderAt("/library");
    const empty = await screen.findByTestId("library-saved-empty");
    expect(empty.textContent).toContain("Save a build and it waits for you here.");
    expect(within(empty).getByRole("link", { name: "Browse the gallery" }).getAttribute("href")).toBe("/gallery");
  });

  it("lists collections in the order given, the one used last first, and opens one as cards", async () => {
    listCollections.mockResolvedValue([collection(2, { name: "Invoices" }), collection(1, { name: "Weekend" })]);
    getCollection.mockResolvedValue(collection(2, { name: "Invoices" }));
    listCollectionBuilds.mockResolvedValue({ items: [{ addedAt: "2026-09-28T10:00:00.000Z", build: card(5) }], nextBefore: null });
    renderAt("/library?tab=collections");

    const rows = await screen.findAllByTestId("library-collection");
    expect(rows.map((row) => row.textContent?.split("2 builds")[0].split("1 build")[0])).toEqual(["Invoices", "Weekend"]);
    expect(listCollections).toHaveBeenCalledWith({ ownerId: undefined });

    fireEvent.click(rows[0]);
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/library?tab=collections&collection=col-2"));
    await waitFor(() => expect(cardTitles()).toEqual(["Saved build 5"]));
    expect(listCollectionBuilds).toHaveBeenCalledWith("col-2", { before: undefined });
    expect(screen.getByRole("heading", { name: "Invoices" })).toBeTruthy();
    expect(within(screen.getByTestId("library-collection-actions")).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Rename",
      "Make public",
      "Delete",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "All collections" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/library?tab=collections"));
  });

  it("says so when there are no collections, with New collection as its one action", async () => {
    renderAt("/library?tab=collections");
    const empty = await screen.findByTestId("library-collections-empty");
    expect(empty.textContent).toContain("Group builds you want to keep together.");
    expect(within(empty).getByRole("button", { name: "New collection" })).toBeTruthy();
  });

  it("asks before deleting a collection, in a dialog whose button names the act", async () => {
    getCollection.mockResolvedValue(collection(2));
    renderAt("/library?tab=collections&collection=col-2");

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    const dialog = await screen.findByTestId("delete-collection-dialog");
    expect(within(dialog).getByRole("button", { name: "Delete collection" })).toBeTruthy();
  });

  it("offers no Rename, Make public or Delete on somebody else's collection", async () => {
    getCollection.mockResolvedValue(collection(2, { ownerId: "maker-9", isPrivate: false }));
    renderAt("/library?tab=collections&collection=col-2");

    expect(await screen.findByRole("heading", { name: "Collection 2" })).toBeTruthy();
    expect(screen.queryByTestId("library-collection-actions")).toBeNull();
  });

  it("shows another reader's library as their public collections, with no tabs", async () => {
    getLibraryOwner.mockResolvedValue({ id: "maker-9", username: "maya", displayName: "Maya Okafor" });
    listCollections.mockResolvedValue([collection(1, { ownerId: "maker-9", isPrivate: false })]);
    renderAt("/library/maya");

    expect(await screen.findByText("Maya Okafor's collections")).toBeTruthy();
    await waitFor(() => expect(listCollections).toHaveBeenCalledWith({ ownerId: "maker-9" }));
    expect(screen.queryByRole("button", { name: "Saved" })).toBeNull();
    expect(listMySavedBuilds).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "New collection" })).toBeNull();
  });
});
