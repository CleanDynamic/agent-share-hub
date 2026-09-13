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
// nothing else. Publishing itself is still onConfirm's business. BG-P24 is a
// repaint: not one line of that gate is touched here.
//
// BG-P24 — THE GROUND IS `--bg` AND THERE IS NO GLASS ON IT.
//
// The kit's dialog panel is glass, which is right for a reading surface and
// wrong for this one. The theme draws the line by surface rather than by
// component: "reading surfaces have glass; working surfaces do not", and the
// authoring workspace is named in that sentence. This sheet is the last screen
// of the authoring workspace, so it takes the workspace's treatment — a flat
// `--bg` ground, `--line` hairlines, `--r-panel`, and `elevation.overlay` with
// the scrim the dialog already puts behind it. What carries the depth is the
// shadow and the scrim, not a blur.
//
// It also means the ONE blurred surface in view is none: a creator reading this
// sheet is looking at a card on a page, which is what they are about to make.
//
// ONE PRIMARY ACTION, AND IT IS `Publish`. Every other control on the sheet is
// quieter than it by a full step — the checklist rows are `--text2` sentences
// with an `--action` marker, the nudge is a line of `--action` text, and the
// close is the kit dialog's own ghost. `von-restorff-effect`: the thing that
// must be unmistakable is the thing nothing else is allowed to look like.
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
import { Button } from "@/components/ui/button";
import { UI_EASING, UI_MS } from "@/lib/theme/controls";
import { elevation } from "@/lib/theme/elevation";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import {
  body as bodyText,
  data as dataText,
  eyebrow as eyebrowText,
  label as labelText,
} from "@/lib/theme/type";

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
    // A video's still. The preview card renders it exactly as the gallery
    // does, so a creator sees the poster their card will lead with.
    poster_path: row.poster_path,
    duration: row.duration,
    // BG-P09: the card reads the post's arrangement off these two. BuildMedia
    // carries them, so the preview shows the thread the creator arranged rather
    // than a card that has forgotten about it.
    post_position: row.post_position,
    post_text: row.post_text,
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
      // The lineage columns the card reads (NS-P40). Copied through rather than
      // defaulted, so the preview shows what the row holds — including a
      // rebuild_count of 0, which is what a draft's own count truthfully is.
      parent_build_id: build.parent_build_id,
      rebuild_count: build.rebuild_count,
      rebuild_note: build.rebuild_note,
      source_title_at_fork: build.source_title_at_fork,
      source_handle_at_fork: build.source_handle_at_fork,
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

  /** The eyebrow over each half. 12px mono, uppercase, `--text2`. */
  const eyebrow: CSSProperties = { ...eyebrowText, color: t.text2 };

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
          /* THE KIT'S GLASS IS OVERRIDDEN HERE AND ONLY HERE. `dialogPanelStyle`
             spreads `--glass` plus a 16px backdrop blur, which is the right
             treatment for a reading surface and the wrong one for the last
             screen of the authoring workspace. `backdropFilter: "none"` is
             explicit rather than omitted, because the kit has already set it on
             this element and an omission would leave it standing. */
          background: t.bg,
          backdropFilter: "none",
          WebkitBackdropFilter: "none",
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: t.line,
          ...elevation.overlay,
          color: t.text,
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
                /* Square at the viewport edge: a rounded corner needs
                   something behind it, and full-bleed there is nothing. */
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
                borderRadius: r.panel,
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
            borderRight: narrow ? "none" : `1px solid ${t.line}`,
            borderBottom: narrow ? `1px solid ${t.line}` : "none",
            // The base surface's close control sits absolutely in the top
            // right; on one column that corner belongs to this column.
            paddingRight: narrow ? 44 : undefined,
            flexShrink: narrow ? 0 : undefined,
            overflowY: "auto",
          }}
        >
          <span style={eyebrow}>{CARD_LABEL}</span>

          <div
            data-testid="publish-card-preview"
            // A preview, not a link. React Router checks defaultPrevented
            // before it navigates, so this stops the card carrying a creator
            // off to /b2/:slug by mouse or by keyboard alike.
            onClickCapture={(event) => event.preventDefault()}
            style={{ maxWidth: 420, width: "100%" }}
          >
            {/* The preview carries the two frozen snapshot columns (see
                previewBuild above), so the card composes the credit here
                exactly as it will on the published page — which is what makes
                "exactly as the card will render it" a fact and not a promise
                (BG-P11). */}
            <GalleryCard build={preview} srcByPath={srcByPath} />
          </div>

          {/* THE EMPTY-IMAGERY NUDGE (BG-P24).
              The card above is already showing its own missing-cover state —
              GalleryCard's, unmodified, which is what a reader would actually
              see — so this adds the one thing that state cannot say: where to
              go and that it is worth going. A LINE IN `--action`, not a tinted
              panel: a filled box here would be a second thing competing with
              Publish for the eye, and the theme allows one primary per view.
              It closes the sheet and lands focus in the thread editor, which
              is the surface that holds the picture. */}
          {cover ? null : <CoverNudge onClick={() => goTo(focusCoverStrip)} />}
        </div>

        {/* --------------------------------------- what is left, in plain words */}
        <div style={{ ...column, flex: narrow ? 1 : undefined, minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={eyebrow}>{CHECKLIST_LABEL}</span>

            {missing.length === 0 ? (
              <p style={{ ...bodyText, margin: 0, color: t.text2 }}>{NOTHING_LEFT}</p>
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
            {/* WHY THE REASON IS HERE AND NOT IN A TOAST. A disabled control
                with its explanation somewhere else is a control that refuses
                without saying why, and a toast takes the sentence away again
                after four seconds — from the one reader who needed it longest.
                It sits against the button, in mono because it is a fact about
                the record rather than prose, and it stays for as long as the
                refusal does. */}
            {publishError ? (
              <p
                role="alert"
                data-testid="publish-error"
                style={{ ...dataText, margin: 0, color: t.catBreakage }}
              >
                {publishError.message}
              </p>
            ) : !canPublish && readiness.reason ? (
              <p data-testid="publish-blocked-reason" style={{ ...dataText, margin: 0, color: t.text2 }}>
                {readiness.reason}
              </p>
            ) : null}

            {/* THE ONE PRIMARY ACTION. The kit's own button rather than a
                hand-rolled surface: `--action` fill with an `--on-action`
                label, `--r-control`, and the kit's hover, press, focus and
                disabled states for free. It carries `data-visual-slot`
                itself, so the wrapper span that used to mark the slot is
                gone with the geometry it was marking. */}
            <Button
              type="button"
              data-testid="publish-confirm"
              disabled={!canPublish}
              onClick={onConfirm}
              style={{ width: "100%", opacity: isPublishing ? 0.7 : 1 }}
            >
              {isPublishing ? "Publishing…" : "Publish"}
            </Button>

            <span style={{ ...labelText, color: t.text2 }}>{KEEP_EDITING}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The invitation to add a picture, as one line of `--action`.
 *
 * A LINE AND NOT A PANEL (BG-P24). It was a bordered, tinted box, which on the
 * two-theme ground reads as a second call to action standing beside Publish —
 * and the theme allows one primary per view. What a creator needs here is the
 * fact that the card is missing its picture (the card above is already saying
 * that in its own missing-cover state) and somewhere to go about it. So this is
 * the somewhere: `--action`, underlined at rest because a link distinguished by
 * colour alone fails WCAG 1.4.1 and hover does not exist on a touch screen.
 */
function CoverNudge({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      data-testid="publish-cover-nudge"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...bodyText,
        alignSelf: "flex-start",
        maxWidth: 420,
        textAlign: "left",
        padding: 0,
        background: "transparent",
        /* Longhands, not `border: none`: a shorthand is dropped whole by
           jsdom's parser, so a unit test could not see that this line has no
           box around it — which is the claim the nudge is making. */
        borderWidth: 0,
        borderStyle: "none",
        color: t.action,
        textDecoration: "underline",
        textUnderlineOffset: 4,
        textDecorationThickness: hovered ? 2 : 1,
        cursor: "pointer",
        transition: `text-decoration-thickness ${UI_MS}ms ${UI_EASING}`,
      }}
    >
      {COVER_NUDGE}
    </button>
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
 *
 * BG-P24 — THE SENTENCE IS `--text2` AND THE AFFORDANCE IS `--action`.
 *
 * Both halves of that matter. `--text2` keeps a column of six invitations from
 * shouting over the one button that is the point of the sheet, and it is what
 * makes them read as things to do rather than as errors. The `--action` arrow
 * is what says each one is somewhere to GO: it is present at rest rather than
 * on hover, so the affordance survives a touch screen, and on hover the whole
 * row lifts to `--text` on a `--recess` ground so the target is unambiguous.
 *
 * The dot keeps the distinction it always carried — `--action` for a row the
 * button is waiting on, `--evidence` for one it is not — and stays aria-hidden,
 * because "orange bullet" adds nothing to a sentence a screen reader already
 * reads out. Colour is the fast read for the eye, never the only carrier.
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
  const [hovered, setHovered] = useState(false);

  return (
    <li style={{ margin: 0, padding: 0 }}>
      <button
        type="button"
        data-testid="publish-checklist-row"
        data-requirement={item.key}
        data-blocking={blocks ? "true" : "false"}
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          ...bodyText,
          width: "100%",
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          textAlign: "left",
          padding: "7px 8px",
          borderRadius: r.control,
          background: hovered ? t.recess : "transparent",
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "transparent",
          color: t.text2,
          cursor: "pointer",
          transition: `background ${UI_MS}ms ${UI_EASING}, color ${UI_MS}ms ${UI_EASING}`,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 5,
            height: 5,
            marginTop: 9,
            borderRadius: r.full,
            flexShrink: 0,
            background: blocks ? t.action : t.evidence,
            opacity: blocks ? 1 : 0.55,
          }}
        />
        <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ color: hovered ? t.text : t.text2 }}>
            {item.copy}{" "}
            {/* The affordance. Inside the sentence rather than floated to the
                right of it, so it reads as the end of the invitation and wraps
                with it instead of stranding itself on a narrow column. */}
            <span aria-hidden style={{ color: t.action, whiteSpace: "nowrap" }}>
              →
            </span>
          </span>
          {blocks ? (
            <span style={{ ...dataText, color: t.text2 }}>needed to publish</span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

export default PublishSheet;
