// SV-09: the Library page, rendered. (Was RC-P18's src/pages/Library.test.tsx.)
//
// The claims: the saves and the collections are asked for together; the saved builds are the table, newest save first,
// with Show more; the address holds the kind, the item and the open collection; a collection opens in the table with
// its actions (your own only); each empty view is one line and one action; a failed read says so in its panel with
// Retry; and another reader's library is their public collections, with no kinds. The data layer is stubbed at
// src/lib/library and src/lib/social; the page and the view are real.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("@/lib/library/savedItems", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/library/savedItems")>()),
  listSavedItems: (...args: unknown[]) => listSavedItems(...args),
  countSavedItems: (...args: unknown[]) => countSavedItems(...args),
  savedItemsUsedIn: (...args: unknown[]) => savedItemsUsedIn(...args),
  collectionSavedBy: (...args: unknown[]) => collectionSavedBy(...args),
  updateSavedItemNote: (...args: unknown[]) => updateSavedItemNote(...args),
  unsaveItem: (...args: unknown[]) => unsaveItem(...args),
  saveItem: (...args: unknown[]) => saveItem(...args),
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

function kept(n: number, over: Record<string, unknown> = {}) {
  return {
    id: `si-${n}`,
    kind: "step",
    buildId: "build-1",
    ref: `node-${n}`,
    snapshot: { type: "prompt", title: `Kept step ${n}`, payload: { text: "Summarise the call." }, source: { buildId: "build-1", buildTitle: "Call notes", buildSlug: "call-notes", makerId: "maker-1" } },
    sourceVersion: null,
    note: null,
    savedAt: "2026-09-20T10:00:00.000Z",
    lastUsedAt: "2026-09-29T10:00:00.000Z",
    ...over,
  };
}

describe("Library", () => {
  it("asks for the saves and the collections together, before either answers", async () => {
    let answer: (value: unknown) => void = () => undefined;
    listMySavedBuilds.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    renderAt("/library");
    await waitFor(() => expect(listCollections).toHaveBeenCalledWith({ ownerId: undefined }));
    expect(listMySavedBuilds).toHaveBeenCalledTimes(1);
    answer({ items: [], nextBefore: null, total: 0 });
  });

  it("draws the saved builds as the table, newest save first, with the count and Show more", async () => {
    listMySavedBuilds.mockResolvedValue({
      items: [
        { savedAt: "2026-09-29T10:00:00.000Z", build: card(2) },
        { savedAt: "2026-09-28T10:00:00.000Z", build: card(1) },
      ],
      nextBefore: "2026-09-28T10:00:00.000Z",
      total: 18,
    });
    listCollections.mockResolvedValue([collection(2, { name: "Invoices" })]);
    renderAt("/library");

    await waitFor(() => expect(rowTitles()).toEqual(["Saved build 2", "Saved build 1"]));
    expect(screen.getByText("18 saved · 1 collection")).toBeInTheDocument();
    const kinds = within(screen.getByRole("navigation", { name: "Kinds" })).getAllByRole("link");
    expect(kinds.map((link) => link.textContent)).toEqual(["All saved18", "Builds18", "Parts0", "Sessions0", "Steps0", "Requests0", "Filter sets0"]);
    expect(screen.getAllByTestId("library-row")[0]).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    await waitFor(() => expect(listMySavedBuilds).toHaveBeenLastCalledWith({ before: "2026-09-28T10:00:00.000Z" }));
  });

  it("keeps the chosen item in the address and shows it with Open and Copy link", async () => {
    listMySavedBuilds.mockResolvedValue({
      items: [
        { savedAt: "2026-09-29T10:00:00.000Z", build: card(2) },
        { savedAt: "2026-09-28T10:00:00.000Z", build: card(1) },
      ],
      nextBefore: null,
    });
    renderAt("/library?kind=builds");

    fireEvent.click(await screen.findByRole("button", { name: /Saved build 1/ }));
    await waitFor(() => expect(where()).toBe("/library?kind=builds&item=build-1"));
    const panel = screen.getByTestId("library-selected");
    expect(within(panel).getByRole("heading", { name: "Saved build 1" })).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Open" })).toHaveAttribute("href", "/b2/build-1");
    expect(within(panel).getByRole("button", { name: "Copy link" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Add to a collection" })).toBeInTheDocument();
  });

  it("is one line and one action when nothing is saved", async () => {
    renderAt("/library");
    const empty = await screen.findByTestId("library-empty");
    expect(empty.textContent).toContain("Save a build and it waits for you here.");
    expect(within(empty).getByRole("link", { name: "Browse builds" })).toHaveAttribute("href", "/builds");
  });

  it("says Builds didn't load, with Retry, and Retry asks again", async () => {
    listMySavedBuilds.mockRejectedValueOnce(new Error("boom")).mockResolvedValue({ items: [], nextBefore: null });
    renderAt("/library");
    expect(await screen.findByText("Builds didn't load.")).toBeInTheDocument();
    expect(screen.queryByText(/Something went wrong/)).toBeNull();
    expect(report).toHaveBeenCalledWith(expect.any(Error), { source: "query", context: "library-saved" });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByTestId("library-empty")).toBeInTheDocument());
    expect(listMySavedBuilds).toHaveBeenCalledTimes(2);
  });

  it("says Collections didn't load in the collections panel alone", async () => {
    listCollections.mockRejectedValue(new Error("boom"));
    renderAt("/library");
    expect(await screen.findByText("Collections didn't load.")).toBeInTheDocument();
    expect(screen.getByTestId("library-empty")).toBeInTheDocument();
  });

  it("lists collections in the order given, previews the first, and opens one in the table with its actions", async () => {
    listCollections.mockResolvedValue([collection(2, { name: "Invoices" }), collection(1, { name: "Weekend" })]);
    listCollectionBuilds.mockResolvedValue({ items: [{ addedAt: "2026-09-28T10:00:00.000Z", build: card(5) }], nextBefore: null });
    renderAt("/library");

    const rows = await screen.findAllByTestId("library-collection");
    expect(rows.map((row) => row.textContent)).toEqual(["InvoicesPrivate2", "WeekendPrivate1"]);
    const preview = await screen.findByTestId("library-preview");
    expect(within(preview).getByRole("heading", { name: "Invoices" })).toBeInTheDocument();
    await waitFor(() => expect(within(preview).getByText("Saved build 5")).toBeInTheDocument());

    fireEvent.click(rows[0]);
    await waitFor(() => expect(where()).toBe("/library?collection=col-2"));
    await waitFor(() => expect(rowTitles()).toEqual(["Saved build 5"]));
    expect(listCollectionBuilds).toHaveBeenCalledWith("col-2", { before: undefined });
    expect(within(screen.getByTestId("library-collection-open")).getByText("Invoices")).toBeInTheDocument();
    expect(within(screen.getByTestId("library-collection-actions")).getAllByRole("button").map((b) => b.textContent)).toEqual(["Rename", "Make public", "Delete"]);
    expect(screen.getByRole("button", { name: "Remove from Invoices" })).toBeInTheDocument();
  });

  it("says there are no collections in one line, with New in the head", async () => {
    renderAt("/library");
    const empty = await screen.findByTestId("library-collections-empty");
    expect(empty.textContent).toBe("No collections yet.");
    expect(screen.getByRole("button", { name: "New collection" })).toBeInTheDocument();
  });

  it("asks before deleting a collection, in a dialog whose button names the act", async () => {
    listCollections.mockResolvedValue([collection(2)]);
    renderAt("/library?collection=col-2");

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    const dialog = await screen.findByTestId("delete-collection-dialog");
    expect(within(dialog).getByRole("button", { name: "Delete collection" })).toBeTruthy();
  });

  it("lists the kept steps with Used in, the reader's note and a way to take it out", async () => {
    listSavedItems.mockResolvedValue({ items: [kept(1), kept(2, { snapshot: { type: "agent", title: "Clean-up agent", source: {} } })], next: null });
    countSavedItems.mockResolvedValue({ part: 0, session: 0, step: 2, request: 0, filter_set: 0, collection: 0 });
    savedItemsUsedIn.mockResolvedValue(new Map([["si-1", 4]]));
    renderAt("/library?kind=steps");

    await waitFor(() => expect(rowTitles()).toEqual(["Kept step 1", "Clean-up agent"]));
    expect(listSavedItems).toHaveBeenCalledWith({ kind: "step", after: undefined });
    expect(screen.getByRole("columnheader", { name: "Used in" })).toBeInTheDocument();
    const panel = screen.getByTestId("library-selected");
    expect(within(panel).getByText("4 builds")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Open source" })).toHaveAttribute("href", "/b2/call-notes");
    expect(within(panel).queryByRole("button", { name: "Use in a build" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Start a build from this collection" })).toBeNull();

    const note = within(panel).getByLabelText("Your note");
    fireEvent.change(note, { target: { value: "Try on refunds" } });
    fireEvent.blur(note);
    await waitFor(() => expect(updateSavedItemNote).toHaveBeenCalledWith("si-1", "Try on refunds"));

    fireEvent.click(within(panel).getByRole("button", { name: "Remove from Library" }));
    await waitFor(() => expect(unsaveItem).toHaveBeenCalledWith("si-1"));
  });

  it("starts the counts, the kept list and Used in with the saves, before any answers", async () => {
    renderAt("/library?kind=sessions");
    await waitFor(() => expect(listSavedItems).toHaveBeenCalledWith({ kind: "session", after: undefined }));
    expect(countSavedItems).toHaveBeenCalledTimes(1);
    expect(savedItemsUsedIn).toHaveBeenCalledTimes(1);
    expect(listMySavedBuilds).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Nothing kept here yet.")).toBeInTheDocument();
  });

  it("lists the saved builds and the kept items together, newest first, under All saved", async () => {
    listMySavedBuilds.mockResolvedValue({ items: [{ savedAt: "2026-09-28T10:00:00.000Z", build: card(1) }], nextBefore: null, total: 1 });
    listSavedItems.mockResolvedValue({ items: [kept(1, { lastUsedAt: "2026-09-29T10:00:00.000Z" })], next: null });
    countSavedItems.mockResolvedValue({ part: 0, session: 0, step: 1, request: 0, filter_set: 0, collection: 0 });
    renderAt("/library");
    await waitFor(() => expect(rowTitles()).toEqual(["Kept step 1", "Saved build 1"]));
    expect(screen.getByText("2 saved · 0 collections")).toBeInTheDocument();
  });

  it("says saved by n on a public collection, and lets another reader save it", async () => {
    getCollection.mockResolvedValue(collection(2, { ownerId: "maker-9", isPrivate: false }));
    listCollectionBuilds.mockResolvedValue({ items: [], nextBefore: null });
    collectionSavedBy.mockResolvedValue(new Map([["col-2", 14]]));
    renderAt("/library?collection=col-2");

    expect(await screen.findByText(/saved by 14 people/)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Save collection" }));
    await waitFor(() => expect(saveItem).toHaveBeenCalledWith({ kind: "collection", ref: "col-2", snapshot: { name: "Collection 2" } }));
  });

  it("offers no Rename, Make public, Delete or Remove on somebody else's collection", async () => {
    getCollection.mockResolvedValue(collection(2, { ownerId: "maker-9", isPrivate: false }));
    listCollectionBuilds.mockResolvedValue({ items: [{ addedAt: "2026-09-28T10:00:00.000Z", build: card(5) }], nextBefore: null });
    renderAt("/library?collection=col-2");

    await waitFor(() => expect(within(screen.getByTestId("library-collection-open")).getByText("Collection 2")).toBeInTheDocument());
    for (const name of ["Rename", "Make public", "Make private", "Delete"]) expect(screen.queryByRole("button", { name })).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove from/ })).toBeNull();
  });

  it("shows another reader's library as their public collections, the first open, with no kinds", async () => {
    getLibraryOwner.mockResolvedValue({ id: "maker-9", username: "maya", displayName: "Maya Okafor" });
    listCollections.mockResolvedValue([collection(1, { ownerId: "maker-9", isPrivate: false })]);
    listCollectionBuilds.mockResolvedValue({ items: [{ addedAt: "2026-09-28T10:00:00.000Z", build: card(5) }], nextBefore: null });
    renderAt("/library/maya");

    expect(await screen.findByText("Maya Okafor's library")).toBeTruthy();
    await waitFor(() => expect(listCollections).toHaveBeenCalledWith({ ownerId: "maker-9" }));
    await waitFor(() => expect(rowTitles()).toEqual(["Saved build 5"]));
    expect(screen.queryByRole("navigation", { name: "Kinds" })).toBeNull();
    expect(listMySavedBuilds).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "New collection" })).toBeNull();
    for (const name of ["Rename", "Make public", "Make private", "Delete"]) expect(screen.queryByRole("button", { name })).toBeNull();
  });
});
