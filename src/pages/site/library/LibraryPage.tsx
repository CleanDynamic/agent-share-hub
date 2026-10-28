/* SV-09: /library and /library/:handle, the container.

   Loads through `src/lib/social` and `src/lib/library` only, maps the results to `LibraryView`'s props, and runs the
   collection writes. The reader's own Library is their saved builds (build_saves, one request with the count) and their
   collections, both started at once; a collection, open or previewed, is its builds (`listCollectionBuilds`). Another
   reader's library is their public collections only, read only: their saves are theirs alone.

   WHERE THE READER IS lives in the address (`libraryModel.readAddress`): the kind, the tab, the selected item and the open
   collection. Choosing any of them changes the address; the old content stays until the new arrives, with no fade.

   SV-17: the Parts, Sessions, Steps, Requests and Filter sets kinds are live (saved_items), with Used in, notes and the
   saved-by count on a public collection. All saved lists the builds and the kept items together, newest first.

   NOT LIVE YET (drawn on the dev page only): Start a build from a collection and Use in a build (SV-18); the version switch
   and Edited (SV-19); the changes list for kept items (SV-15 is live for saved builds: runs, rebuilds, answers and out-of-date);
   In collections (SV-25); the Filters and Sort controls (SV-24). */

import { useEffect, useState } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { SeoHead } from "@/components/SeoHead";
import { DeleteCollectionDialog, NameCollectionDialog, refusalText } from "@/components/library/CollectionDialogs";
import {
  LIBRARY_COLLECTIONS_KEY,
  LIBRARY_COLLECTION_BUILDS_KEY,
  LIBRARY_COLLECTION_KEY,
  LIBRARY_SAVED_KEY,
  requestAddToCollection,
} from "@/components/library/addToCollection";
import { PageArrival } from "@/components/shell/PageArrival";
import { useAuth } from "@/contexts/AuthContext";
import { copyToClipboard } from "@/lib/deepLink";
import { reportError } from "@/lib/errors/report";
import {
  deleteBuildCollection,
  getCollection,
  getLibraryOwner,
  listCollectionBuilds,
  listCollections,
  removeBuildFromCollection,
  updateCollection,
  type BuildCollection,
} from "@/lib/library";
import { modelLabel } from "@/lib/models/registry";
import { usePageReady } from "@/lib/routing/pageReady";
import {
  collectionSavedBy,
  countSavedItems,
  listSavedItems,
  saveItem,
  savedItemsUsedIn,
  unsaveItem,
  updateSavedItemNote,
  type LibrarySavedItem,
} from "@/lib/library/savedItems";
import type { GalleryBuild } from "@/lib/build/gallery";
import { listMySavedBuilds } from "@/lib/social";
import { isStale } from "@/lib/build/signals";
import { listActivityFor } from "@/lib/feed/activity";

import { LibraryLoadingView } from "./LibraryFrame";
import { LibraryView, type LibraryPreviewProps, type LibrarySelected, type PanelStatus } from "./LibraryView";
import {
  CHANGES_WINDOW_DAYS,
  LIBRARY_KINDS,
  LIVE_KINDS,
  addressSearch,
  ageWords,
  changesFigure,
  countWords,
  itemCopyText,
  itemDetail,
  itemTitle,
  itemType,
  kindTabs,
  libraryChanges,
  privacyWord,
  readAddress,
  readsSavedItems,
  savedBuildRow,
  savedByWords,
  savedItemRow,
  savedKindOf,
  type LibraryAddress,
  type LibraryKind,
} from "./libraryModel";

/** One line of the table: a saved build, or a kept item. */
interface Shown {
  id: string;
  /** When it was saved (a build) or last used (an item): the newest first. */
  at: string;
  build?: GalleryBuild;
  item?: LibrarySavedItem;
}

const ITEM_COLUMN: Record<LibraryKind, string> = { all: "Item", builds: "Build", parts: "Part", sessions: "Session", steps: "Step", requests: "Request", "filter-sets": "Filter set" };
const COUNTED_KINDS = new Set(["part", "step", "session"]);

const statusOf = (query: { isLoading: boolean; isError: boolean }): PanelStatus => (query.isLoading ? "loading" : query.isError ? "error" : "ready");

/** A failed read is told about once, by its panel's name (never its content). */
function useReported(error: unknown, context: string) {
  useEffect(() => {
    if (error) reportError(error, { source: "query", context });
  }, [error, context]);
}

export default function LibraryPage() {
  const qc = useQueryClient();
  const { handle } = useParams<{ handle?: string }>();
  const [params, setParams] = useSearchParams();
  const { user, profile } = useAuth();
  const now = Date.now();

  const address = readAddress(params);
  const viewerId = user?.id ?? null;
  const ownHandle = (profile as { username?: string | null } | null)?.username ?? null;
  const visiting = Boolean(handle) && handle !== ownHandle;
  const base = visiting ? `/library/${handle}` : "/library";
  const hrefFor = (next: Partial<LibraryAddress>) => {
    const search = addressSearch(params, next).toString();
    return search ? `${base}?${search}` : base;
  };
  const move = (next: Partial<LibraryAddress>, replace = false) => setParams(addressSearch(params, next), { replace });

  /* ── reads: the saves and the collections start together ── */

  const owner = useQuery({
    queryKey: ["library-owner", handle],
    queryFn: () => getLibraryOwner(handle as string),
    enabled: visiting,
    refetchOnWindowFocus: false,
  });
  const ownerId = visiting ? owner.data?.id : undefined;

  const saved = useInfiniteQuery({
    queryKey: [LIBRARY_SAVED_KEY],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listMySavedBuilds({ before: pageParam }),
    getNextPageParam: (last) => last.nextBefore ?? undefined,
    enabled: !visiting && viewerId !== null,
    refetchOnWindowFocus: false,
  });
  const collections = useQuery({
    queryKey: [LIBRARY_COLLECTIONS_KEY, visiting ? ownerId : "mine"],
    queryFn: () => listCollections({ ownerId }),
    enabled: visiting ? Boolean(ownerId) : viewerId !== null,
    refetchOnWindowFocus: false,
  });
  const list = collections.data ?? [];

  /* The kept items (SV-17): their counts, the kind's list and Used in, all independent of the saves, so they start with them. */
  const kind = address.kind;
  const itemKind = savedKindOf(kind);
  const mine = !visiting && viewerId !== null;
  const wantsItems = mine && readsSavedItems(kind) && address.collection === null;
  const counts = useQuery({
    queryKey: ["library", "countSavedItems", viewerId],
    queryFn: countSavedItems,
    enabled: mine,
    refetchOnWindowFocus: false,
  });
  const kept = useInfiniteQuery({
    queryKey: ["library", "listSavedItems", itemKind ?? "all"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listSavedItems({ kind: itemKind ?? undefined, after: pageParam }),
    getNextPageParam: (last) => last.next ?? undefined,
    enabled: wantsItems,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
  const usedIn = useQuery({
    queryKey: ["library", "savedItemsUsedIn", viewerId],
    queryFn: savedItemsUsedIn,
    enabled: wantsItems && (itemKind === null || COUNTED_KINDS.has(itemKind)),
    refetchOnWindowFocus: false,
  });

  /* The open collection: the address's, or a visitor's first. One the list doesn't hold (a shared link) is read alone. */
  const openId = address.collection ?? (visiting ? (list[0]?.id ?? null) : null);
  const listed = list.find((item) => item.id === openId) ?? null;
  const alone = useQuery({
    queryKey: [LIBRARY_COLLECTION_KEY, openId],
    queryFn: () => getCollection(openId as string),
    enabled: openId !== null && !listed && !collections.isLoading,
    refetchOnWindowFocus: false,
  });
  const open: BuildCollection | null = listed ?? alone.data ?? null;
  const own = open !== null && viewerId !== null && open.ownerId === viewerId;

  /* Saved by n: for the public collections shown, once the list is in (it needs their ids). */
  const publicIds = [...list.filter((item) => !item.isPrivate).map((item) => item.id), ...(open && !open.isPrivate ? [open.id] : [])];
  const savedBy = useQuery({
    queryKey: ["library", "collectionSavedBy", [...new Set(publicIds)].sort()],
    queryFn: () => collectionSavedBy(publicIds),
    enabled: publicIds.length > 0,
    refetchOnWindowFocus: false,
  });
  /* Whether the reader has kept the open collection of somebody else's. */
  const keptCollections = useQuery({
    queryKey: ["library", "listSavedItems", "collection"],
    queryFn: () => listSavedItems({ kind: "collection", limit: 100 }),
    enabled: viewerId !== null && open !== null && !own && !open.isPrivate,
    refetchOnWindowFocus: false,
  });
  const keptCollection = keptCollections.data?.items.find((item) => item.ref === open?.id) ?? null;

  /* A collection's builds: the open one's in the table, or the first one's in the preview. */
  const shownId = openId ?? list[0]?.id ?? null;
  const collectionBuilds = useInfiniteQuery({
    queryKey: [LIBRARY_COLLECTION_BUILDS_KEY, shownId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listCollectionBuilds(shownId as string, { before: pageParam }),
    getNextPageParam: (last) => last.nextBefore ?? undefined,
    enabled: shownId !== null,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

  const loading = visiting ? owner.isLoading || collections.isLoading : openId ? collectionBuilds.isLoading : saved.isLoading;
  const firstScreen = !loading && !collections.isLoading;

  /* The changes on the saved builds: the same events Home reads, saved builds only. Started once the first screen is up:
     its three hops would otherwise sit inside the page's one round and over SV-03's request budget. */
  const sinceMs = Math.floor((now - CHANGES_WINDOW_DAYS * 86_400_000) / 3_600_000) * 3_600_000;
  const activity = useQuery({
    queryKey: ["feed", "listActivityFor", viewerId, sinceMs, "saved"],
    queryFn: () => listActivityFor({ userId: viewerId as string, since: sinceMs, limit: 50, savedOnly: true }),
    enabled: !visiting && viewerId !== null && firstScreen,
    refetchOnWindowFocus: false,
  });
  const changeRows = libraryChanges(activity.data ?? [], now).slice(0, 6);

  useReported(activity.error, "library-activity");
  useReported(saved.error, "library-saved");
  useReported(collections.error, "library-collections");
  useReported(collectionBuilds.error, "library-collection-builds");
  useReported(kept.error, "library-saved-items");
  useReported(counts.error, "library-saved-counts");

  /* ── what the table shows ── */

  const keptItems = (kept.data?.pages.flatMap((page) => page.items) ?? []).filter((item) => item.kind !== "collection");
  const buildShown: Shown[] = openId
    ? (collectionBuilds.data?.pages.flatMap((page) => page.items.map((item) => ({ id: item.build.id, at: item.addedAt, build: item.build }))) ?? [])
    : (saved.data?.pages.flatMap((page) => page.items.map((item) => ({ id: item.build.id, at: item.savedAt, build: item.build }))) ?? []);
  const itemShown: Shown[] = keptItems.map((item) => ({ id: item.id, at: item.lastUsedAt, item }));
  /* An open collection and Builds list builds; a kept kind lists its items; All saved lists both, newest first. */
  const shown: Shown[] =
    openId || kind === "builds" ? buildShown : itemKind ? itemShown : [...buildShown, ...itemShown].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const rows = shown.map((entry) =>
    entry.item ? savedItemRow(entry.item, usedIn.data ?? new Map(), now) : savedBuildRow({ savedAt: entry.at, build: entry.build as GalleryBuild }, now),
  );

  /* All saved shows the builds even when the kept items fail to load (reported by their own context). */
  const itemsStatus = statusOf(kept);
  const kindStatus: PanelStatus = openId || kind === "builds" ? statusOf(saved) : itemKind ? itemsStatus : saved.isLoading ? "loading" : saved.isError ? "error" : "ready";
  const tableStatus: PanelStatus = visiting && !openId ? statusOf(collections) : openId && !open ? statusOf(alone.isError ? alone : collectionBuilds) : openId ? statusOf(collectionBuilds) : kindStatus;
  const retryTable = () => {
    if (openId) return void collectionBuilds.refetch();
    if (visiting) return void collections.refetch();
    if (kind !== "builds") void kept.refetch();
    if (kind === "builds" || !itemKind) void saved.refetch();
  };
  const hasMore = openId ? collectionBuilds : kind === "builds" ? saved : itemKind ? kept : null;
  const moreAvailable = hasMore ? hasMore.hasNextPage : Boolean(saved.hasNextPage || (wantsItems && kept.hasNextPage));
  const moreLoading = hasMore ? hasMore.isFetchingNextPage : saved.isFetchingNextPage || kept.isFetchingNextPage;
  const loadMore = () => {
    if (hasMore) return void hasMore.fetchNextPage();
    if (saved.hasNextPage) void saved.fetchNextPage();
    if (wantsItems && kept.hasNextPage) void kept.fetchNextPage();
  };

  const selectedId = address.item && rows.some((row) => row.id === address.item) ? address.item : (rows[0]?.id ?? null);
  const chosen = shown.find((entry) => entry.id === selectedId) ?? null;

  /* ── writes ── */

  const [naming, setNaming] = useState<"new" | "rename" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  /* A note being typed, by saved item; saved when the reader leaves the field. */
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const refreshKept = () => {
    void qc.invalidateQueries({ queryKey: ["library", "listSavedItems"] });
    void qc.invalidateQueries({ queryKey: ["library", "countSavedItems"] });
    void qc.invalidateQueries({ queryKey: ["library", "savedItemsUsedIn"] });
    void qc.invalidateQueries({ queryKey: ["library", "collectionSavedBy"] });
  };

  const refreshCollections = () => {
    void qc.invalidateQueries({ queryKey: [LIBRARY_COLLECTIONS_KEY] });
    void qc.invalidateQueries({ queryKey: [LIBRARY_COLLECTION_KEY] });
    void qc.invalidateQueries({ queryKey: [LIBRARY_COLLECTION_BUILDS_KEY] });
  };

  const run = async (write: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await write();
    } catch (error) {
      toast(refusalText(error));
    } finally {
      setBusy(false);
    }
  };

  const togglePrivacy = () =>
    run(async () => {
      if (!open) return;
      await updateCollection(open.id, { isPrivate: !open.isPrivate });
      refreshCollections();
    });

  const confirmDelete = () =>
    run(async () => {
      if (!open) return;
      await deleteBuildCollection(open.id);
      setDeleting(false);
      refreshCollections();
      move({ collection: null });
    });

  const commitNote = (item: LibrarySavedItem) =>
    run(async () => {
      const draft = drafts[item.id];
      if (draft === undefined || draft.trim() === (item.note ?? "")) return;
      await updateSavedItemNote(item.id, draft);
      refreshKept();
      setDrafts(({ [item.id]: _saved, ...rest }) => rest);
    });

  const removeItem = (item: LibrarySavedItem) =>
    run(async () => {
      await unsaveItem(item.id);
      refreshKept();
      toast("Removed from your Library.");
    });

  const toggleCollectionSave = () =>
    run(async () => {
      if (!open) return;
      if (keptCollection) await unsaveItem(keptCollection.id);
      else await saveItem({ kind: "collection", ref: open.id, snapshot: { name: open.name } });
      void keptCollections.refetch();
      refreshKept();
    });

  const copyLink = async (slug: string) => {
    const ok = await copyToClipboard(`${window.location.origin}/b2/${slug}`);
    toast(ok ? "Link copied." : "Couldn't copy the link.");
  };

  /* ── the page's first screen ── */

  usePageReady("library", firstScreen);

  const total = saved.data?.pages[0]?.total ?? buildShown.length;
  const itemCounts = counts.data;
  const keptTotal = itemCounts ? itemCounts.part + itemCounts.session + itemCounts.step + itemCounts.request + itemCounts.filter_set : 0;
  const countFor = (value: LibraryKind): number => {
    if (value === "builds") return total;
    if (value === "all") return total + keptTotal;
    const savedKind = savedKindOf(value);
    return savedKind && itemCounts ? itemCounts[savedKind] : 0;
  };
  const savedByOf = (id: string | undefined) => savedByWords(id ? savedBy.data?.get(id) : undefined);
  const ownerName = owner.data?.displayName?.trim() || (owner.data?.username ? `@${owner.data.username}` : (handle ?? ""));

  const selectedItem = (item: LibrarySavedItem): LibrarySelected => {
    const source = (item.snapshot.source ?? {}) as { buildTitle?: string | null; buildSlug?: string | null };
    const used = usedIn.data?.get(item.id);
    return {
      kind: "step",
      id: item.id,
      chip: itemType(item).toUpperCase(),
      state: { text: `Saved ${ageWords(item.savedAt, now)}` },
      title: itemTitle(item),
      source: itemDetail(item),
      rows: [
        ...(COUNTED_KINDS.has(item.kind) ? [{ label: "Used in", value: countWords(used ?? 0, "build") }] : []),
        ...(source.buildTitle ? [{ label: "Source build", value: source.buildTitle }] : []),
        ...(typeof item.snapshot.model === "string" && item.snapshot.model ? [{ label: "Model", value: item.snapshot.model }] : []),
      ],
      note: { value: drafts[item.id] ?? item.note ?? "", onChange: (value) => setDrafts((current) => ({ ...current, [item.id]: value })), onCommit: () => void commitNote(item) },
      onCopy: () =>
        void copyToClipboard(itemCopyText(item)).then((ok) => toast(ok ? "Copied." : "Couldn't copy.")),
      openHref: source.buildSlug ? `/b2/${source.buildSlug}` : undefined,
      onRemove: () => void removeItem(item),
    };
  };

  const chosenBuild = chosen?.build ?? null;
  const chosenItem = chosen?.item ?? null;
  const selected: LibrarySelected | null = chosenBuild
    ? {
        kind: "build",
        id: chosenBuild.id,
        chip: chosenBuild.shape ?? "other",
        state: isStale(chosenBuild, now) ? { text: "Stale" } : { text: `${openId ? "Added" : "Saved"} ${ageWords(chosen?.at ?? "", now)}` },
        title: chosenBuild.title?.trim() || "Untitled build",
        source: chosenBuild.outcome?.trim() || null,
        build: chosenBuild,
        rows: chosenBuild.last_confirmed_model ? [{ label: "Model", value: modelLabel(chosenBuild.last_confirmed_model) }] : [],
        openHref: `/b2/${chosenBuild.slug}`,
        onCopy: () => void copyLink(chosenBuild.slug),
        copyLabel: "Copy link",
        onAddToCollection: viewerId ? () => requestAddToCollection(chosenBuild.id) : undefined,
        onRemoveFromCollection:
          own && open
            ? {
                name: open.name,
                onRemove: () =>
                  void run(async () => {
                    await removeBuildFromCollection(open.id, chosenBuild.id);
                    refreshCollections();
                    toast(`Removed from ${open.name}.`);
                  }),
              }
            : undefined,
      }
    : chosenItem
      ? selectedItem(chosenItem)
      : null;

  const previewEntry = !openId ? (list[0] ?? null) : null;
  const preview: LibraryPreviewProps | undefined = previewEntry
    ? {
        name: previewEntry.name,
        meta: [`${privacyWord(previewEntry.isPrivate)} · ${countWords(previewEntry.itemCount, "item")}`, savedByOf(previewEntry.isPrivate ? undefined : previewEntry.id)].filter(Boolean).join(" · "),
        to: hrefFor({ collection: previewEntry.id }),
        status: statusOf(collectionBuilds),
        rows: (collectionBuilds.data?.pages[0]?.items ?? []).slice(0, 3).map((item) => ({
          id: item.build.id,
          title: item.build.title?.trim() || "Untitled build",
          type: savedBuildRow({ savedAt: item.addedAt, build: item.build }, now).type,
        })),
      }
    : undefined;

  const tabs = openId ? [{ value: "all", label: "Builds" }] : kindTabs(kind).slice(0, 1);

  const page =
    visiting && !owner.isLoading && !owner.data ? (
      <p style={{ margin: 0 }}>Nobody here goes by that name.</p>
    ) : (
      <LibraryView
        head={
          visiting
            ? { title: `${ownerName}'s library`, meta: countWords(list.length, "public collection") }
            : { title: "Library", meta: `${total + keptTotal} saved · ${countWords(list.length, "collection")}` }
        }
        kinds={
          visiting
            ? undefined
            : {
                items: LIBRARY_KINDS.filter((item) => LIVE_KINDS.includes(item.value)).map((item) => ({ ...item, count: countFor(item.value), href: hrefFor({ kind: item.value }) })),
                value: openId ? null : kind,
                onChange: (next) => move({ kind: next }),
              }
        }
        changes={!visiting && changeRows.length > 0 ? { ...changesFigure(changeRows), rows: changeRows } : undefined}
        collections={{
          status: statusOf(collections),
          items: list.map((item) => ({ id: item.id, name: item.name, meta: privacyWord(item.isPrivate), count: item.itemCount })),
          current: openId,
          hrefFor: (id) => hrefFor({ collection: id }),
          onNew: visiting ? undefined : () => setNaming("new"),
          onRetry: () => void collections.refetch(),
          emptyLine: visiting ? "No public collections yet." : "No collections yet.",
        }}
        items={{
          heading: open
            ? {
                name: open.name,
                meta: [`${privacyWord(open.isPrivate)} · ${countWords(open.itemCount, "build")}`, savedByOf(open.isPrivate ? undefined : open.id)].filter(Boolean).join(" · "),
                actions: own
                  ? [
                      { label: "Rename", onClick: () => setNaming("rename"), disabled: busy },
                      { label: open.isPrivate ? "Make public" : "Make private", onClick: () => void togglePrivacy(), disabled: busy },
                      { label: "Delete", onClick: () => setDeleting(true), disabled: busy },
                    ]
                  : viewerId !== null && !open.isPrivate && !keptCollections.isLoading
                    ? [{ label: keptCollection ? "Remove from saved" : "Save collection", onClick: () => void toggleCollectionSave(), disabled: busy }]
                    : undefined,
              }
            : undefined,
          tabs,
          tab: tabs.some((item) => item.value === address.tab) ? address.tab : "all",
          onTab: (next) => move({ tab: next }),
          status: tableStatus,
          what: openId && !open && alone.isError ? "This collection didn't load." : itemKind && !openId ? "Saved items didn't load." : "Builds didn't load.",
          onRetry: retryTable,
          empty: {
            line:
              visiting && !openId
                ? "No public collections yet."
                : openId
                  ? open
                    ? "Nothing in this collection yet."
                    : "This collection is not there any more."
                  : itemKind
                    ? "Nothing kept here yet."
                    : "Save a build and it waits for you here.",
            action: { label: "Browse builds", href: "/builds" },
          },
          itemColumn: openId ? "Build" : ITEM_COLUMN[kind],
          rows,
          selected: selectedId,
          onSelect: (id) => move({ item: id }, true),
          more: moreAvailable ? { loading: moreLoading, onMore: loadMore } : undefined,
        }}
        selected={selected}
        preview={preview}
      />
    );

  return (
    <>
      <SeoHead
        title={visiting ? `${ownerName}'s library · buildgallery` : "Library · buildgallery"}
        description="Builds kept for later, and the collections they are kept in."
        path={base}
        noIndex
      />
      {/* While the first screen loads the page is its loading state, the route's Placeholder; the page fades in over it. */}
      <PageArrival loading={loading} placeholder={<LibraryLoadingView />}>
        {loading ? <LibraryLoadingView /> : page}
      </PageArrival>
      {naming === "new" ? (
        <NameCollectionDialog
          mode="new"
          onClose={() => setNaming(null)}
          onNamed={(made) => {
            setNaming(null);
            if (made) move({ collection: made.id });
          }}
        />
      ) : null}
      {naming === "rename" && open ? (
        <NameCollectionDialog
          mode="rename"
          collection={open}
          onClose={() => setNaming(null)}
          onNamed={() => {
            setNaming(null);
            refreshCollections();
          }}
        />
      ) : null}
      <DeleteCollectionDialog open={deleting} busy={busy} onCancel={() => setDeleting(false)} onConfirm={() => void confirmDelete()} />
    </>
  );
}
