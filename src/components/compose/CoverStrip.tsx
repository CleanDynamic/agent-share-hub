// The compose workspace's THREAD EDITOR: the place a creator writes the post.
//
// THE QUESTION IT PUTS FIRST
// Everything below this strip — the tray, the anatomy tree, the inspector — is
// the typed record, and the typed record is depth. It is not the front door. A
// creator who arrives with a screenshot and one sentence has a publishable post
// and should feel finished in under a minute, so the two things that make a
// post social are asked for here, above all of it: a picture, and a sentence
// saying what the thing does.
//
// WHY THE FILE IS STILL CALLED CoverStrip.tsx (BG-P23)
// It stopped being a cover strip in this prompt. It is now a thread of up to
// four entries, each a passage of text above a picture, in the creator's order —
// the same shape BG-P09's card renders. The file keeps its name so that the one
// import in ComposeFrame does not churn, and every word a CREATOR reads says
// "thread". Read the name as the file's address, not as its subject.
//
// WHY IT WRITES THE SET AND NEVER cover_media_id
// BG-P07b made the SET the source of truth and cover_media_id derived: a trigger
// mirrors position 0 into that column. So reordering to position 0 IS changing
// the cover, and this surface must not write the column itself — two writers on
// one derived value is how the cover and the post drift apart. setCover is gone
// from this file for that reason.
//
// WHY THE FIRST ENTRY'S TEXT IS builds.outcome AND NOT post_text
// The first entry's text IS the build's one-sentence description, exactly as a
// tweet's text sits above its image, and it is deliberately NOT duplicated into
// post_text — postEntriesOf (src/lib/build/cover.ts) falls position 0 back to
// the build's own description, and that fallback is the single place the rule
// lives. `builds.outcome` is the column holding it: the whole rebuilt product —
// the gallery query, the completeness signals, the rebuild change lines, the
// portable export, intake — reads `outcome` for the one-sentence description,
// and nothing in it reads `builds.description`, which belongs to the legacy app.
// So this field writes `outcome` through the workspace's debounced save, the
// same path the title takes, and the preview updates because the resolver reads
// the same column. See the handoff note.
//
// Styled inline, like every other surface on this route: Tailwind's generated
// utilities win over hand-written classes at build time. And NO GLASS — a
// working surface carries depth with `--recess` and hairlines (BG-P16).

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, DragEvent } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Play } from "lucide-react";
import {
  MAX_POST_MEDIA,
  MEDIA_MAX_BYTES,
  POST_TEXT_MAX,
  PostMediaError,
  acceptedMediaTypes,
  addPostMedia,
  getPostMedia,
  mediaKindFor,
  postEntriesOf,
  removePostMedia,
  setPostMedia,
  setPostMediaText,
  type Build,
  type BuildMedia,
  type BuildPatch,
  type MediaKind,
  type MediaRef,
  type PostEntry,
} from "@/lib/build";
import {
  MEDIA_WIDTH,
  MediaUnavailable,
  useMediaSrc,
} from "@/components/build/MediaFigure";
import { SAVE_DEBOUNCE_MS } from "@/hooks/useComposeBuild";
import { useComposeMedia } from "@/hooks/useComposeMedia";
import { fieldStyle, prefersReducedMotion, hoverIsFine } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { body, data as dataType, eyebrow, label as labelType } from "@/lib/theme/type";

/**
 * The copy, held as constants because it is the design.
 *
 * "Show what you made" is the sentence this whole prompt exists to put at the
 * top of the page; a later refactor that reflows the JSX should have to delete
 * a named constant to lose it rather than quietly reword a string in place.
 */
const DROP_HEADLINE = "Show what you made — drop a screenshot or video, or browse";
const DROP_SUBLINE = "This becomes the first picture of your post, everywhere on buildgallery.";
const ADD_HEADLINE = "Add another picture or video";
/**
 * The description's question, asked ONCE.
 *
 * It is the LABEL rather than the placeholder. As a placeholder it vanished the
 * moment a creator started typing — taking the question with it — and as both it
 * would print the same sentence twice in a strip that has three other things to
 * say. A label stays put, and the field below it needs no hint of its own.
 */
const OUTCOME_LABEL = "What does it do? One sentence, your words.";
const ENTRY_PLACEHOLDER = "Say what this shows";

/** The refusal for a fifth upload. A plain sentence, not an error. */
const FULL_SENTENCE = `A post shows ${MAX_POST_MEDIA} pictures at most. Remove one to add another.`;

/** A cover is something a reader can see. Audio and documents are not covers. */
const COVER_KINDS: readonly MediaKind[] = ["image", "video"];

/** Empty, the target is a band. */
const EMPTY_HEIGHT = 120;

/** An entry's still, in the row. 16:9 at this width. */
const ENTRY_THUMB_WIDTH = 148;

/** Beside the editor above this width, beneath it below. */
const PREVIEW_BESIDE_MIN = 1024;

/** The preview column. A feed card's own measure, so it previews honestly. */
const PREVIEW_WIDTH = 420;

/** The `accept` attribute, filtered out of the lib layer's own list. */
export function coverAcceptedTypes(): string {
  return acceptedMediaTypes()
    .filter((mime) => COVER_KINDS.includes(mediaKindFor(mime) as MediaKind))
    .join(",");
}

/**
 * Why this file cannot be a post picture, or null when it can.
 *
 * Checked HERE, before uploadMedia is called at all, so a 40MB video costs no
 * request and no wait. The sentence names the limit, because "too large" is not
 * something a creator can act on.
 */
export function coverRejection(file: File): string | null {
  const name = file.name || "That file";

  if (file.size > MEDIA_MAX_BYTES) {
    return `${name} is ${megabytes(file.size)}MB. A cover has to be under ${megabytes(MEDIA_MAX_BYTES)}MB, so it was not uploaded.`;
  }

  const kind = mediaKindFor(file.type);
  if (!kind || !COVER_KINDS.includes(kind)) {
    return `${name} is ${file.type || "an unrecognised type"}. A cover is a picture or a video — png, jpg, webp, gif, avif, mp4, webm or mov.`;
  }

  return null;
}

function megabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

/** The poster of a video, as a media reference of its own. */
function posterRef(media: BuildMedia | null | undefined): MediaRef | null {
  if (!media?.poster_path) return null;
  // Kind image rather than video: the poster is a still, and the transform is
  // only applied to images.
  return { bucket: media.bucket, path: media.poster_path, kind: "image" };
}

/**
 * The post's own rows, cached apart from the workspace's media list.
 *
 * A SECOND QUERY, AND IT HAS TO BE. getMediaForBuild selects MEDIA_COLUMNS,
 * which does not include post_position or post_text — so the list every other
 * panel reads reports no entries at all, and postEntriesOf would drop every row
 * it was handed. getPostMedia is the read that carries the two columns, and
 * cover.ts names this surface as its caller.
 */
export function postMediaQueryKey(buildId: string) {
  return ["compose", "post-media", buildId] as const;
}

/** transform and opacity only, and never against a creator's stated wish. */
function dragTransition(): string | undefined {
  return prefersReducedMotion() ? undefined : "transform 200ms cubic-bezier(.2,.6,.35,1)";
}

interface CoverStripProps {
  build: Build;
  /** The workspace's debounced header write. The description goes through it. */
  onPatch: (patch: BuildPatch) => void;
  /** True below the compose breakpoint: the editor stacks. */
  stacked: boolean;
}

/**
 * The thread, and the preview of what it publishes as.
 *
 * A NEW element between the top bar and the three-panel frame. Nothing that
 * already lays this page out is touched: the panel row below is flex:1 and
 * absorbs whatever height this takes.
 */
export function CoverStrip({ build, onPatch, stacked }: CoverStripProps) {
  const media = useComposeMedia();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const key = useMemo(() => postMediaQueryKey(build.id), [build.id]);
  const { data: rows } = useQuery<BuildMedia[]>({
    queryKey: key,
    queryFn: () => getPostMedia(build.id),
    // The writes below put their own answer in the cache, so there is nothing
    // to refetch for — the same discipline the workspace's media list keeps.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const postRows = useMemo(() => rows ?? [], [rows]);
  const entries = useMemo(() => postEntriesOf(build, postRows), [build, postRows]);
  const full = entries.length >= MAX_POST_MEDIA;

  /** Every write returns the new set; one place puts it in the cache. */
  const commit = useCallback(
    (next: BuildMedia[]) => queryClient.setQueryData<BuildMedia[]>(key, next),
    [key, queryClient]
  );

  /**
   * One saved row back into the set, in place.
   *
   * setPostMediaText returns the row it wrote and nothing else, because it
   * changed nothing else — so this merges rather than replacing, and a position
   * the text write never touched cannot be reordered by it.
   */
  const mergeRow = useCallback(
    (row: BuildMedia) =>
      queryClient.setQueryData<BuildMedia[]>(key, (previous) =>
        (previous ?? []).map((existing) => (existing.id === row.id ? row : existing))
      ),
    [key, queryClient]
  );

  /**
   * A refusal the data layer names is a sentence; anything else is the message.
   *
   * PostMediaError carries a code precisely so "full" can be shown next to the
   * control that is full rather than toasted as a failure — see cover.ts.
   */
  const report = useCallback((cause: unknown) => {
    if (cause instanceof PostMediaError) {
      setError(cause.code === "full" ? FULL_SENTENCE : cause.message);
      return;
    }
    setError(cause instanceof Error ? cause.message : String(cause));
  }, []);

  const accept = useCallback(
    async (file: File | undefined) => {
      if (!media || !file || uploading) return;
      setError(null);

      if (full) {
        setError(FULL_SENTENCE);
        return;
      }

      const reason = coverRejection(file);
      if (reason) {
        setError(reason);
        return;
      }

      setUploading(true);
      try {
        // nodeId null puts the object under UNPLACED_SEGMENT: a post's picture
        // is the build's, not any one node's evidence. The upload path itself
        // is untouched.
        const row = await media.upload(file, { nodeId: null });
        commit(await addPostMedia(build.id, row.id));
      } catch (cause) {
        report(cause);
      } finally {
        setUploading(false);
      }
    },
    [build.id, commit, full, media, report, uploading]
  );

  /**
   * Take one entry out. The gap closes and its text goes with it.
   *
   * BOTH are the data layer's job and it does them in one transaction —
   * removePostMedia reassigns positions from array order, and the database
   * function nulls the text of a row leaving the set. Reimplementing either
   * here would be a second answer to a question that already has one.
   */
  const remove = useCallback(
    async (mediaId: string) => {
      setError(null);
      try {
        commit(await removePostMedia(build.id, mediaId));
      } catch (cause) {
        report(cause);
      }
    },
    [build.id, commit, report]
  );

  /**
   * Reorder, optimistically, then write the whole set.
   *
   * The optimistic hop and the revert are useNodeDrag's conventions, kept here
   * rather than imported because that hook owns build_nodes and this owns one
   * column of build_media. Text travels with its entry for free: the row moves,
   * and post_text is on the row — so nothing re-saves text after a drag.
   */
  const reorder = useCallback(
    async (from: number, to: number) => {
      if (from === to || to < 0 || from < 0) return;
      const ids = entries.map((entry) => entry.media.id);
      if (from >= ids.length) return;

      const next = [...ids];
      const [moved] = next.splice(from, 1);
      next.splice(to > from ? to - 1 : to, 0, moved);
      if (next.every((id, index) => id === ids[index])) return;

      const before = postRows;
      // Optimistic: the rows in the new order, positions renumbered, so the
      // list and the preview move before the server has agreed.
      const byId = new Map(before.map((row) => [row.id, row]));
      commit(
        next
          .map((id, index) => {
            const row = byId.get(id);
            return row ? { ...row, post_position: index } : null;
          })
          .filter((row): row is BuildMedia => row !== null)
      );

      setError(null);
      try {
        commit(await setPostMedia(build.id, next));
      } catch (cause) {
        commit(before);
        report(cause);
      }
    },
    [build.id, commit, entries, postRows, report]
  );

  const browse = useCallback(() => inputRef.current?.click(), []);

  // The workspace frame also takes file drops, and turns them into tray nodes.
  // A drop that landed on the thread is not one of those.
  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setOver(true);
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setOver(false);
      void accept(event.dataTransfer?.files?.[0]);
    },
    [accept]
  );

  const beside = usePreviewBeside() && !stacked;

  return (
    <section
      data-visual-slot="compose-cover"
      data-testid="cover-strip"
      aria-label="Your post"
      style={{
        flexShrink: 0,
        display: "flex",
        flexDirection: beside ? "row" : "column",
        alignItems: "flex-start",
        gap: 16,
        padding: "12px 14px",
        borderBottom: `1px solid ${t.line}`,
        /* The ground itself. A working surface asserts nothing behind the work
           — no tint, no blur; the hairline above is the whole separation. */
        background: t.bg,
      }}
    >
      <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <ThreadHeader count={entries.length} />

        {/* The visible affordance is the band, the rows and their controls;
            this is what they all open. */}
        <input
          ref={inputRef}
          type="file"
          aria-label="Picture or video for your post"
          accept={coverAcceptedTypes()}
          disabled={!media || uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Cleared so choosing the same file twice fires a change again.
            event.target.value = "";
            void accept(file);
          }}
          style={{ display: "none" }}
        />

        <ThreadEntries
          build={build}
          entries={entries}
          onPatch={onPatch}
          onRemove={remove}
          onReplace={browse}
          onReorder={reorder}
          onError={report}
          onMergeRow={mergeRow}
        />

        <div
          data-testid="cover-drop"
          onDragOver={onDragOver}
          onDragEnter={onDragOver}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          style={{ display: "flex", minWidth: 0 }}
        >
          {uploading ? (
            <Uploading />
          ) : full ? (
            <p
              style={{
                ...body,
                fontSize: 13,
                margin: 0,
                color: t.text2,
              }}
            >
              {FULL_SENTENCE}
            </p>
          ) : (
            <EmptyTarget
              over={over}
              disabled={!media}
              onBrowse={browse}
              first={entries.length === 0}
            />
          )}
        </div>

        {error ? (
          <span
            role="alert"
            style={{
              ...body,
              fontSize: 12,
              lineHeight: 1.5,
              color: t.catBreakage,
              maxWidth: "60ch",
            }}
          >
            {error}
          </span>
        ) : null}
      </div>

      <ThreadPreview build={build} rows={postRows} beside={beside} />
    </section>
  );
}

/** Beside the editor at PREVIEW_BESIDE_MIN and up. */
function usePreviewBeside(): boolean {
  /* matchMedia rather than a CSS media query, for the reason every surface on
     this route is styled inline: there is no stylesheet to put a breakpoint in.
     Same shape as ComposeFrame's useIsSingleColumn. */
  const [beside, setBeside] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(`(min-width: ${PREVIEW_BESIDE_MIN}px)`).matches
  );

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${PREVIEW_BESIDE_MIN}px)`);
    const onChange = () => setBeside(query.matches);
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return beside;
}

/** The eyebrow and the count. Mono, because a count is data about the surface. */
function ThreadHeader({ count }: { count: number }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
      <h2 style={{ ...eyebrow, color: t.text, margin: 0 }}>Your post</h2>
      <span
        data-testid="thread-count"
        style={{ ...dataType, fontSize: 12, color: t.text2, fontVariantNumeric: "tabular-nums" }}
      >
        {count} / {MAX_POST_MEDIA}
      </span>
    </div>
  );
}

/* ── The entries ───────────────────────────────────────────────────────────────
   One draggable row per entry, with an insertion point between each pair.

   THE DRAG IS useNodeDrag'S CONVENTIONS, NOT A SECOND MECHANISM. Same library,
   same sensors (4px of travel before a drag starts, so a click still lands in a
   text field), the same `::`-separated encoded droppable ids, the same
   "optimistic hop then revert on failure" shape. What it is NOT is a second
   registration in the tree's DndContext: that context belongs to build_nodes
   and adding a foreign id namespace to it would mean editing the node drag,
   which this prompt must not touch. A nested context keeps the two apart — a
   pointer-down on an entry activates only this one, because these rows call
   useDraggable from this provider.

   A "gap" is one insertion point, modelled exactly as useNodeDrag models it:
   gap i is simultaneously after the entry above it and before the entry below,
   so each place an entry can land has exactly one droppable.
   ─────────────────────────────────────────────────────────────────────────── */

const SEP = "::";
const ENTRY = "thread-entry";
const GAP = "thread-gap";

function entryDragId(mediaId: string): string {
  return `${ENTRY}${SEP}${mediaId}`;
}

function threadGapId(index: number): string {
  return `${GAP}${SEP}${index}`;
}

/** The insertion index a droppable id names, or null when it is not one. */
export function decodeThreadGap(raw: string): number | null {
  const parts = raw.split(SEP);
  if (parts[0] !== GAP || parts.length !== 2) return null;
  const index = Number(parts[1]);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

type Entry = PostEntry<BuildMedia>;

function ThreadEntries({
  build,
  entries,
  onPatch,
  onRemove,
  onReplace,
  onReorder,
  onError,
  onMergeRow,
}: {
  build: Build;
  entries: Entry[];
  onPatch: (patch: BuildPatch) => void;
  onRemove: (mediaId: string) => void;
  onReplace: () => void;
  onReorder: (from: number, to: number) => void;
  onError: (cause: unknown) => void;
  onMergeRow: (row: BuildMedia) => void;
}) {
  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so a click on a row still
    // reaches the text field inside it. useNodeDrag's number, for the same
    // reason it chose it.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor)
  );

  const [activeId, setActiveId] = useState<string | null>(null);

  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const over = event.over ? decodeThreadGap(String(event.over.id)) : null;
      if (over === null) return;
      const from = entries.findIndex(
        (entry) => entryDragId(entry.media.id) === String(event.active.id)
      );
      if (from < 0) return;
      onReorder(from, over);
    },
    [entries, onReorder]
  );

  const saveText = useEntryText(build.id, onMergeRow, onError);

  /* NO PICTURE YET, BUT PERHAPS A SENTENCE. The description must never be
     orphaned: a build whose creator wrote the sentence before finding a
     screenshot still shows the field, above the empty target rather than
     hidden behind it. It is also shown when both are empty, because the
     sentence is the one thing this screen asks for that needs no upload. */
  if (entries.length === 0) {
    return (
      <EntryText
        position={0}
        value={build.outcome ?? ""}
        onChange={(next) => onPatch({ outcome: next === "" ? null : next })}
      />
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div
        role="list"
        aria-label="The entries of your post, in order"
        style={{
          display: "flex",
          flexDirection: "column",
          /* THE COMMON REGION. Four rows of picture-and-text in a dense
             workspace group by a shared ground and one hairline, which survives
             the density that proximity alone would not. --recess is the token
             for a surface the page is cut into; the rows sit on --bg inside it,
             so each entry reads as a thing ON the tray rather than as more
             tray. */
          gap: 2,
          padding: 6,
          borderRadius: r.control,
          border: `1px solid ${t.line}`,
          background: t.recess,
        }}
      >
        <ThreadGap index={0} activeId={activeId} />
        {entries.map((entry, index) => (
          <div key={entry.media.id} style={{ display: "contents" }}>
            <EntryRow
              entry={entry}
              index={index}
              dragging={activeId === entryDragId(entry.media.id)}
              build={build}
              onPatch={onPatch}
              onRemove={onRemove}
              onReplace={onReplace}
              onSaveText={saveText}
            />
            <ThreadGap index={index + 1} activeId={activeId} />
          </div>
        ))}
      </div>
    </DndContext>
  );
}

/**
 * Entry text, held locally and flushed on the workspace's own cycle.
 *
 * SAVE_DEBOUNCE_MS is useComposeBuild's constant, imported rather than copied:
 * a second 800 in this file is how one surface starts saving on a different beat
 * from the rest of the workspace. One timer per entry, because editing the words
 * under picture three must not cancel the save of picture one.
 *
 * Pending writes are FLUSHED on unmount, not cleared — leaving the workspace
 * mid-debounce must not lose the last sentence a creator typed, which is the
 * same guarantee useComposeBuild makes for the header.
 */
function useEntryText(
  buildId: string,
  onMergeRow: (row: BuildMedia) => void,
  onError: (cause: unknown) => void
) {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pending = useRef(new Map<string, string>());

  useEffect(() => {
    const map = timers.current;
    const queued = pending.current;
    return () => {
      for (const [mediaId, timer] of map) {
        clearTimeout(timer);
        const text = queued.get(mediaId);
        // Fire and forget: the component is going away and there is nobody left
        // to tell, but the sentence still belongs in the table.
        if (text !== undefined) void setPostMediaText(buildId, mediaId, text).catch(() => {});
      }
      map.clear();
      queued.clear();
    };
  }, [buildId]);

  return useCallback(
    (mediaId: string, text: string) => {
      const existing = timers.current.get(mediaId);
      if (existing) clearTimeout(existing);
      pending.current.set(mediaId, text);
      timers.current.set(
        mediaId,
        setTimeout(() => {
          timers.current.delete(mediaId);
          pending.current.delete(mediaId);
          setPostMediaText(buildId, mediaId, text).then(onMergeRow).catch(onError);
        }, SAVE_DEBOUNCE_MS)
      );
    },
    [buildId, onError, onMergeRow]
  );
}

/** The insertion point between two entries. `--action`, 2px, transform only. */
function ThreadGap({ index, activeId }: { index: number; activeId: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: threadGapId(index) });
  const live = activeId !== null;

  return (
    <div
      ref={setNodeRef}
      aria-hidden
      style={{
        /* Two pixels at rest so the rows keep their rhythm, and the indicator
           SCALES rather than growing the row: a height animation would move
           every entry below it. */
        height: live ? 8 : 2,
        display: "flex",
        alignItems: "center",
      }}
    >
      <span
        style={{
          width: "100%",
          height: 2,
          borderRadius: 2,
          background: isOver ? t.action : "transparent",
          transform: isOver ? "scaleY(1)" : "scaleY(0)",
          transformOrigin: "center",
          transition: dragTransition(),
        }}
      />
    </div>
  );
}

/**
 * One entry: a passage of text above a picture, which is the order a reader
 * meets them in and therefore the order they are edited in.
 */
function EntryRow({
  entry,
  index,
  dragging,
  build,
  onPatch,
  onRemove,
  onReplace,
  onSaveText,
}: {
  entry: Entry;
  index: number;
  dragging: boolean;
  build: Build;
  onPatch: (patch: BuildPatch) => void;
  onRemove: (mediaId: string) => void;
  onReplace: () => void;
  onSaveText: (mediaId: string, text: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: entryDragId(entry.media.id),
  });
  const [active, setActive] = useState(false);
  const first = index === 0;

  return (
    <div
      role="listitem"
      ref={setNodeRef}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: 8,
        borderRadius: r.control,
        border: `1px solid ${t.line}`,
        background: t.bg,
        /* transform and opacity only, and the dragged row keeps its place in
           the list rather than being torn out of it. */
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: dragging ? 0.6 : 1,
        transition: dragging ? undefined : dragTransition(),
      }}
    >
      <button
        type="button"
        aria-label={`Reorder entry ${index + 1}`}
        {...attributes}
        {...listeners}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          width: 22,
          height: 28,
          padding: 0,
          borderRadius: r.chip,
          border: "none",
          background: "transparent",
          color: t.text2,
          cursor: "grab",
          touchAction: "none",
        }}
      >
        <GripVertical size={14} aria-hidden />
      </button>

      <EntryStill media={entry.media} position={index} />

      <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {first ? (
            <span
              data-testid="thread-cover-label"
              style={{ ...dataType, fontSize: 11, letterSpacing: "0.08em", color: t.text2 }}
            >
              COVER
            </span>
          ) : (
            <span style={{ ...dataType, fontSize: 11, color: t.text2 }}>{index + 1}</span>
          )}

          {/* Quiet until the row is hovered or something inside it takes focus.
              An inline style cannot express :hover, and hiding them from the
              keyboard as well would make Remove unreachable without a mouse. */}
          <span
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 6,
              opacity: active || !hoverIsFine() ? 1 : 0,
              transition: dragTransition(),
            }}
          >
            <QuietButton onClick={onReplace}>Replace</QuietButton>
            <QuietButton onClick={() => onRemove(entry.media.id)}>Remove</QuietButton>
          </span>
        </div>

        <EntryText
          position={index}
          value={first ? build.outcome ?? "" : entry.media.post_text ?? ""}
          onChange={(next) => {
            /* THE FIRST ENTRY'S TEXT IS THE DESCRIPTION, and it goes to the
               build's own column through the workspace's debounced save — never
               to post_text. postEntriesOf falls position 0 back to exactly that
               column, so the preview follows without a second copy of the
               sentence existing anywhere. */
            if (first) {
              onPatch({ outcome: next === "" ? null : next });
              return;
            }
            onSaveText(entry.media.id, next);
          }}
        />
      </div>
    </div>
  );
}

/**
 * The text above one picture.
 *
 * The first is the description and is asked for in words: it is the sentence
 * the whole screen exists to collect, so it carries a label and a size the rest
 * do not. Every later one is a caption and needs only its placeholder.
 */
function EntryText({
  position,
  value,
  onChange,
}: {
  position: number;
  value: string;
  onChange: (next: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const first = position === 0;

  // Code points, as char_length() counts them and as POST_TEXT_MAX is measured:
  // an emoji costs one of a creator's 280 rather than the two .length reports.
  const used = [...value].length;
  const over = used > POST_TEXT_MAX;

  const id = first ? "compose-outcome" : `compose-entry-text-${position}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      {first ? (
        <label htmlFor={id} style={{ ...labelType, fontSize: 13, fontWeight: 500, color: t.text }}>
          {OUTCOME_LABEL}
        </label>
      ) : null}

      <input
        id={id}
        data-testid={first ? "outcome-input" : `entry-text-${position}`}
        type="text"
        value={value}
        placeholder={first ? undefined : ENTRY_PLACEHOLDER}
        spellCheck
        onChange={(event) => onChange(event.target.value)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...fieldStyle({ hovered, focusVisible: focused, invalid: over }),
          ...body,
          /* The description outranks a caption, and both outrank the tree. 17
             is the top of the body range; a caption sits one step under it. */
          fontSize: first ? 17 : 14,
          fontWeight: 400,
          fontFamily: "inherit",
          width: "100%",
          height: first ? 40 : 34,
          padding: "0 10px",
          outline: focused ? undefined : "none",
        }}
      />

      {/* The counter is mono and appears once there is something to count, so an
          empty field is an invitation rather than a budget. */}
      {used > 0 || over ? (
        <span
          data-testid={`entry-count-${position}`}
          style={{
            ...dataType,
            fontSize: 11,
            alignSelf: "flex-end",
            color: over ? t.catBreakage : t.text2,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {used} / {POST_TEXT_MAX}
        </span>
      ) : null}
    </div>
  );
}

/** A row's control. Quiet, on the ground, a hairline for its edge. */
function QuietButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...quietButton,
        borderColor: hovered ? t.text2 : t.line,
        color: hovered ? t.text : t.text2,
      }}
    >
      {children}
    </button>
  );
}

const quietButton: CSSProperties = {
  ...labelType,
  fontFamily: "inherit",
  fontSize: 11,
  fontWeight: 500,
  padding: "3px 9px",
  borderRadius: r.chip,
  background: "transparent",
  borderWidth: 1,
  borderStyle: "solid",
  cursor: "pointer",
};

/** An entry's still. 16:9 at --r-media, which is the token for a thumbnail. */
function EntryStill({ media, position }: { media: BuildMedia; position: number }) {
  const src = useMediaSrc(media, MEDIA_WIDTH.tree);
  const poster = useMediaSrc(posterRef(media), MEDIA_WIDTH.tree);
  const isVideo = media.kind === "video";
  const still = isVideo ? poster : src;

  return (
    <div
      style={{
        position: "relative",
        flexShrink: 0,
        width: ENTRY_THUMB_WIDTH,
        maxWidth: "40%",
        aspectRatio: "16 / 9",
        borderRadius: r.media,
        overflow: "hidden",
        border: `1px solid ${t.line}`,
        background: t.recess,
      }}
    >
      {still ? (
        <img
          src={still}
          alt={position === 0 ? "Build cover" : `Post picture ${position + 1}`}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : isVideo && src ? (
        // No poster on the row yet: the video's own first frame is the still.
        <video
          src={src}
          muted
          playsInline
          preload="metadata"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <MediaUnavailable style={{ height: "100%", border: "none", justifyContent: "center" }} />
      )}

      {isVideo ? (
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: t.onAction,
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              /* --r-full is for circular things, and a play badge is one. */
              borderRadius: r.full,
              background: t.action,
            }}
          >
            <Play size={12} fill="currentColor" />
          </span>
        </span>
      ) : null}
    </div>
  );
}

/** The band that asks the question. A button, so a keyboard reaches it. */
function EmptyTarget({
  over,
  disabled,
  onBrowse,
  first,
}: {
  over: boolean;
  disabled: boolean;
  onBrowse: () => void;
  /** The first picture is the ask; a later one is an addition, and quieter. */
  first: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onBrowse}
      style={{
        fontFamily: "inherit",
        width: "100%",
        minHeight: first ? EMPTY_HEIGHT : 44,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: first ? "14px 16px" : "10px 16px",
        borderRadius: r.control,
        /* Dashed in --line, which is the hairline token: a target is an outline
           of a thing that is not there yet, and --action would promise that
           pressing it publishes something. --action is kept for the state that
           means "this is where it lands". */
        border: `1px dashed ${over ? t.action : t.line}`,
        background: over ? t.recess : "transparent",
        textAlign: "center",
        cursor: disabled ? "default" : "pointer",
        transition: dragTransition(),
      }}
    >
      <span style={{ ...body, fontSize: first ? 15 : 13, fontWeight: 400, color: t.text }}>
        {first ? DROP_HEADLINE : ADD_HEADLINE}
      </span>
      {first ? (
        <span style={{ ...body, fontSize: 12, color: t.text2 }}>{DROP_SUBLINE}</span>
      ) : null}
    </button>
  );
}

/**
 * The upload, mid-flight.
 *
 * Indeterminate, and the same treatment as IntakeProgress: a sweep clipped by a
 * fixed rail. uploadMedia can report bytes, but one picture is one short act and
 * a bar that jumped to 99% and then waited on the row insert would be reporting
 * the wrong half of it.
 */
function Uploading() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        width: "100%",
        minHeight: 44,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "10px 16px",
        borderRadius: r.control,
        border: `1px dashed ${t.line}`,
        background: t.recess,
      }}
    >
      <span style={{ ...dataType, fontSize: 12, color: t.evidence }}>
        Uploading…
      </span>
      {/* The track clips the sweep, so it reads as motion along a fixed rail
          rather than a block flying across the strip. */}
      <div
        aria-hidden
        style={{
          position: "relative",
          height: 2,
          width: "100%",
          maxWidth: 280,
          overflow: "hidden",
          borderRadius: 2,
          background: t.line,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: "25%",
            borderRadius: 2,
            background: `linear-gradient(90deg, transparent, ${t.evidence}, transparent)`,
            animation: "intakeSweep 1200ms ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}

/* ── The preview ───────────────────────────────────────────────────────────────
   LAZY, AND THAT IS THE POINT. The card is the one thing here that pulls a chunk
   compose had no reason to fetch before, and compose is the heaviest route in the
   application. Splitting it (ThreadPreviewCard.tsx) keeps the editor interactive
   on the route's own payload and lets the picture of the post arrive a moment
   after the means of making one — the right order for a screen whose primary ask
   is the first entry.

   THE LINK IS NEUTRALISED. A card is a link to /b2/:slug, and a creator who
   clicked their own preview would leave the workspace mid-draft. preventDefault
   in the CAPTURE phase runs before the Link's own handler, which navigates only
   while the event is not already defaulted — so the card still unfolds, and
   still cannot navigate.
   ─────────────────────────────────────────────────────────────────────────── */
const ThreadPreviewCard = lazy(() => import("./ThreadPreviewCard"));

function ThreadPreview({
  build,
  rows,
  beside,
}: {
  build: Build;
  rows: BuildMedia[];
  beside: boolean;
}) {
  return (
    <aside
      data-testid="thread-preview"
      aria-label="How your post will look"
      style={{
        flexShrink: 0,
        width: beside ? PREVIEW_WIDTH : "100%",
        maxWidth: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <h2 style={{ ...eyebrow, color: t.text2, margin: 0 }}>How it will look</h2>
      <div
        onClickCapture={(event) => event.preventDefault()}
        style={{ minWidth: 0, maxWidth: "100%" }}
      >
        <Suspense
          fallback={
            /* A quiet well at the card's own radius, so the arrival settles into
               a shape that was already there rather than shifting the row. */
            <div
              aria-hidden
              style={{
                minHeight: 180,
                borderRadius: r.card,
                border: `1px solid ${t.line}`,
                background: t.recess,
              }}
            />
          }
        >
          <ThreadPreviewCard build={build} rows={rows} />
        </Suspense>
      </div>
    </aside>
  );
}
