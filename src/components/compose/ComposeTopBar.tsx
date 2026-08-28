// The compose workspace's top bar.
//
// Title, shape, save state, the hero control, a way to see the build as a
// reader sees it, and the Publish control. Everything here is styled with
// inline style objects: Tailwind's generated utilities win over hand-written
// classes at build time, so a class would not survive the build.
//
// Publishing itself lives in PublishControl, which owns the readiness test and
// the confirmation screen. This bar hands it the record and gets out of the
// way.
//
// ON A REBUILD IT SAYS TWO MORE THINGS (NS-P38): who is being rebuilt, and how
// far from them this draft has moved. Both are quiet and both are permanent
// while the workspace is open — a creator working inside somebody else's build
// should never have to go looking for either fact, and the count in particular
// is what the publish gate will ask about, so meeting it here rather than in
// the sheet means it is never news.
//
// The credit line is a SIBLING of the bar rather than a second row inside it.
// The bar is a fixed 52px flex row and the panels below it are flex:1, so a new
// element between them is absorbed by the row below and nothing that already
// lays the workspace out changes — the same seam CoverStrip took in NS-P28.

import { useState } from "react";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PublishControl } from "@/components/compose/PublishControl";
import type { RebuildDiff } from "@/hooks/useRebuildDiff";
import type {
  Build,
  BuildPatch,
  BuildShape,
  Completeness,
  NodeTree,
  NodeType,
  RequirementKey,
} from "@/lib/build";
import {
  GAP_RED,
  HAIRLINE,
  ORANGE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  hexToRgba,
  labelText,
  panelGlass,
  titleText,
} from "@/components/build/tokens";

const TOP_BAR_HEIGHT = 52;

/**
 * The nine shapes, in the order the handover lists them.
 *
 * A build is never asked for its shape before it has content: it is created as
 * 'other' and this selector sits quietly in the bar. Classification is an
 * output of the record, not the first question put to the creator. Detecting
 * it from the nodes comes later; until then this is the placeholder.
 */
const BUILD_SHAPES: { value: BuildShape; label: string }[] = [
  { value: "app", label: "App" },
  { value: "agent", label: "Agent" },
  { value: "workflow", label: "Workflow" },
  { value: "prompt", label: "Prompt" },
  { value: "dataset", label: "Dataset" },
  { value: "study", label: "Study" },
  { value: "media", label: "Media" },
  { value: "technique", label: "Technique" },
  { value: "other", label: "Other" },
];

const controlBase: React.CSSProperties = {
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.04em",
  height: 30,
  padding: "0 10px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.025)",
  border: `1px solid rgba(255,255,255,0.06)`,
  color: TEXT_SECONDARY,
  cursor: "pointer",
};

interface ComposeTopBarProps {
  build: Build;
  isSaving: boolean;
  lastSavedAt: Date | null;
  saveError: Error | null;
  onPatch: (patch: BuildPatch) => void;
  /** Supplied only below the single-column breakpoint. */
  onOpenTray?: () => void;
  /** Supplied only below the single-column breakpoint. */
  onOpenInspector?: () => void;
  /** The node the inspector is showing. The hero control acts on this one. */
  selectedNodeId: string | null;
  /**
   * Whether that node can BE the hero: it resolves to uploaded media, or it is
   * a live app. Computed by the frame, which is inside the media context.
   */
  heroEligible: boolean;
  /** The PLACED tree, for the publish readiness test. */
  tree: NodeTree[];
  nodeTypes: NodeType[];
  /** The hook's answer. This bar does not compute a second one. */
  completeness: Completeness | null;
  onPublish: () => Promise<Build>;
  isPublishing: boolean;
  publishError: Error | null;
  /** Passed straight to PublishControl for the publish sheet's checklist. */
  onFocusRequirement?: (key: RequirementKey) => void;
  /**
   * What the workspace knows about being a rebuild. Absent, or carrying
   * isRebuild: false, on an ordinary draft — which renders exactly the bar that
   * was here before NS-P38.
   */
  rebuild?: RebuildDiff;
}

function SaveState({
  isSaving,
  lastSavedAt,
  saveError,
}: Pick<ComposeTopBarProps, "isSaving" | "lastSavedAt" | "saveError">) {
  const { text, colour } = saveError
    ? { text: "Not saved", colour: GAP_RED }
    : isSaving
      ? { text: "Saving…", colour: TEXT_SECONDARY }
      : lastSavedAt
        ? { text: "Saved", colour: TEAL }
        : { text: "Draft", colour: TEXT_MUTED };

  return (
    <span
      role="status"
      aria-live="polite"
      title={
        saveError
          ? saveError.message
          : lastSavedAt
            ? `Last saved at ${lastSavedAt.toLocaleTimeString()}`
            : undefined
      }
      style={{
        ...labelText,
        color: colour,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: colour,
          opacity: isSaving ? 0.5 : 1,
        }}
      />
      {text}
    </span>
  );
}

/**
 * How far this draft has moved from the build it was forked from.
 *
 * From serialiseChangeSet rather than changeCount, so the number the creator
 * watches all the way through is the number of LINES the record will show a
 * reader — a renamed build and two added steps are three things somebody will
 * read, and a count that ignored them would be smaller than the diff.
 *
 * Zero is not an error and is not styled as one. A rebuild opens at zero by
 * definition; the muted phrasing says "not yet" rather than "not allowed", and
 * the publish gate is where "a rebuild has to change something" belongs.
 */
function ChangeCount({ count }: { count: number }) {
  const none = count === 0;

  return (
    <span
      data-testid="rebuild-change-count"
      title={
        none
          ? "A rebuild has to change something before it can be published."
          : "What this rebuild changed about the build it came from."
      }
      style={{
        ...labelText,
        flexShrink: 0,
        whiteSpace: "nowrap",
        color: none ? TEXT_MUTED : TEAL,
      }}
    >
      {none ? "no changes yet" : `${count} change${count === 1 ? "" : "s"}`}
    </span>
  );
}

/**
 * The credit line, from the rebuilder's side.
 *
 * It reads the SNAPSHOT columns, not the live parent: parent_build_id is
 * ON DELETE SET NULL and a source can be renamed at any time, so a credit
 * resolved live is a credit the credited party can revoke. startRebuild froze
 * both at the fork (NS-P37) and this renders what it froze.
 *
 * The link is the one live part, and it is optional for the same reason
 * ForkAttribution's is: a link to a build that no longer resolves is worse than
 * the name on its own. A draft forked before those columns existed — or by the
 * replay's moment variant, which calls forkBuild directly — falls back to the
 * live parent's title, and renders nothing at all if that is gone too, because
 * "Rebuilding from" naming nobody claims a provenance no one can check.
 */
function RebuildOriginStrip({
  build,
  rebuild,
}: {
  build: Build;
  rebuild: RebuildDiff;
}) {
  const source = rebuild.source;
  const title = build.source_title_at_fork ?? source?.build.title ?? null;
  if (!title) return null;

  const handle = build.source_handle_at_fork;
  const slug = source?.build.slug ?? null;

  return (
    <div
      data-testid="rebuild-origin-strip"
      data-visual-slot="compose-rebuild-origin"
      style={{
        ...panelGlass,
        border: "none",
        borderBottom: `1px solid ${HAIRLINE}`,
        borderLeft: `2px solid ${hexToRgba(ORANGE, 0.5)}`,
        background: hexToRgba(ORANGE, 0.05),
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "6px 14px",
      }}
    >
      <span style={{ ...labelText, fontSize: 11, color: TEXT_SECONDARY }}>
        Rebuilding from{" "}
        {slug ? (
          <Link
            to={`/b2/${slug}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: ORANGE, textDecoration: "none" }}
          >
            {title}
          </Link>
        ) : (
          <span style={{ color: TEXT_PRIMARY }}>{title}</span>
        )}
        {handle ? ` by @${handle}` : null}
      </span>
    </div>
  );
}

/**
 * "Set as hero" for the selected node.
 *
 * The hero is one column on the build — builds.hero_node_id — and the build
 * page's header has read it since NS-P04. Nothing about that header changes
 * here: this control writes the column, the page resolves whatever it points
 * at, and a node with no media on it cannot be pointed at in the first place.
 *
 * Live app nodes qualify without media because the header renders those from
 * the build's live_url rather than from an upload.
 */
function HeroControl({
  heroNodeId,
  selectedNodeId,
  heroEligible,
  onPatch,
}: {
  heroNodeId: string | null;
  selectedNodeId: string | null;
  heroEligible: boolean;
  onPatch: (patch: BuildPatch) => void;
}) {
  const isHero = Boolean(selectedNodeId && heroNodeId === selectedNodeId);
  // Already the hero: clearing it must stay possible even for a node whose
  // media has since been removed.
  const enabled = Boolean(selectedNodeId) && (heroEligible || isHero);

  const explanation = !selectedNodeId
    ? "Select a node to make it the hero."
    : isHero
      ? "This node is the hero. Click to clear it."
      : heroEligible
        ? "Lead the build page with this node's media."
        : "A hero is a node carrying media, or a live app.";

  return (
    <Tooltip>
      {/* A disabled button fires no pointer events, so the span carries them. */}
      <TooltipTrigger asChild>
        <span style={{ display: "inline-flex", flexShrink: 0 }}>
          <button
            type="button"
            disabled={!enabled}
            aria-pressed={isHero}
            onClick={() =>
              onPatch({ hero_node_id: isHero ? null : selectedNodeId })
            }
            style={{
              ...controlBase,
              whiteSpace: "nowrap",
              color: isHero ? TEAL : enabled ? TEXT_SECONDARY : TEXT_MUTED,
              borderColor: isHero ? "rgba(46,196,182,0.35)" : "rgba(255,255,255,0.06)",
              background: isHero ? "rgba(46,196,182,0.10)" : "rgba(255,255,255,0.025)",
              cursor: enabled ? "pointer" : "not-allowed",
              pointerEvents: enabled ? "auto" : "none",
            }}
          >
            {isHero ? "Hero" : "Set as hero"}
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{explanation}</TooltipContent>
    </Tooltip>
  );
}

export function ComposeTopBar({
  build,
  isSaving,
  lastSavedAt,
  saveError,
  onPatch,
  onOpenTray,
  onOpenInspector,
  selectedNodeId,
  heroEligible,
  tree,
  nodeTypes,
  completeness,
  onPublish,
  isPublishing,
  publishError,
  onFocusRequirement,
  rebuild,
}: ComposeTopBarProps) {
  // Inline styles cannot express :focus, so the focus treatment is state.
  const [titleFocused, setTitleFocused] = useState(false);

  // The count waits for the diff rather than guessing at it. A rebuild whose
  // source is still loading — or has been unpublished since the fork — shows no
  // number, because "no changes yet" on an uncomputed diff is a claim, not a
  // blank.
  const isRebuild = Boolean(rebuild?.isRebuild);

  return (
    <>
    <header
      data-visual-slot="compose-top-bar"
      style={{
        ...panelGlass,
        border: "none",
        borderBottom: `1px solid ${HAIRLINE}`,
        height: TOP_BAR_HEIGHT,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 14px",
      }}
    >
      <Link
        to="/"
        style={{ ...labelText, color: TEXT_SECONDARY, textDecoration: "none", flexShrink: 0 }}
      >
        ← NeoScale
      </Link>

      <span aria-hidden style={{ width: 1, height: 20, background: HAIRLINE, flexShrink: 0 }} />

      <input
        aria-label="Build title"
        value={build.title ?? ""}
        onChange={(event) => onPatch({ title: event.target.value })}
        onFocus={() => setTitleFocused(true)}
        onBlur={() => setTitleFocused(false)}
        placeholder="Untitled build"
        spellCheck={false}
        style={{
          ...titleText,
          fontFamily: "inherit",
          flex: 1,
          minWidth: 80,
          height: 32,
          padding: "0 8px",
          borderRadius: 8,
          outline: "none",
          background: titleFocused ? "rgba(255,255,255,0.04)" : "transparent",
          border: `1px solid ${titleFocused ? "rgba(255,255,255,0.12)" : "transparent"}`,
          color: TEXT_PRIMARY,
          transition: "background 120ms ease, border-color 120ms ease",
        }}
      />

      <select
        aria-label="Build shape"
        value={(build.shape as BuildShape) ?? "other"}
        onChange={(event) => onPatch({ shape: event.target.value as BuildShape })}
        style={{
          ...controlBase,
          flexShrink: 0,
          // Renders the native option list dark rather than system white.
          colorScheme: "dark",
        }}
      >
        {BUILD_SHAPES.map((shape) => (
          <option key={shape.value} value={shape.value}>
            {shape.label}
          </option>
        ))}
      </select>

      {onOpenTray && (
        <button type="button" onClick={onOpenTray} style={{ ...controlBase, flexShrink: 0 }}>
          Tray
        </button>
      )}
      {onOpenInspector && (
        <button type="button" onClick={onOpenInspector} style={{ ...controlBase, flexShrink: 0 }}>
          Inspector
        </button>
      )}

      <HeroControl
        heroNodeId={build.hero_node_id}
        selectedNodeId={selectedNodeId}
        heroEligible={heroEligible}
        onPatch={onPatch}
      />

      <SaveState isSaving={isSaving} lastSavedAt={lastSavedAt} saveError={saveError} />

      {isRebuild && rebuild?.changes ? <ChangeCount count={rebuild.lines.length} /> : null}

      <Link
        to={`/b2/${build.slug}`}
        target="_blank"
        rel="noreferrer"
        style={{ ...controlBase, flexShrink: 0, display: "inline-flex", alignItems: "center", textDecoration: "none" }}
      >
        View
      </Link>

      <PublishControl
        build={build}
        tree={tree}
        nodeTypes={nodeTypes}
        completeness={completeness}
        onPublish={onPublish}
        isPublishing={isPublishing}
        publishError={publishError}
        onFocusRequirement={onFocusRequirement}
      />
    </header>

    {isRebuild && rebuild ? <RebuildOriginStrip build={build} rebuild={rebuild} /> : null}
    </>
  );
}
