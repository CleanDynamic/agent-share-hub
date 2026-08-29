// The Publish control, and the one screen a creator sees after using it.
//
// WHAT THIS CONTROL IS ALLOWED TO ASK FOR. Three things: a line saying what the
// build does for someone, one thing someone would run, one piece of evidence it
// worked. That is the whole gate. Cost, prerequisites, audience, links and
// every other field raise completeness and decide GALLERY PLACEMENT; none of
// them stands between a creator and a live page.
//
// WHAT THE CONFIRMATION IS NOT. A build below the gallery threshold has not
// been rejected, and nothing here says so. It is live, it is forkable, it is on
// its creator's profile, and the gallery is a further thing it can reach — the
// line names what would get it there, in the same instructing voice the
// completeness checklist uses. "Not good enough" is not a sentence this file
// is permitted to imply.
//
// WHAT THE PRESS NOW DOES. Since NS-P29 the pill is a TRIGGER, not the write.
// It opens PublishSheet, which shows the creator the card the feed will render
// from what they have so far and what is left to say beside it; the write
// happens when they press Publish in there. The gate is untouched and is still
// computed here — what moved is only where it is enforced, because a control
// that refused to open would hide the checklist from the builds that need it.
//
// WHAT SITS BETWEEN THE PRESS AND THE CONFIRMATION. Since NS-P23, one screen:
// the review pass, where a creator decides what NeoScale is allowed to say
// about their build. It is offered, never imposed — it appears only when there
// is something unreviewed to show, it is asked once per workspace session, and
// both of its controls publish. Escape is the only way out that does not, and
// it says so on the screen. PUBLICATION IS NEVER BLOCKED BY IT: a layers read
// that fails, a build with nothing placed, a creator who declined this exact
// record before — each of those publishes on the first press with no screen at
// all.
//
// WHAT A REBUILD ADDS (NS-P39). One section in the sheet's slot, and one extra
// rule on the sheet's Publish. The section is the diff — the change lines are
// the content of a rebuild, and the note beneath them is optional gloss. The
// rule is rebuild.ts's: a fork published untouched is a duplicate of somebody
// else's page carrying their credit, so the platform declines to call it a
// rebuild, in that gate's own sentence, inline beside the button.
//
// THE PILL IS DELIBERATELY UNCHANGED BY THAT RULE. NS-P38 put "no changes yet"
// in the top bar an inch away from it, so a creator meets the requirement while
// they work rather than as news at the moment they try to post; a second, later
// refusal painted onto the pill would be the same fact said twice.
//
// WHAT A DRAFT WITH GAPS ADDS (NS-P51). A second section in the sheet's slot,
// and a step AFTER the publish write rather than a condition on it. The section
// prices the holes; the step files them as bounties once the build is live.
//
// PUBLISHING IS NEVER ROLLED BACK BY A BOUNTY THAT DID NOT FILE, and the order
// of operations here exists to make that structurally true rather than merely
// intended. The publish write lands first and its confirmation is shown before
// a single bounty is attempted, so there is no moment at which the sheet is
// holding a live build hostage to a second write. A bounty that fails is a row
// missing from a board — the build is public, its page is correct, the gap is
// still marked unsolved on it, and the only thing lost is the ask. The creator
// is told exactly that, in one sentence, with a retry that re-files only the
// ones that failed. Nothing in this file deletes or unpublishes a build because
// createBountyForGap returned an error, and nothing in it ever should: an
// un-publish is a broken link and a lost post to pay for a missing row.
//
// Styled with inline style objects like everything else on this route:
// Tailwind's generated utilities win over hand-written classes at build time.

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useBuildLayers } from "@/hooks/useBuildLayers";
import { LayerReview, type LayerReviewResult } from "@/components/compose/LayerReview";
import { RebuildSection } from "@/components/compose/RebuildSection";
import {
  BountyOutcome,
  BountySection,
  DEFAULT_GAP_DRAFT,
  closesAtFrom,
  parseReward,
  type GapDraft,
} from "@/components/compose/BountySection";
import { rebuildCreditLine } from "@/components/build/rebuildCredit";
import type { RebuildDiff } from "@/hooks/useRebuildDiff";
import type { BuildBounties } from "@/hooks/useBuildBounties";
import { createBountyForGap, type Bounty } from "@/lib/bounty";
import {
  NO_CHANGES_REASON,
  collectGaps,
  galleryShortfall,
  galleryThreshold,
  publishReadiness,
  readinessFrom,
  rebuildReadiness,
  type Build,
  type ChangeLine,
  type Completeness,
  type MissingItem,
  type NodeTree,
  type NodeType,
  type PublishReadiness,
  type RequirementKey,
} from "@/lib/build";
import {
  GAP_RED,
  HAIRLINE,
  ORANGE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  bodyText,
  cardGlass,
  headingText,
  hexToRgba,
  labelText,
  panelGlass,
  titleText,
} from "@/components/build/tokens";

/**
 * The sheet is the heaviest thing on this route that most presses never reach:
 * it pulls in the gallery card and its five bodies. Split out, so the workspace
 * pays for it at the moment a creator asks to see their post rather than on
 * every load of /compose.
 */
const PublishSheet = lazy(() =>
  import("@/components/compose/PublishSheet").then((module) => ({
    default: module.PublishSheet,
  }))
);

export interface PublishControlProps {
  build: Build;
  /** The PLACED tree. Tray nodes are not part of the record. */
  tree: NodeTree[];
  nodeTypes: NodeType[];
  /** Computed once by the hook; this control never computes a second answer. */
  completeness: Completeness | null;
  /**
   * The workspace's publish path. The optional note is the rebuild variant —
   * see useComposeBuild. An ordinary draft is published with no argument.
   */
  onPublish: (rebuildNote?: string | null) => Promise<Build>;
  isPublishing: boolean;
  publishError: Error | null;
  /**
   * A checklist row in the sheet that needs the workspace to resolve it — a
   * node to select or create, or a header field whose only editor is in the
   * right rail. Optional; without it those rows only close the sheet.
   */
  onFocusRequirement?: (key: RequirementKey) => void;
  /**
   * What the workspace knows about being a rebuild (NS-P38's hook).
   *
   * Absent, or carrying isRebuild: false, on an ordinary draft — which renders
   * exactly the control and exactly the sheet that were here before NS-P39.
   */
  rebuild?: RebuildDiff;
  /**
   * The asks already filed on this build (NS-P51).
   *
   * Absent on a caller that has not read them, which renders exactly the
   * control and exactly the sheet that were here before — a draft with gaps
   * then simply offers no bounty section rather than offering one that cannot
   * tell which gaps are already spoken for.
   */
  bounties?: BuildBounties;
}

/** Stable identity for a control mounted without the hook's answer. */
const NO_LINES: ChangeLine[] = [];
/** The same, for a control mounted without the bounties read. */
const NO_FILED: Map<string, Bounty> = new Map();

/** One gap, resolved from its draft into the arguments a bounty is filed with. */
interface BountyPlanItem {
  nodeId: string;
  /** For the failure sentence, which is read by someone, not by a machine. */
  title: string;
  rewardGbp: number | null;
  closesAt: string | null;
}

const controlBase: React.CSSProperties = {
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.04em",
  height: 30,
  padding: "0 14px",
  borderRadius: 100,
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(255,255,255,0.06)",
  color: TEXT_SECONDARY,
  cursor: "pointer",
};

export function PublishControl({
  build,
  tree,
  nodeTypes,
  completeness,
  onPublish,
  isPublishing,
  publishError,
  onFocusRequirement,
  rebuild,
  bounties,
}: PublishControlProps) {
  const [confirmation, setConfirmation] = useState<Build | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  /**
   * The rebuild note, as a local draft.
   *
   * NOT written through patchBuild as it is typed, and that is the point: a
   * note is what a creator decides to say at the moment they post, and a column
   * saved per keystroke on a draft that may never be published is a sentence
   * they cannot take back by closing the sheet. It reaches the row in the same
   * statement that sets the status, and nowhere else. Seeded from the column so
   * that re-publishing a live rebuild opens on what it already says.
   */
  const [note, setNote] = useState(build.rebuild_note ?? "");
  /** Read inside publishNow, which the review pass captures a frame earlier. */
  const noteRef = useRef(note);
  noteRef.current = note;

  /**
   * What each gap is being offered for, as local drafts.
   *
   * Held here for exactly the reason the rebuild note is: these are decisions a
   * creator makes at the moment they post, and writing them per keystroke onto
   * a build that may never be published would be a price they cannot take back
   * by closing the sheet. They reach the database once, as bounty rows, after
   * the build is live.
   */
  const [gapDrafts, setGapDrafts] = useState<Record<string, GapDraft>>({});
  const [skipBounties, setSkipBounties] = useState(false);
  /** How the filing went, for the confirmation screen. */
  const [filing, setFiling] = useState(false);
  const [filedCount, setFiledCount] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [failedItems, setFailedItems] = useState<BountyPlanItem[]>([]);

  const gaps = useMemo(() => collectGaps(tree), [tree]);
  const filedByNode = bounties?.byNode ?? NO_FILED;
  const typesByKey = useMemo(
    () => new Map(nodeTypes.map((type) => [type.key, type])),
    [nodeTypes]
  );

  /**
   * The gaps that will be filed, resolved from their drafts.
   *
   * A gap that already carries an ask is not in here whatever its draft says:
   * one bounty per gap is a unique index, and filing a second is a refusal the
   * creator did nothing to earn. Nor is anything at all when the switch is on.
   */
  const plan = useMemo<BountyPlanItem[]>(() => {
    if (skipBounties) return [];
    return gaps
      .filter((gap) => !filedByNode.has(gap.id))
      .map((gap) => ({ gap, draft: gapDrafts[gap.id] ?? DEFAULT_GAP_DRAFT }))
      .filter(({ draft }) => draft.ticked)
      .map(({ gap, draft }) => ({
        nodeId: gap.id,
        title: gap.title || `Untitled ${typesByKey.get(gap.type)?.label ?? gap.type}`,
        rewardGbp: parseReward(draft.reward),
        closesAt: closesAtFrom(draft.deadline),
      }));
  }, [filedByNode, gapDrafts, gaps, skipBounties, typesByKey]);

  /** publishNow reads the plan a frame after the sheet closed; a ref, not a
   *  dependency, so the publish callback does not change on every keystroke. */
  const planRef = useRef<BountyPlanItem[]>(plan);
  planRef.current = plan;

  const patchGapDraft = useCallback((nodeId: string, patch: Partial<GapDraft>) => {
    setGapDrafts((current) => ({
      ...current,
      [nodeId]: { ...DEFAULT_GAP_DRAFT, ...current[nodeId], ...patch },
    }));
  }, []);

  /** The bounties read, invalidated after filing so the tree paints the pills. */
  const refreshBounties = bounties?.refresh;

  /**
   * File the asks, one at a time, and report what happened.
   *
   * SEQUENTIAL, not concurrent. This is a handful of inserts on a table with a
   * unique index on the gap, and running them in a row means a failure is
   * attributable to one gap by name — which is the whole content of the
   * sentence a creator reads afterwards. Concurrency here would buy a few
   * hundred milliseconds on a screen the creator has already been told is done.
   *
   * NOTHING IN HERE TOUCHES THE BUILD. It cannot fail the publish, because the
   * publish has already happened and its row is already live; see the header.
   */
  const fileBounties = useCallback(
    async (items: BountyPlanItem[]) => {
      if (items.length === 0) return;

      setFiling(true);
      setAttempted(items.length);
      const failed: BountyPlanItem[] = [];
      let landed = 0;

      for (const item of items) {
        try {
          await createBountyForGap({
            buildId: build.id,
            nodeId: item.nodeId,
            rewardGbp: item.rewardGbp,
            closesAt: item.closesAt,
          });
          landed += 1;
        } catch {
          // Rolled up into one sentence rather than surfaced one at a time: a
          // creator who has just published does not need three toasts, and the
          // message they do need is the same in every case.
          failed.push(item);
        }
      }

      setFiledCount((current) => current + landed);
      setFailedItems(failed);
      setFiling(false);
      // Even a partial round changed the board, so the tree is re-read either
      // way — the pills that did land should appear.
      if (refreshBounties) await refreshBounties().catch(() => {});
    },
    [build.id, refreshBounties]
  );

  /** The spec is the column, not the hook: a draft with a parent is a rebuild
   *  whether or not its source is still readable. */
  const isRebuild = Boolean(build.parent_build_id);

  // The layers this build already has, shared with the staleness line through
  // one react-query key rather than read twice.
  const { hash, ensure, shouldOffer, applyLayers } = useBuildLayers(build.id, tree);

  /**
   * Asked once per workspace session.
   *
   * A creator who has answered — either way — is publishing from here on. The
   * answer itself is remembered further down: approving writes the rows,
   * declining is remembered against this record's hash, and both outlive the
   * session. This ref is only what stops a second press in the same minute
   * from asking again.
   */
  const asked = useRef(false);

  // The hook has already computed this record's completeness, memoised on the
  // same inputs. Deriving readiness from it keeps the bar off the tree on every
  // keystroke of the title; the second branch is for a caller without one.
  const readiness = completeness
    ? readinessFrom(completeness)
    : publishReadiness(build, tree, nodeTypes);
  const isLive = build.status === "published" || build.status === "gallery";

  /**
   * THE GATE, UNCHANGED. The same expression this control has always used, and
   * still the only thing that decides whether a build may be written live. What
   * moved in NS-P29 is where it is enforced: it now sits on the sheet's Publish
   * rather than on this pill, so a creator whose record is short can still open
   * the sheet, see the post they are working towards, and read what is left.
   * Refusing to open it would hide the checklist from exactly the builds it was
   * written for.
   */
  const canPublish = (readiness.ready || isLive) && !isPublishing;

  /**
   * The one extra thing a rebuild is asked, from rebuild.ts.
   *
   * Memoised on the SETTLED pair the diff itself was computed from, so the
   * tree walk inside it happens on the save beat rather than on the keystroke
   * of a title — the same reason readinessFrom exists above.
   */
  const rebuildGate = useMemo<PublishReadiness | null>(() => {
    if (!isRebuild) return null;
    const source = rebuild?.source;
    const draft = rebuild?.draft;
    const changes = rebuild?.changes;
    // No source means no diff, and no diff means nothing can be PROVEN
    // unchanged. Publishing is never blocked on a question we cannot ask.
    if (!source || !draft || !changes) return null;
    return rebuildReadiness(source, draft, changes);
  }, [isRebuild, rebuild?.changes, rebuild?.draft, rebuild?.source]);

  /**
   * What the sheet gates on: the live base requirements, plus the divergence
   * rule.
   *
   * The two are taken from different places on purpose. `readiness` is derived
   * from the completeness the hook recomputes on every edit, so it answers
   * about THIS keystroke; rebuildGate re-tests the same base requirements
   * against the settled snapshot, which lags it by the save debounce. Letting
   * the stale copy speak would have a creator who has just typed their outcome
   * line read a complaint about not having typed it. So the base gate stays
   * live, and rebuildGate is consulted only for the rule it alone knows —
   * recognised by the reason it is exported with rather than re-derived here.
   */
  const sheetReadiness =
    readiness.ready && rebuildGate?.reason === NO_CHANGES_REASON
      ? rebuildGate
      : readiness;

  /** Frozen at the fork, and rendered by the card exactly as it reads here. */
  const credit = isRebuild ? rebuildCreditLine(build) : null;

  /** The pill only opens a sheet, so nothing but a write in flight closes it. */
  const canOpen = !isPublishing;

  const label = isPublishing ? "Publishing…" : isLive ? "Published" : "Publish";

  const explanation = publishError
    ? publishError.message
    : readiness.reason
      ? readiness.reason
      : isLive
        ? "Live. Open the link, and see what would put it in the gallery."
        : "Put this in front of readers. It stays yours to edit.";

  const publishNow = useCallback(() => {
    // A rebuild passes its note — null included, which is a real answer — and
    // takes rebuild.ts's publish path. An ordinary draft passes nothing and
    // takes the path it always has.
    void (isRebuild ? onPublish(noteRef.current) : onPublish())
      .then((row) => {
        // The confirmation FIRST, and then the bounties. The build is live at
        // this line and the creator is told so at this line; what follows can
        // fail without any of that becoming untrue. See the header.
        setConfirmation(row);
        setFiledCount(0);
        setFailedItems([]);
        void fileBounties(planRef.current);
      })
      .catch(() => {
        /* surfaced through publishError, on the control itself */
      });
  }, [fileBounties, isRebuild, onPublish]);

  /**
   * The publish path, exactly as it was: the review pass if there is something
   * unreviewed to show, otherwise straight to the write. Reached from the
   * sheet's Publish now rather than from the pill, and otherwise untouched.
   */
  const startPublish = useCallback(() => {
    if (asked.current) {
      publishNow();
      return;
    }

    // The rows first, so a creator who publishes the second the workspace
    // opens is asked the same question as one who has been editing for ten
    // minutes. A read that fails publishes rather than blocking: this feature
    // is not allowed to stand between a creator and a live page.
    void ensure()
      .then((rows) => {
        if (!shouldOffer(rows)) {
          publishNow();
          return;
        }
        asked.current = true;
        setReviewing(true);
      })
      .catch(() => publishNow());
  }, [ensure, publishNow, shouldOffer]);

  /**
   * The sheet's primary action. It closes first: the review pass is a second
   * modal, and two stacked overlays is not a thing a creator should have to
   * read their way out of.
   */
  const confirm = useCallback(() => {
    setSheetOpen(false);
    startPublish();
  }, [startPublish]);

  /** Either control on the review pass: write what it decided, then publish. */
  const onReviewed = useCallback(
    (result: LayerReviewResult) => {
      // Generated first, written over the top: a layer the creator approved or
      // rewrote wins over the row it was generated from.
      applyLayers([...result.generated, ...result.written]);
      setReviewing(false);
      publishNow();
    },
    [applyLayers, publishNow]
  );

  return (
    <>
      <Tooltip>
        {/* A disabled button fires no pointer events, so the span carries them. */}
        <TooltipTrigger asChild>
          {/* VISUAL SLOT — the primary button surface is supplied externally.
              Structure only here: pill geometry, states, no surface. */}
          <span
            data-visual-slot="btn-primary"
            style={{ display: "inline-flex", flexShrink: 0 }}
          >
            <button
              type="button"
              disabled={!canOpen}
              onClick={() => setSheetOpen(true)}
              style={{
                ...controlBase,
                whiteSpace: "nowrap",
                color: publishError
                  ? GAP_RED
                  : isLive
                    ? TEAL
                    : canOpen
                      ? TEXT_PRIMARY
                      : TEXT_MUTED,
                // The accent is still the readiness signal: armed when the
                // record clears the gate, quiet while it does not.
                borderColor: publishError
                  ? hexToRgba(GAP_RED, 0.35)
                  : isLive
                    ? hexToRgba(TEAL, 0.35)
                    : canPublish
                      ? hexToRgba(ORANGE, 0.45)
                      : "rgba(255,255,255,0.06)",
                background: publishError
                  ? hexToRgba(GAP_RED, 0.1)
                  : isLive
                    ? hexToRgba(TEAL, 0.1)
                    : canPublish
                      ? hexToRgba(ORANGE, 0.14)
                      : "rgba(255,255,255,0.025)",
                cursor: canOpen ? "pointer" : "not-allowed",
                pointerEvents: canOpen ? "auto" : "none",
                opacity: isPublishing ? 0.7 : 1,
              }}
            >
              {label}
            </button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">{explanation}</TooltipContent>
      </Tooltip>

      {sheetOpen ? (
        <Suspense fallback={null}>
          <PublishSheet
            build={build}
            tree={tree}
            completeness={completeness}
            readiness={sheetReadiness}
            open
            onOpenChange={setSheetOpen}
            onConfirm={confirm}
            isPublishing={isPublishing}
            publishError={publishError}
            credit={credit}
            // Both sections can apply at once: a rebuild is allowed to leave a
            // hole in what it rebuilt. Undefined when neither does, so a plain
            // draft passes the sheet exactly what it passed before NS-P51.
            sections={
              isRebuild || gaps.length > 0 ? (
                <>
                  {isRebuild ? (
                    <RebuildSection
                      lines={rebuild?.lines ?? NO_LINES}
                      // A diff, rather than an empty one. See RebuildSection.
                      diffed={Boolean(rebuild?.changes)}
                      note={note}
                      onNoteChange={setNote}
                      credit={credit}
                    />
                  ) : null}
                  {gaps.length > 0 ? (
                    <BountySection
                      gaps={gaps}
                      typesByKey={typesByKey}
                      filedByNode={filedByNode}
                      drafts={gapDrafts}
                      onDraftChange={patchGapDraft}
                      skip={skipBounties}
                      onSkipChange={setSkipBounties}
                    />
                  ) : null}
                </>
              ) : undefined
            }
            onFocusRequirement={onFocusRequirement}
          />
        </Suspense>
      ) : null}

      {reviewing ? (
        <LayerReview
          buildId={build.id}
          hash={hash}
          onResolve={onReviewed}
          // Escape: nothing written, nothing published, the control goes back
          // to saying Publish. The next press asks again.
          onCancel={() => {
            asked.current = false;
            setReviewing(false);
          }}
        />
      ) : null}

      {confirmation ? (
        <PublishConfirmation
          build={confirmation}
          completeness={completeness}
          onClose={() => setConfirmation(null)}
          bounties={
            <BountyOutcome
              filed={filedCount}
              failedTitles={failedItems.map((item) => item.title)}
              attempted={attempted}
              busy={filing}
              onRetry={() => void fileBounties(failedItems)}
            />
          }
        />
      ) : null}
    </>
  );
}

/**
 * What a creator sees the moment their build goes live.
 *
 * PORTALLED TO THE BODY, and not by preference. The compose top bar carries
 * backdropFilter, and a filtered element is the containing block for every
 * fixed-position descendant — a fixed overlay rendered inside the bar would be
 * trapped in a 52px-tall strip. The portal takes it out of that subtree.
 */
function PublishConfirmation({
  build,
  completeness,
  onClose,
  bounties,
}: {
  build: Build;
  completeness: Completeness | null;
  onClose: () => void;
  /**
   * What became of the asks this publish was carrying (NS-P51).
   *
   * Rendered between the link and the gallery line, because that is the order
   * the news matters in: it is live, here is where it is, here is what else
   * happened, here is what would put it in the gallery. Renders nothing when
   * there were no bounties to file, which is most publishes.
   */
  bounties?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const path = `/b2/${build.slug}`;
  const url =
    typeof window === "undefined" ? path : `${window.location.origin}${path}`;

  const score = completeness?.score ?? build.completeness ?? 0;
  const threshold = galleryThreshold(build.shape);
  const shortfall = galleryShortfall(
    build.shape,
    score,
    completeness?.missing ?? []
  );
  const promoted = build.status === "gallery";
  const inGalleryNow = promoted || score >= threshold;

  const copyLink = () => {
    void navigator.clipboard
      ?.writeText(url)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Your build is live"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(8,8,12,0.62)",
      }}
    >
      <div
        data-visual-slot="publish-confirmation"
        onClick={(event) => event.stopPropagation()}
        style={{
          ...panelGlass,
          width: "min(520px, 100%)",
          maxHeight: "100%",
          overflowY: "auto",
          borderRadius: 14,
          padding: 22,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h2 style={{ ...headingText, margin: 0 }}>It’s live.</h2>
          <span style={{ ...labelText, color: TEAL }}>
            {promoted ? "In the gallery" : "Published"}
          </span>
        </div>

        <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY }}>
          {build.title || "Your build"} is readable by anyone with the link, and
          anyone can fork it from any point in its sequence.
        </p>

        <div
          style={{
            ...cardGlass,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
          }}
        >
          <Link
            to={path}
            target="_blank"
            rel="noreferrer"
            style={{
              ...titleText,
              color: TEAL,
              textDecoration: "none",
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {path}
          </Link>
          <button
            type="button"
            onClick={copyLink}
            style={{
              ...labelText,
              fontFamily: "inherit",
              flexShrink: 0,
              height: 28,
              padding: "0 10px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.025)",
              border: `1px solid ${HAIRLINE}`,
              color: copied ? TEAL : TEXT_SECONDARY,
              cursor: "pointer",
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>

        {bounties}

        <GalleryLine
          inGalleryNow={inGalleryNow}
          promoted={promoted}
          shortfall={shortfall}
        />

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              ...labelText,
              fontFamily: "inherit",
              height: 30,
              padding: "0 14px",
              borderRadius: 100,
              background: "rgba(255,255,255,0.025)",
              border: `1px solid ${HAIRLINE}`,
              color: TEXT_SECONDARY,
              cursor: "pointer",
            }}
          >
            Back to the workspace
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * The one honest line about the gallery.
 *
 * Two states, and neither is a refusal. A build that clears the bar is told
 * where to find itself. A build that does not is told what it already is —
 * live, forkable, on its creator's profile — and then what would get it there,
 * as instructions rather than as a verdict.
 */
function GalleryLine({
  inGalleryNow,
  promoted,
  shortfall,
}: {
  inGalleryNow: boolean;
  promoted: boolean;
  shortfall: MissingItem[];
}) {
  if (inGalleryNow) {
    return (
      <div
        style={{
          ...cardGlass,
          padding: "12px 14px",
          borderLeft: `2px solid ${TEAL}`,
          background: hexToRgba(TEAL, 0.06),
        }}
      >
        <p style={{ ...bodyText, margin: 0 }}>
          {promoted
            ? "This build has been promoted to the gallery by an editor, and appears there whatever it scores."
            : "This record carries enough for the gallery."}{" "}
          <Link to="/gallery" style={{ color: TEAL, textDecoration: "none" }}>
            See it at /gallery →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        ...cardGlass,
        padding: "12px 14px",
        borderLeft: `2px solid ${ORANGE}`,
        background: hexToRgba(ORANGE, 0.05),
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <p style={{ ...bodyText, margin: 0 }}>
        It is live and forkable, and it sits on your profile. The{" "}
        <Link to="/gallery" style={{ color: TEAL, textDecoration: "none" }}>
          gallery
        </Link>{" "}
        asks for a little more of the record
        {shortfall.length > 0 ? ":" : "."}
      </p>
      {shortfall.length > 0 ? (
      <ul
        style={{
          ...bodyText,
          margin: 0,
          paddingLeft: 18,
          color: TEXT_SECONDARY,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {shortfall.map((item) => (
          <li key={item.key}>{item.copy}</li>
        ))}
      </ul>
      ) : null}
      <p style={{ ...bodyText, margin: 0, color: TEXT_MUTED, fontSize: 12 }}>
        Nothing is lost by leaving it as it is. Add these whenever you like and
        it joins the gallery on its own.
      </p>
    </div>
  );
}
