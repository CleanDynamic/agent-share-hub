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
//
// BG-P16 — THE BAR ITSELF IS NOW WorkspaceBar, shared with /compose/new,
// /rebuild/:slug and /convert/:contentItemId so the four authoring routes stop
// each having their own chrome and their own way out. What stayed here is what
// is specific to composing: the shape select, the hero control, the save state,
// the change count, View and Publish. They MOVED into the shared bar's right
// slot rather than being rebuilt — same elements, same behaviour, repainted
// onto tokens because the bar's ground is now `--bg` and a control drawn in
// rgba(255,255,255,.025) with 45%-white text is invisible on Exhibition.
//
// PublishControl IS THE ONE THING LEFT ON ITS LEGACY PAINT, deliberately and on
// two separate grounds: the publish sheet belongs to BG-P24, and its trigger
// carries `data-visual-slot="btn-primary"`, which neoscale-code-review names as
// an externally-supplied visual shell that AI-generated surface treatment must
// not touch. It is reported rather than quietly repainted.

import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PublishControl } from "@/components/compose/PublishControl";
import {
  WorkspaceBar,
  workspaceHairline,
  type WorkspaceMode,
} from "@/components/shell/WorkspaceBar";
import { ring, uiTransition } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { data as dataText, eyebrow } from "@/lib/theme/type";
import type { RebuildDiff } from "@/hooks/useRebuildDiff";
import type { BuildBounties } from "@/hooks/useBuildBounties";
import type {
  Build,
  BuildPatch,
  BuildShape,
  Completeness,
  NodeTree,
  NodeType,
  RequirementKey,
} from "@/lib/build";

/**
 * A control standing in the workspace bar.
 *
 * Flat, by the workspace ground rule: `--recess` on the bar's `--bg`, one
 * `--line` hairline, `--r-control`, and a `--text2` label so these stay
 * subordinate to the exit (whose border is `--text2`) and to Publish. No glass
 * and no `--glass*` token — see WorkspaceBar.tsx.
 *
 * Longhands rather than the `background`/`border` shorthands because jsdom
 * drops any shorthand carrying a `var()`, which would make every token here
 * untestable.
 */
function controlStyle(state: {
  hovered?: boolean;
  focusVisible?: boolean;
  disabled?: boolean;
} = {}): React.CSSProperties {
  const live = !state.disabled;
  const hot = Boolean(live && state.hovered);

  return {
    ...eyebrow,
    fontSize: 12,
    letterSpacing: "0.04em",
    textTransform: "none",
    height: 30,
    padding: "0 10px",
    borderRadius: r.control,
    backgroundColor: hot ? t.line : t.recess,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: hot ? t.text2 : t.line,
    color: t.text2,
    opacity: live ? 1 : 0.55,
    cursor: live ? "pointer" : "not-allowed",
    transition: uiTransition(),
    ...ring(live && state.focusVisible),
  };
}

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
  /** Passed straight through. The optional note is the rebuild variant. */
  onPublish: (rebuildNote?: string | null) => Promise<Build>;
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
  /**
   * The asks already filed on this build, passed straight to PublishControl for
   * the publish sheet's bounty section (NS-P51). Absent on a caller that has
   * not read them, which renders the sheet exactly as it was before.
   */
  bounties?: BuildBounties;
}

function SaveState({
  isSaving,
  lastSavedAt,
  saveError,
}: Pick<ComposeTopBarProps, "isSaving" | "lastSavedAt" | "saveError">) {
  /* Breakage red for a failed save, evidence for a saved one, --text2 for the
     two quiet states. The three category-adjacent hues are the tokens the
     theme already measures on both grounds; the legacy GAP_RED/TEAL hexes only
     ever read on a dark room. */
  const { text, colour } = saveError
    ? { text: "Not saved", colour: t.catBreakage }
    : isSaving
      ? { text: "Saving…", colour: t.text2 }
      : lastSavedAt
        ? { text: "Saved", colour: t.evidence }
        : { text: "Draft", colour: t.text2 };

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
        ...dataText,
        color: colour,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: r.full,
          backgroundColor: colour,
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
        ...dataText,
        flexShrink: 0,
        whiteSpace: "nowrap",
        color: none ? t.text2 : t.evidence,
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
        /* BG-P16 — repainted onto tokens and off the glass. It sits BENEATH the
           workspace bar and is separated from the panels by the same `--line`
           hairline the bar uses, so the two read as one band of chrome rather
           than as a notice stuck to the top of the work.

           `--recess` rather than a tint of the accent: this is provenance, not
           a warning, and a coloured wash across the full width would give a
           permanent fixture the weight of an alert. The accent survives as the
           2px left edge and the link, which is where RebuildCredit puts it too
           (`t.action` — the same clay the credit's links take). */
        backgroundColor: t.recess,
        ...workspaceHairline,
        borderLeftWidth: 2,
        borderLeftStyle: "solid",
        borderLeftColor: t.action,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "6px 14px",
      }}
    >
      <span style={{ ...dataText, fontSize: 12, color: t.text2, minWidth: 0 }}>
        Rebuilding from{" "}
        {slug ? (
          <Link
            to={`/b2/${slug}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: t.action, textDecoration: "none" }}
          >
            {title}
          </Link>
        ) : (
          <span style={{ color: t.text }}>{title}</span>
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
              ...controlStyle({ disabled: !enabled }),
              whiteSpace: "nowrap",
              flexShrink: 0,
              /* Set: the measured evidence pair, which is the token for "this is
                 so" and is legal as text on both grounds. */
              ...(isHero
                ? {
                    color: t.evidence,
                    borderColor: t.evidence,
                    backgroundColor: t.evidenceFill,
                  }
                : null),
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
  bounties,
}: ComposeTopBarProps) {
  // The count waits for the diff rather than guessing at it. A rebuild whose
  // source is still loading — or has been unpublished since the fork — shows no
  // number, because "no changes yet" on an uncomputed diff is a claim, not a
  // blank.
  const isRebuild = Boolean(rebuild?.isRebuild);

  /* A draft forked from somebody else's build IS a rebuild, and the bar says
     so. /rebuild/:slug is only the door; this is the room, and it is where a
     creator actually spends the hour. */
  const mode: WorkspaceMode = isRebuild ? "rebuild" : "compose";

  return (
    <>
    <WorkspaceBar
      mode={mode}
      exit={{ to: "/gallery" }}
      context={{
        kind: "editable",
        value: build.title ?? "",
        onChange: (title) => onPatch({ title }),
        label: "Build title",
        placeholder: "Untitled build",
      }}
      right={
        <>
      <select
        aria-label="Build shape"
        value={(build.shape as BuildShape) ?? "other"}
        onChange={(event) => onPatch({ shape: event.target.value as BuildShape })}
        style={{
          ...controlStyle(),
          flexShrink: 0,
          /* The native option list follows the room rather than always being
             dark: `colorScheme: "dark"` was correct when the workspace was a
             hard-coded void and is wrong now that Exhibition is the default. */
          colorScheme: "light dark",
        }}
      >
        {BUILD_SHAPES.map((shape) => (
          <option key={shape.value} value={shape.value}>
            {shape.label}
          </option>
        ))}
      </select>

      {onOpenTray && (
        <button type="button" onClick={onOpenTray} style={{ ...controlStyle(), flexShrink: 0 }}>
          Tray
        </button>
      )}
      {onOpenInspector && (
        <button type="button" onClick={onOpenInspector} style={{ ...controlStyle(), flexShrink: 0 }}>
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
        style={{
          ...controlStyle(),
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          textDecoration: "none",
        }}
      >
        View
      </Link>

      {/* UNTOUCHED BY BG-P16, on two grounds: the publish sheet belongs to
          BG-P24, and this trigger carries data-visual-slot="btn-primary",
          which is an externally-supplied visual shell. It still carries its
          dark-only paint and will read poorly on Exhibition until BG-P24
          repaints it — reported in the handoff rather than taken quietly. */}
      <PublishControl
        build={build}
        tree={tree}
        nodeTypes={nodeTypes}
        completeness={completeness}
        onPublish={onPublish}
        isPublishing={isPublishing}
        publishError={publishError}
        onFocusRequirement={onFocusRequirement}
        rebuild={rebuild}
        bounties={bounties}
      />
        </>
      }
    />

    {isRebuild && rebuild ? <RebuildOriginStrip build={build} rebuild={rebuild} /> : null}
    </>
  );
}
