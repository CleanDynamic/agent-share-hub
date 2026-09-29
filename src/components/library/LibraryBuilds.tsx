// The Library's two tabs, on builds (RC-P18).
//
// SAVED is build_saves, newest save first; COLLECTIONS are the reader's own
// groups, the one used last first ⟦hicks-law › Remedies 6 Customise⟧, and an
// open collection lists its builds. Every build is the gallery's own card,
// signed and counted once for the whole list — the same object on every
// surface ⟦law-of-similarity⟧ ⟦neoscale-performance⟧.
//
// ONE FILLED BUTTON AT MOST, AND ONLY WHEN IT IS THE WAY OUT (STATES.md row
// 19): an empty view's one action is primary because nothing else on it is;
// a populated view has none. "Show more" and "New collection" beside a list
// are secondary (row 2); the open collection's Rename, Make public and Delete
// are tertiary text actions, Delete last, 16 further along, and confirmed in
// the Dialog whose primary names the act (rows 16, 17).

import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GalleryCard, GalleryCardSkeleton } from "@/components/gallery/GalleryCard";
import { cardMedia, useSignedMedia } from "@/components/gallery/cardMedia";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { engagementFor, useEngagement } from "@/hooks/useEngagement";
import type { GalleryBuild } from "@/lib/build/gallery";
import { isPermissionError } from "@/lib/errors/permission";
import {
  COLLECTION_NAME_MAX,
  deleteBuildCollection,
  getCollection,
  listCollectionBuilds,
  listCollections,
  renameCollection,
  startCollection,
  updateCollection,
  type BuildCollection,
} from "@/lib/library";
import { commentTime, listMySavedBuilds } from "@/lib/social";
import { buttonStyle, fieldStyle, ring, skeletonStyle } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { feedback } from "@/lib/theme/motion";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, body, eyebrow, label as labelType, tabular } from "@/lib/theme/type";
import {
  LIBRARY_COLLECTIONS_KEY,
  LIBRARY_COLLECTION_BUILDS_KEY,
  LIBRARY_COLLECTION_KEY,
  LIBRARY_SAVED_KEY,
} from "./addToCollection";

/** Two cards a row in the standard frame; one on a phone. */
const COLUMNS = {
  xl: "repeat(2, minmax(0, 1fr))",
  lg: "repeat(2, minmax(0, 1fr))",
  md: "repeat(2, minmax(0, 1fr))",
  mobile: "minmax(0, 1fr)",
} as const;

const SECONDARY = { background: "transparent", minHeight: 44 } as const;

const refusalText = (error: unknown) =>
  isPermissionError(error) ? "You don't have access to this." : "Something went wrong.";

const countText = (n: number) => `${n} ${n === 1 ? "build" : "builds"}`;

/* ── Shared pieces ───────────────────────────────────────────────────────── */

/** The gallery's cards, signed and counted once for the whole list. */
export function BuildCardGrid({ builds }: { builds: GalleryBuild[] }) {
  const columns = COLUMNS[useBreakpoint()];
  const mediaRows = useMemo(() => builds.flatMap(cardMedia), [builds]);
  const srcByPath = useSignedMedia(mediaRows);
  const engagement = useEngagement(useMemo(() => builds.map((build) => build.id), [builds]));

  return (
    <ul
      data-testid="library-cards"
      style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: columns, gap: SPACE.sm }}
    >
      {builds.map((build) => (
        <li key={build.id} data-testid="library-card" style={{ minWidth: 0 }}>
          <GalleryCard build={build} srcByPath={srcByPath} engagement={engagementFor(engagement, build.id)} />
        </li>
      ))}
    </ul>
  );
}

function CardGridSkeleton() {
  const columns = COLUMNS[useBreakpoint()];
  return (
    <div
      data-testid="library-loading"
      aria-hidden
      style={{ display: "grid", gridTemplateColumns: columns, gap: SPACE.sm }}
    >
      {[0, 1, 2, 3].map((index) => (
        <GalleryCardSkeleton key={index} />
      ))}
    </div>
  );
}

/** STATES.md row 19: one sentence and one action. */
function EmptyView({ testId, sentence, action }: { testId: string; sentence: string; action: ReactNode }) {
  return (
    <div
      data-testid={testId}
      style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: SPACE.sm, paddingBlock: SPACE.md }}
    >
      <p style={{ ...body, color: t.text2, margin: 0 }}>{sentence}</p>
      {action}
    </div>
  );
}

/** STATES.md row 21: one sentence and a secondary "Try again". */
function RefusedView({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: SPACE.xs, paddingBlock: SPACE.md }}>
      <p style={{ ...body, color: t.text, margin: 0 }}>{refusalText(error)}</p>
      <Button type="button" variant="outline" onClick={onRetry} style={SECONDARY}>
        Try again
      </Button>
    </div>
  );
}

function BrowseTheGallery() {
  return (
    <Button asChild variant="default" style={{ minHeight: 44 }}>
      <Link to="/gallery">Browse the gallery</Link>
    </Button>
  );
}

function ShowMore({ onPress, busy }: { onPress: () => void; busy: boolean }) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={busy}
      onClick={onPress}
      style={{ ...SECONDARY, alignSelf: "flex-start" }}
    >
      Show more
    </Button>
  );
}

/* ── Saved ───────────────────────────────────────────────────────────────── */

export function SavedTab() {
  const saved = useInfiniteQuery({
    queryKey: [LIBRARY_SAVED_KEY],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listMySavedBuilds({ before: pageParam }),
    getNextPageParam: (last) => last.nextBefore ?? undefined,
    refetchOnWindowFocus: false,
  });
  const builds = useMemo(
    () => saved.data?.pages.flatMap((page) => page.items.map((item) => item.build)) ?? [],
    [saved.data],
  );

  if (saved.isLoading) return <CardGridSkeleton />;
  if (saved.isError) return <RefusedView error={saved.error} onRetry={() => void saved.refetch()} />;
  if (builds.length === 0) {
    return <EmptyView testId="library-saved-empty" sentence="Save a build and it waits for you here." action={<BrowseTheGallery />} />;
  }
  return (
    <section data-testid="library-saved" style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
      <BuildCardGrid builds={builds} />
      {saved.hasNextPage ? <ShowMore busy={saved.isFetchingNextPage} onPress={() => void saved.fetchNextPage()} /> : null}
    </section>
  );
}

/* ── Collections ─────────────────────────────────────────────────────────── */

export interface CollectionsTabProps {
  /** Another reader's public collections; the signed-in reader's own when omitted. */
  ownerId?: string;
  canEdit: boolean;
  onOpen: (collectionId: string) => void;
}

export function CollectionsTab({ ownerId, canEdit, onOpen }: CollectionsTabProps) {
  const collections = useQuery({
    queryKey: [LIBRARY_COLLECTIONS_KEY, ownerId ?? "mine"],
    queryFn: () => listCollections({ ownerId }),
    refetchOnWindowFocus: false,
  });
  const [naming, setNaming] = useState(false);

  const list = collections.data ?? [];
  const newCollection = (variant: "default" | "outline") => (
    <Button
      type="button"
      variant={variant}
      onClick={() => setNaming(true)}
      style={variant === "outline" ? SECONDARY : { minHeight: 44 }}
    >
      New collection
    </Button>
  );

  let content: ReactNode;
  if (collections.isLoading) {
    content = (
      <div data-testid="library-loading" aria-hidden style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
        {[0, 1, 2].map((index) => (
          <div key={index} style={{ ...skeletonStyle(), height: 56 }} />
        ))}
      </div>
    );
  } else if (collections.isError) {
    content = <RefusedView error={collections.error} onRetry={() => void collections.refetch()} />;
  } else if (list.length === 0) {
    content = canEdit ? (
      <EmptyView
        testId="library-collections-empty"
        sentence="Group builds you want to keep together."
        action={newCollection("default")}
      />
    ) : (
      <EmptyView testId="library-collections-empty" sentence="No public collections yet." action={<BrowseTheGallery />} />
    );
  } else {
    content = (
      <>
        {canEdit ? <div>{newCollection("outline")}</div> : null}
        <ul data-testid="library-collections" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {list.map((collection, index) => (
            <li
              key={collection.id}
              style={{ borderTop: index === 0 ? undefined : `1px solid ${t.line}` }}
            >
              <CollectionRow collection={collection} onOpen={() => onOpen(collection.id)} />
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
      {content}
      {naming ? (
        <NameCollectionDialog
          mode="new"
          onClose={() => setNaming(false)}
          onNamed={(made) => {
            setNaming(false);
            if (made) onOpen(made.id);
          }}
        />
      ) : null}
    </section>
  );
}

function CollectionRow({ collection, onOpen }: { collection: BuildCollection; onOpen: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      data-testid="library-collection"
      onClick={onOpen}
      {...handlers}
      style={{
        width: "100%",
        minHeight: 56,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        gap: 4,
        padding: `${SPACE.xs}px 0`,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        textAlign: "left",
        color: state.hovered ? t.action : t.text,
        transition: feedback("color"),
        ...ring(state.focusVisible),
      }}
    >
      <span style={{ ...body, fontWeight: 600, color: "inherit", overflowWrap: "anywhere" }}>{collection.name}</span>
      <span style={{ fontFamily: DM_MONO, fontSize: 12, lineHeight: 1.3, color: t.text2, ...tabular }}>
        {countText(collection.itemCount)}
        {collection.isPrivate ? " · private" : " · public"} · used {commentTime(collection.lastUsedAt)}
      </span>
    </button>
  );
}

/* ── One collection, open ────────────────────────────────────────────────── */

export interface CollectionViewProps {
  collectionId: string;
  /** The signed-in reader: its owner may rename, publish and delete it. */
  viewerId: string | null;
  onBack: () => void;
}

export function CollectionView({ collectionId, viewerId, onBack }: CollectionViewProps) {
  const queryClient = useQueryClient();
  const meta = useQuery({
    queryKey: [LIBRARY_COLLECTION_KEY, collectionId],
    queryFn: () => getCollection(collectionId),
    refetchOnWindowFocus: false,
  });
  const builds = useInfiniteQuery({
    queryKey: [LIBRARY_COLLECTION_BUILDS_KEY, collectionId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listCollectionBuilds(collectionId, { before: pageParam }),
    getNextPageParam: (last) => last.nextBefore ?? undefined,
    refetchOnWindowFocus: false,
  });
  const cards = useMemo(
    () => builds.data?.pages.flatMap((page) => page.items.map((item) => item.build)) ?? [],
    [builds.data],
  );

  const [naming, setNaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  const collection = meta.data ?? null;
  const own = collection !== null && viewerId !== null && collection.ownerId === viewerId;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: [LIBRARY_COLLECTIONS_KEY] });
    void queryClient.invalidateQueries({ queryKey: [LIBRARY_COLLECTION_KEY, collectionId] });
  };

  const togglePrivacy = async () => {
    if (!collection || busy) return;
    setBusy(true);
    try {
      await updateCollection(collectionId, { isPrivate: !collection.isPrivate });
      refresh();
    } catch (error) {
      toast(refusalText(error));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteBuildCollection(collectionId);
      void queryClient.invalidateQueries({ queryKey: [LIBRARY_COLLECTIONS_KEY] });
      setDeleting(false);
      onBack();
    } catch (error) {
      toast(refusalText(error));
    } finally {
      setBusy(false);
    }
  };

  let content: ReactNode;
  if (builds.isLoading || meta.isLoading) content = <CardGridSkeleton />;
  else if (meta.isError || builds.isError) {
    content = (
      <RefusedView
        error={meta.error ?? builds.error}
        onRetry={() => {
          void meta.refetch();
          void builds.refetch();
        }}
      />
    );
  } else if (!collection) {
    content = <EmptyView testId="library-collection-gone" sentence="This collection is not there any more." action={<BrowseTheGallery />} />;
  } else if (cards.length === 0) {
    content = <EmptyView testId="library-collection-empty" sentence="Nothing in this collection yet." action={<BrowseTheGallery />} />;
  } else {
    content = (
      <>
        <BuildCardGrid builds={cards} />
        {builds.hasNextPage ? <ShowMore busy={builds.isFetchingNextPage} onPress={() => void builds.fetchNextPage()} /> : null}
      </>
    );
  }

  return (
    <section data-testid="library-collection-open" style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: SPACE.xs }}>
        <TextAction label="All collections" onPress={onBack} />
        {collection ? (
          <>
            <h2 style={{ ...body, fontSize: 20, fontWeight: 600, color: t.text, margin: 0, overflowWrap: "anywhere" }}>
              {collection.name}
            </h2>
            <span style={{ fontFamily: DM_MONO, fontSize: 12, lineHeight: 1.3, color: t.text2, ...tabular }}>
              {countText(collection.itemCount)} · {collection.isPrivate ? "private" : "public"}
            </span>
          </>
        ) : null}
        {own ? (
          <div
            data-testid="library-collection-actions"
            style={{ display: "flex", alignItems: "center", flexWrap: "wrap", marginInlineStart: -SPACE.xs }}
          >
            <TextAction label="Rename" onPress={() => setNaming(true)} disabled={busy} />
            <TextAction
              label={collection?.isPrivate ? "Make public" : "Make private"}
              onPress={() => void togglePrivacy()}
              disabled={busy}
            />
            <span style={{ marginInlineStart: SPACE.sm }}>
              <TextAction label="Delete" onPress={() => setDeleting(true)} disabled={busy} />
            </span>
          </div>
        ) : null}
      </div>

      {content}

      {naming && collection ? (
        <NameCollectionDialog
          mode="rename"
          collection={collection}
          onClose={() => setNaming(false)}
          onNamed={() => {
            setNaming(false);
            refresh();
          }}
        />
      ) : null}

      <Dialog open={deleting} onOpenChange={(open) => (!open && !busy ? setDeleting(false) : undefined)}>
        <DialogContent data-testid="delete-collection-dialog" style={{ maxWidth: 440 }}>
          <DialogTitle style={{ ...body, fontSize: 18, fontWeight: 600 }}>Delete this collection?</DialogTitle>
          <DialogDescription style={{ ...body, color: t.text2 }}>
            The builds in it stay where they are; only this group goes.
          </DialogDescription>
          <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: SPACE.xs }}>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setDeleting(false)} style={{ minHeight: 44 }}>
              Cancel
            </Button>
            <Button type="button" variant="default" disabled={busy} onClick={() => void confirmDelete()} style={{ minHeight: 44 }}>
              Delete collection
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function TextAction({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>({}, { disabled });
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      {...handlers}
      style={{ ...buttonStyle("ghost", state), ...labelType, minHeight: 44, padding: `0 ${SPACE.xs}px` }}
    >
      {label}
    </button>
  );
}

/* ── Naming a collection ─────────────────────────────────────────────────── */

type NameCollectionDialogProps =
  | { mode: "new"; collection?: undefined; onClose: () => void; onNamed: (made: BuildCollection | null) => void }
  | { mode: "rename"; collection: BuildCollection; onClose: () => void; onNamed: (made: BuildCollection | null) => void };

/** The existing Dialog (STATES.md row 17): one field, one primary that names the act. */
function NameCollectionDialog({ mode, collection, onClose, onNamed }: NameCollectionDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(collection?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const field = useInteractive<HTMLInputElement>();

  const submit = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    setRefusal(null);
    try {
      if (mode === "new") {
        const made = await startCollection(name);
        void queryClient.invalidateQueries({ queryKey: [LIBRARY_COLLECTIONS_KEY] });
        onNamed(made);
      } else {
        await renameCollection(collection.id, name);
        onNamed(null);
      }
    } catch (error) {
      setRefusal(refusalText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (!open && !busy ? onClose() : undefined)}>
      <DialogContent data-testid="name-collection-dialog" style={{ maxWidth: 440 }}>
        <DialogTitle style={{ ...body, fontSize: 18, fontWeight: 600 }}>
          {mode === "new" ? "New collection" : "Rename collection"}
        </DialogTitle>
        <DialogDescription style={{ ...body, color: t.text2 }}>
          {mode === "new" ? "Only you see it until you make it public." : "The builds in it stay as they are."}
        </DialogDescription>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
            <span style={{ ...labelType, color: t.text2 }}>Name</span>
            <input
              value={name}
              maxLength={COLLECTION_NAME_MAX}
              onChange={(event) => setName(event.target.value)}
              {...field.handlers}
              style={{ ...fieldStyle(field.state), ...body, height: 44, padding: "0 12px", width: "100%" }}
            />
          </label>
          {refusal ? (
            <p role="alert" style={{ ...body, color: t.text, margin: 0 }}>
              {refusal}
            </p>
          ) : null}
          <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: SPACE.xs }}>
            <Button type="button" variant="ghost" disabled={busy} onClick={onClose} style={{ minHeight: 44 }}>
              Cancel
            </Button>
            <Button type="submit" variant="default" disabled={busy || !name.trim()} style={{ minHeight: 44 }}>
              {mode === "new" ? "Create collection" : "Save name"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The eyebrow over a visitor's list. */
export function LibraryEyebrow({ children }: { children: ReactNode }) {
  return <h2 style={{ ...eyebrow, color: t.text2, margin: 0 }}>{children}</h2>;
}
