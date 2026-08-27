// The publish sheet: the card you are about to post, and what is left to say.
//
// WHY A SHEET AND NOT A TOOLTIP. Until NS-P29 the whole of publishing was a pill
// in the top bar with a sentence hanging off it. That is a checklist wearing a
// button, and it asks a creator to trust that something good happens on the
// other side of it. What is actually about to happen is a POST — a card, in a
// feed, with their picture and their sentence on it — so this surface shows
// them that card, rendered by the same component the gallery renders, before
// anything is written.
//
// THE CARD IS THE REAL ONE. Not a mock of it, not a second implementation kept
// in step by hand: GalleryCard, imported from the same path /gallery imports it
// from, fed a GalleryBuild assembled out of the workspace's own state. If the
// card changes, this changes with it, and there is no way for the two to drift.
// The assembly is previewBuild() below, and the one liberty it takes is
// documented there.
//
// WHAT THIS FILE DOES NOT DO. It does not decide whether the build can be
// published. Readiness arrives as a prop, computed by PublishControl exactly as
// it was before this file existed, and the primary action is gated on it and on
// nothing else. Publishing itself is still onConfirm's business.
//
// Styled with inline style objects, like every other surface on this route:
// Tailwind's generated utilities win over hand-written classes at build time.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { GalleryCard } from "@/components/gallery/GalleryCard";
import { cardMedia, useSignedMedia } from "@/components/gallery/cardMedia";
import { useComposeMedia } from "@/hooks/useComposeMedia";
import {
  resolveCover,
  type Build,
  type BuildMedia,
  type Completeness,
  type GalleryBuild,
  type GalleryMedia,
  type GalleryNode,
  type MissingItem,
  type NodeTree,
  type PublishReadiness,
  type RequirementKey,
} from "@/lib/build";
import {
  FONT_STACK,
  GAP_RED,
  HAIRLINE,
  ORANGE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  bodyText,
  hexToRgba,
  labelText,
  panelGlass,
} from "@/components/build/tokens";

/**
 * The copy, held as constants because it is the design.
 *
 * These five sentences are the whole editorial position of this surface: it
 * shows a post rather than a form, it asks rather than grades, and it says out
 * loud that publishing is not a one-way door. A later refactor that reflows the
 * JSX should have to delete a named constant to lose one of them.
 */
const CARD_LABEL = "This is your post.";
const COVER_NUDGE = "Add a picture — posts with one get seen.";
const CHECKLIST_LABEL = "What is left";
const NOTHING_LEFT = "Nothing left. This one is ready.";
const KEEP_EDITING = "You can keep editing after publishing.";

/** The same breakpoint the workspace collapses at. See ComposeFrame. */
const SINGLE_COLUMN_MAX = 900;

/**
 * The synthetic ids the preview's cover is carried on.
 *
 * See previewBuild. They are namespaced rather than plausible so that a row
 * carrying one can never be mistaken for a record the database issued.
 */
const PREVIEW_COVER_NODE_ID = "__publish-preview-cover-node__";
const PREVIEW_COVER_MEDIA_ID = "__publish-preview-cover-media__";

/**
 * matchMedia rather than a CSS media query: every surface on this route is
 * styled inline, and an inline style cannot carry a breakpoint.
 *
 * Its own copy rather than ComposeFrame's, because importing that hook from
 * here would close the loop ComposeFrame -> ComposeTopBar -> PublishControl ->
 * PublishSheet into a cycle.
 */
function useIsNarrow(): boolean {
  const query = `(max-width: ${SINGLE_COLUMN_MAX - 1}px)`;
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setNarrow(event.matches);
    setNarrow(list.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return narrow;
}

/** Every placed node, depth first — the order the record reads in. */
function flatten(tree: readonly NodeTree[]): NodeTree[] {
  const out: NodeTree[] = [];
  const walk = (nodes: readonly NodeTree[]) => {
    for (const node of nodes) {
      out.push(node);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(tree);
  return out;
}

/** The gallery's view of one media row. BuildMedia is a superset of it. */
function toGalleryMedia(row: BuildMedia): GalleryMedia {
  return {
    id: row.id,
    node_id: row.node_id,
    bucket: row.bucket,
    path: row.path,
    kind: row.kind,
    width: row.width,
    height: row.height,
  };
}

/**
 * The workspace's state, as the gallery would have loaded it.
 *
 * THE ONE LIBERTY, and why it is the right one. A card body resolves its
 * picture through heroMedia — build.hero_node_id, then the row attached to it —
 * whereas the cover chain a creator has actually been editing since NS-P27 is
 * resolveCover, which puts their explicit cover_media_id first. Rendering the
 * card off hero_node_id would show a creator a different picture from the one
 * their own cover strip says they chose.
 *
 * So the resolved cover is APPENDED as an extra row on a synthetic node, and
 * hero_node_id is pointed at that node. Nothing is rewritten: the original rows
 * keep their ids and their node_id, so a variant grid still finds its variants
 * and an evidence body still finds its evidence. The synthetic row shares the
 * real row's bucket and path, so it signs and renders as the same object.
 *
 * A cover of null appends nothing and clears hero_node_id, which is what puts
 * the card into the empty-imagery state the nudge sits beside.
 *
 * `position` is reassigned to the flattened index because the gallery orders a
 * build's nodes by that column alone, while a placed tree numbers them per
 * parent. Depth-first order IS reading order, so this makes the preview agree
 * with the page rather than disagreeing with it.
 */
function previewBuild(
  build: Build,
  tree: readonly NodeTree[],
  media: readonly BuildMedia[]
): { preview: GalleryBuild; cover: BuildMedia | null } {
  const placed = flatten(tree);

  const nodes: GalleryNode[] = placed.map((node, index) => ({
    id: node.id,
    type: node.type,
    title: node.title,
    payload: node.payload,
    position: index,
    is_gap: node.is_gap,
  }));

  const cover = resolveCover(build, tree, media);
  const rows: GalleryMedia[] = media.map(toGalleryMedia);
  if (cover) {
    rows.push({
      ...toGalleryMedia(cover),
      id: PREVIEW_COVER_MEDIA_ID,
      node_id: PREVIEW_COVER_NODE_ID,
    });
  }

  return {
    cover,
    preview: {
      id: build.id,
      creator_id: build.creator_id,
      slug: build.slug,
      title: build.title,
      outcome: build.outcome,
      shape: build.shape,
      status: build.status,
      made_for: build.made_for,
      made_with: build.made_with,
      live_url: build.live_url,
      repo_url: build.repo_url,
      hero_node_id: cover ? PREVIEW_COVER_NODE_ID : null,
      cover_media_id: build.cover_media_id,
      completeness: build.completeness,
      reproduction_count: build.reproduction_count,
      last_confirmed_at: build.last_confirmed_at,
      last_confirmed_model: build.last_confirmed_model,
      published_at: build.published_at,
      nodes,
      media: rows,
    },
  };
}

/** Put the creator in front of the cover strip, wherever it has scrolled to. */
function focusCoverStrip(): void {
  const strip = document.querySelector<HTMLElement>('[data-testid="cover-strip"]');
  if (strip && typeof strip.scrollIntoView === "function") {
    strip.scrollIntoView({ block: "center" });
  }
  const drop = document.querySelector<HTMLElement>('[data-testid="cover-drop"]');
  // The band is a button when empty and a thumbnail with two controls when
  // filled; either way the first focusable inside it is the thing to land on.
  const target = drop?.querySelector<HTMLElement>("button, input:not([type=file])");
  (target ?? drop)?.focus?.();
}

/** The Description field the card's own description line is rendered from. */
function focusOutcome(): void {
  const input = document.querySelector<HTMLInputElement>('[data-testid="outcome-input"]');
  if (!input) return;
  input.scrollIntoView?.({ block: "center" });
  input.focus();
  input.select?.();
}

export interface PublishSheetProps {
  build: Build;
  /** The PLACED tree. Tray nodes are not part of the record, or of the card. */
  tree: NodeTree[];
  /** Computed once by the hook; this sheet never computes a second answer. */
  completeness: Completeness | null;
  /**
   * PublishControl's answer, unchanged. This sheet gates its primary action on
   * it and derives nothing of its own: the publish gate is not this file's.
   */
  readiness: PublishReadiness;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs the publish path PublishControl already owns. */
  onConfirm: () => void;
  isPublishing: boolean;
  publishError: Error | null;
  /**
   * EXTENSION SLOT — rendered between the checklist and the primary action.
   *
   * Nothing is passed today. NS-P39 (the rebuild variant) and NS-P51 (the
   * bounty option) hang their own sections here so that neither has to reopen
   * this file's layout to add one.
   */
  sections?: ReactNode;
  /**
   * A checklist row that is neither the description nor the cover, handed back
   * to the workspace to resolve — it is the only thing that can select a node
   * or open the panel a header field is edited in. Optional: without it those
   * rows simply close the sheet.
   */
  onFocusRequirement?: (key: RequirementKey) => void;
}

export function PublishSheet({
  build,
  tree,
  completeness,
  readiness,
  open,
  onOpenChange,
  onConfirm,
  isPublishing,
  publishError,
  sections,
  onFocusRequirement,
}: PublishSheetProps) {
  const narrow = useIsNarrow();
  const media = useComposeMedia();

  /**
   * Where focus goes once the sheet has finished closing.
   *
   * A ref rather than state because it is read inside onCloseAutoFocus, which
   * Radix fires while the content is being torn down — and because setting it
   * must never cost a render of a surface that is on its way out.
   */
  const deepLink = useRef<(() => void) | null>(null);

  const { preview, cover } = useMemo(
    () => previewBuild(build, tree, media?.media ?? []),
    [build, tree, media?.media]
  );

  // The same signing call the gallery page makes, over the same rows: one
  // request for the whole card rather than one per image.
  const rows = useMemo(() => cardMedia(preview), [preview]);
  const srcByPath = useSignedMedia(rows);

  const isLive = build.status === "published" || build.status === "gallery";
  const canPublish = (readiness.ready || isLive) && !isPublishing;
  const missing = completeness?.missing ?? [];
  const blocking = useMemo(
    () => new Set(readiness.blocking.map((item) => item.key)),
    [readiness.blocking]
  );

  /** Close, then land focus on the thing that would tick this row. */
  const goTo = useCallback(
    (run: () => void) => {
      deepLink.current = run;
      onOpenChange(false);
      // Belt and braces: onCloseAutoFocus is the reliable moment, but a close
      // that never fires it (an unmount from above) still lands focus.
      window.setTimeout(() => {
        const pending = deepLink.current;
        deepLink.current = null;
        pending?.();
      }, 0);
    },
    [onOpenChange]
  );

  const onRow = useCallback(
    (key: RequirementKey) => {
      if (key === "outcome") {
        goTo(focusOutcome);
        return;
      }
      goTo(() => onFocusRequirement?.(key));
    },
    [goTo, onFocusRequirement]
  );

  const column: CSSProperties = {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: narrow ? 16 : 20,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-visual-slot="modal-surface"
        data-testid="publish-sheet"
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          const pending = deepLink.current;
          if (!pending) return;
          // Radix would put focus back on the trigger pill in the top bar,
          // which is the one place a creator who just asked to be taken
          // somewhere does not want to be.
          event.preventDefault();
          deepLink.current = null;
          pending();
        }}
        style={{
          ...panelGlass,
          color: TEXT_PRIMARY,
          fontFamily: FONT_STACK,
          padding: 0,
          gap: 0,
          overflow: "hidden",
          ...(narrow
            ? {
                // Full height, card above checklist.
                inset: 0,
                left: 0,
                top: 0,
                transform: "none",
                width: "100vw",
                maxWidth: "100vw",
                height: "100%",
                maxHeight: "100%",
                borderRadius: 0,
                display: "flex",
                flexDirection: "column",
              }
            : {
                width: "min(940px, calc(100vw - 40px))",
                // Said inline rather than unclamping the base surface's own
                // max-width with a utility class: an inline value wins
                // outright, and nothing here then depends on class ordering.
                maxWidth: "min(940px, calc(100vw - 40px))",
                maxHeight: "min(84vh, 760px)",
                borderRadius: 16,
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 360px)",
              }),
        }}
      >
        {/* Radix requires a title; the sheet's own headings are the labels
            beside each half, so this one is for screen readers only. */}
        <DialogTitle
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        >
          Publish {build.title?.trim() || "this build"}
        </DialogTitle>

        {/* ------------------------------------------------ the card, live */}
        <div
          style={{
            ...column,
            borderRight: narrow ? "none" : `1px solid ${HAIRLINE}`,
            borderBottom: narrow ? `1px solid ${HAIRLINE}` : "none",
            // The base surface's close control sits absolutely in the top
            // right; on one column that corner belongs to this column.
            paddingRight: narrow ? 44 : undefined,
            flexShrink: narrow ? 0 : undefined,
            overflowY: "auto",
          }}
        >
          <span style={{ ...labelText, textTransform: "uppercase", color: TEXT_MUTED }}>
            {CARD_LABEL}
          </span>

          <div
            data-testid="publish-card-preview"
            // A preview, not a link. React Router checks defaultPrevented
            // before it navigates, so this stops the card carrying a creator
            // off to /b2/:slug by mouse or by keyboard alike.
            onClickCapture={(event) => event.preventDefault()}
            style={{ maxWidth: 420, width: "100%" }}
          >
            <GalleryCard build={preview} srcByPath={srcByPath} />
          </div>

          {cover ? null : (
            <button
              type="button"
              onClick={() => goTo(focusCoverStrip)}
              style={{
                ...bodyText,
                fontFamily: "inherit",
                textAlign: "left",
                maxWidth: 420,
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${hexToRgba(ORANGE, 0.35)}`,
                background: hexToRgba(ORANGE, 0.08),
                color: TEXT_PRIMARY,
                cursor: "pointer",
              }}
            >
              {COVER_NUDGE}
            </button>
          )}
        </div>

        {/* --------------------------------------- what is left, in plain words */}
        <div style={{ ...column, flex: narrow ? 1 : undefined, minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ ...labelText, textTransform: "uppercase", color: TEXT_MUTED }}>
              {CHECKLIST_LABEL}
            </span>

            {missing.length === 0 ? (
              <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY }}>{NOTHING_LEFT}</p>
            ) : (
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                {missing.map((item) => (
                  <ChecklistRow
                    key={item.key}
                    item={item}
                    blocks={blocking.has(item.key)}
                    onClick={() => onRow(item.key)}
                  />
                ))}
              </ul>
            )}

            {/* EXTENSION SLOT — NS-P39 and NS-P51 land here. */}
            {sections}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
            {publishError ? (
              <p role="alert" style={{ ...bodyText, margin: 0, fontSize: 12, color: GAP_RED }}>
                {publishError.message}
              </p>
            ) : !canPublish && readiness.reason ? (
              <p style={{ ...bodyText, margin: 0, fontSize: 12, color: TEXT_SECONDARY }}>
                {readiness.reason}
              </p>
            ) : null}

            {/* VISUAL SLOT — the primary button surface is supplied externally.
                Structure only here: pill geometry, states, no surface. */}
            <span data-visual-slot="btn-primary" style={{ display: "flex" }}>
              <button
                type="button"
                data-testid="publish-confirm"
                disabled={!canPublish}
                onClick={onConfirm}
                style={{
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 500,
                  letterSpacing: "0.04em",
                  width: "100%",
                  height: 38,
                  borderRadius: 100,
                  border: `1px solid ${
                    canPublish ? hexToRgba(ORANGE, 0.45) : "rgba(255,255,255,0.06)"
                  }`,
                  background: canPublish
                    ? hexToRgba(ORANGE, 0.14)
                    : "rgba(255,255,255,0.025)",
                  color: canPublish ? TEXT_PRIMARY : TEXT_MUTED,
                  cursor: canPublish ? "pointer" : "not-allowed",
                  opacity: isPublishing ? 0.7 : 1,
                }}
              >
                {isPublishing ? "Publishing…" : "Publish"}
              </button>
            </span>

            <span style={{ ...bodyText, fontSize: 12, color: TEXT_MUTED }}>
              {KEEP_EDITING}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One thing left to say, as an invitation.
 *
 * The sentence is signals.ts's, unedited: it is already written as something to
 * do rather than as a fault, and rewording it here would be a second voice
 * saying the same thing differently. What this adds is the quiet marker on the
 * rows that stand between the build and a live page — without it a creator
 * reading six identical-looking sentences beside a disabled button has no way
 * to tell which ones the button is waiting on.
 */
function ChecklistRow({
  item,
  blocks,
  onClick,
}: {
  item: MissingItem;
  blocks: boolean;
  onClick: () => void;
}) {
  return (
    <li style={{ margin: 0, padding: 0 }}>
      <button
        type="button"
        onClick={onClick}
        style={{
          ...bodyText,
          fontFamily: "inherit",
          width: "100%",
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          textAlign: "left",
          padding: "7px 8px",
          borderRadius: 8,
          background: "transparent",
          border: "1px solid transparent",
          color: TEXT_PRIMARY,
          cursor: "pointer",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 5,
            height: 5,
            marginTop: 8,
            borderRadius: 999,
            flexShrink: 0,
            background: blocks ? ORANGE : TEAL,
            opacity: blocks ? 1 : 0.5,
          }}
        />
        <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <span>{item.copy}</span>
          {blocks ? (
            <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED }}>
              needed to publish
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

export default PublishSheet;
