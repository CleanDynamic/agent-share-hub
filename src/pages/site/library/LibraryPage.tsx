/* SV-09: /library and /library/:handle, the container.

   Loads through `src/lib/social` and `src/lib/library` only, maps the results to `LibraryView`'s props, and runs the
   collection writes. The reader's own Library is their saved builds (build_saves, one request with the count) and their
   collections, both started at once; a collection, open or previewed, is its builds (`listCollectionBuilds`). Another
   reader's library is their public collections only, read only: their saves are theirs alone.

   WHERE THE READER IS lives in the address (`libraryModel.readAddress`): the kind, the tab, the selected item and the open
   collection. Choosing any of them changes the address; the old content stays until the new arrives, with no fade.

   NOT LIVE YET (drawn on the dev page only): the Parts, Sessions, Steps, Requests and Filter sets kinds, Used in, notes,
   saved-by counts and Start a build from a collection (SV-17); the version switch and Edited (SV-19); the changes list
   (SV-15); In collections (SV-25); the Filters and Sort controls (SV-24). */

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
import { listMySavedBuilds } from "@/lib/social";
import { isStale } from "@/lib/build/signals";

import { LibraryLoadingView } from "./LibraryFrame";
import { LibraryView, type LibraryPreviewProps, type LibrarySelected, type PanelStatus } from "./LibraryView";
import { LIBRARY_KINDS, LIVE_KINDS, addressSearch, ageWords, countWords, kindTabs, privacyWord, readAddress, savedBuildRow, type LibraryAddress } from "./libraryModel";

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

  useReported(saved.error, "library-saved");
  useReported(collections.error, "library-collections");
  useReported(collectionBuilds.error, "library-collection-builds");

  /* ── what the table shows ── */

  const table = openId ? collectionBuilds : saved;
  const entries = openId
    ? (collectionBuilds.data?.pages.flatMap((page) => page.items.map((item) => ({ at: item.addedAt, build: item.build }))) ?? [])
    : (saved.data?.pages.flatMap((page) => page.items.map((item) => ({ at: item.savedAt, build: item.build }))) ?? []);
  const rows = entries.map((entry) => savedBuildRow({ savedAt: entry.at, build: entry.build }, now));
  const tableStatus: PanelStatus = visiting && !openId ? statusOf(collections) : openId && !open ? statusOf(alone.isError ? alone : collectionBuilds) : statusOf(table);

  const selectedId = address.item && rows.some((row) => row.id === address.item) ? address.item : (rows[0]?.id ?? null);
  const chosen = entries.find((entry) => entry.build.id === selectedId) ?? null;

  /* ── writes ── */

  const [naming, setNaming] = useState<"new" | "rename" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

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

  const copyLink = async (slug: string) => {
    const ok = await copyToClipboard(`${window.location.origin}/b2/${slug}`);
    toast(ok ? "Link copied." : "Couldn't copy the link.");
  };

  /* ── the page's first screen ── */

  const loading = visiting ? owner.isLoading || collections.isLoading : openId ? collectionBuilds.isLoading : saved.isLoading;
  usePageReady("library", !loading && !collections.isLoading);

  const total = saved.data?.pages[0]?.total ?? entries.length;
  const ownerName = owner.data?.displayName?.trim() || (owner.data?.username ? `@${owner.data.username}` : (handle ?? ""));

  const selected: LibrarySelected | null = chosen
    ? {
        kind: "build",
        id: chosen.build.id,
        chip: chosen.build.shape ?? "other",
        state: isStale(chosen.build, now) ? { text: "Stale" } : { text: `${openId ? "Added" : "Saved"} ${ageWords(chosen.at, now)}` },
        title: chosen.build.title?.trim() || "Untitled build",
        source: chosen.build.outcome?.trim() || null,
        build: chosen.build,
        rows: chosen.build.last_confirmed_model ? [{ label: "Model", value: modelLabel(chosen.build.last_confirmed_model) }] : [],
        openHref: `/b2/${chosen.build.slug}`,
        onCopy: () => void copyLink(chosen.build.slug),
        copyLabel: "Copy link",
        onAddToCollection: viewerId ? () => requestAddToCollection(chosen.build.id) : undefined,
        onRemoveFromCollection:
          own && open
            ? {
                name: open.name,
                onRemove: () =>
                  void run(async () => {
                    await removeBuildFromCollection(open.id, chosen.build.id);
                    refreshCollections();
                    toast(`Removed from ${open.name}.`);
                  }),
              }
            : undefined,
      }
    : null;

  const previewEntry = !openId ? (list[0] ?? null) : null;
  const preview: LibraryPreviewProps | undefined = previewEntry
    ? {
        name: previewEntry.name,
        meta: `${privacyWord(previewEntry.isPrivate)} · ${countWords(previewEntry.itemCount, "item")}`,
        to: hrefFor({ collection: previewEntry.id }),
        status: statusOf(collectionBuilds),
        rows: (collectionBuilds.data?.pages[0]?.items ?? []).slice(0, 3).map((item) => ({
          id: item.build.id,
          title: item.build.title?.trim() || "Untitled build",
          type: savedBuildRow({ savedAt: item.addedAt, build: item.build }, now).type,
        })),
      }
    : undefined;

  const kind = address.kind;
  const tabs = openId ? [{ value: "all", label: "Builds" }] : kindTabs(kind).slice(0, 1);

  const page =
    visiting && !owner.isLoading && !owner.data ? (
      <p style={{ margin: 0 }}>Nobody here goes by that name.</p>
    ) : (
      <LibraryView
        head={
          visiting
            ? { title: `${ownerName}'s library`, meta: countWords(list.length, "public collection") }
            : { title: "Library", meta: `${total} saved · ${countWords(list.length, "collection")}` }
        }
        kinds={
          visiting
            ? undefined
            : {
                items: LIBRARY_KINDS.filter((item) => LIVE_KINDS.includes(item.value)).map((item) => ({ ...item, count: total, href: hrefFor({ kind: item.value }) })),
                value: openId ? null : kind,
                onChange: (next) => move({ kind: next }),
              }
        }
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
                meta: `${privacyWord(open.isPrivate)} · ${countWords(open.itemCount, "build")}`,
                actions: own
                  ? [
                      { label: "Rename", onClick: () => setNaming("rename"), disabled: busy },
                      { label: open.isPrivate ? "Make public" : "Make private", onClick: () => void togglePrivacy(), disabled: busy },
                      { label: "Delete", onClick: () => setDeleting(true), disabled: busy },
                    ]
                  : undefined,
              }
            : undefined,
          tabs,
          tab: tabs.some((item) => item.value === address.tab) ? address.tab : "all",
          onTab: (next) => move({ tab: next }),
          status: tableStatus,
          what: openId && !open && alone.isError ? "This collection didn't load." : "Builds didn't load.",
          onRetry: () => void (openId ? collectionBuilds.refetch() : visiting ? collections.refetch() : saved.refetch()),
          empty: {
            line: visiting && !openId ? "No public collections yet." : openId ? (open ? "Nothing in this collection yet." : "This collection is not there any more.") : "Save a build and it waits for you here.",
            action: { label: "Browse builds", href: "/builds" },
          },
          itemColumn: "Build",
          rows,
          selected: selectedId,
          onSelect: (id) => move({ item: id }, true),
          more: table.hasNextPage ? { loading: table.isFetchingNextPage, onMore: () => void table.fetchNextPage() } : undefined,
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
