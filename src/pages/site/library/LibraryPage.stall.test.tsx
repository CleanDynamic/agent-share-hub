// D4: the Library with a read that never answers. After the stall time the page draws instead of its loading view, and the
// panel says what did not load, with Retry; Retry brings the skeleton back while it asks again. The data layer is stubbed as
// in LibraryPage.test.tsx (the set-up below is that file's), and the stall time is shortened so the test does not wait 10 s.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/shell/useStalled", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/shell/useStalled")>();
  return { ...actual, useStalled: (waiting: boolean) => actual.useStalled(waiting, 300) };
});
const report = vi.hoisted(() => vi.fn());
vi.mock("@/lib/errors/report", () => ({ reportError: report }));

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

const listSavedItems = vi.fn();
const countSavedItems = vi.fn();
const savedItemsUsedIn = vi.fn();
const collectionSavedBy = vi.fn();
const updateSavedItemNote = vi.fn();
const unsaveItem = vi.fn();
const saveItem = vi.fn();
const collectionSavedItemIds = vi.fn();
const savedItemsByIds = vi.fn();
const startBuildFromItems = vi.fn();
vi.mock("@/lib/build/startFromCollection", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/build/startFromCollection")>()), startBuildFromItems: (...args: unknown[]) => startBuildFromItems(...args) }));
vi.mock("@/lib/library/savedItems", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/library/savedItems")>()),
  listSavedItems: (...args: unknown[]) => listSavedItems(...args),
  countSavedItems: (...args: unknown[]) => countSavedItems(...args),
  savedItemsUses: (...args: unknown[]) => savedItemsUsedIn(...args),
  collectionSavedBy: (...args: unknown[]) => collectionSavedBy(...args),
  updateSavedItemNote: (...args: unknown[]) => updateSavedItemNote(...args),
  unsaveItem: (...args: unknown[]) => unsaveItem(...args),
  saveItem: (...args: unknown[]) => saveItem(...args),
  collectionSavedItemIds: (...args: unknown[]) => collectionSavedItemIds(...args),
  savedItemsByIds: (...args: unknown[]) => savedItemsByIds(...args),
}));

import LibraryPage from "./LibraryPage";
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

const rowTitles = () => screen.getAllByTestId("library-row").map((row) => within(row).getByRole("button").firstChild?.textContent);
const where = () => screen.getByTestId("where").textContent;

beforeEach(() => {
  vi.clearAllMocks();
  // A desktop: the three columns, the kinds as rows.
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  auth.user = { id: "reader-1" };
  auth.profile = { username: "reader" };
  listMySavedBuilds.mockResolvedValue({ items: [], nextBefore: null });
  listCollections.mockResolvedValue([]);
  getCollection.mockResolvedValue(null);
  listCollectionBuilds.mockResolvedValue({ items: [], nextBefore: null });
  getLibraryOwner.mockResolvedValue(null);
  listSavedItems.mockResolvedValue({ items: [], next: null });
  countSavedItems.mockResolvedValue({ part: 0, session: 0, step: 0, request: 0, filter_set: 0, collection: 0 });
  savedItemsUsedIn.mockResolvedValue(new Map());
  collectionSavedBy.mockResolvedValue(new Map());
  updateSavedItemNote.mockResolvedValue(undefined);
  unsaveItem.mockResolvedValue(undefined);
  saveItem.mockResolvedValue(undefined);
});

describe("D4 · the Library when a read never answers", () => {
  it("says Builds didn't load, with Retry, instead of staying on its skeleton; Retry asks again", async () => {
    listMySavedBuilds.mockReturnValue(new Promise(() => undefined));
    renderAt("/library");
    expect(await screen.findByText("Builds didn't load.", undefined, { timeout: 3_000 })).toBeInTheDocument();
    expect(screen.queryByTestId("library-loading")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(listMySavedBuilds).toHaveBeenCalledTimes(2));
  });
});
