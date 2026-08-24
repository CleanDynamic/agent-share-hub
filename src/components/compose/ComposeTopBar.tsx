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

import { useState } from "react";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PublishControl } from "@/components/compose/PublishControl";
import type {
  Build,
  BuildPatch,
  BuildShape,
  Completeness,
  NodeTree,
  NodeType,
} from "@/lib/build";
import {
  GAP_RED,
  HAIRLINE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
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
}: ComposeTopBarProps) {
  // Inline styles cannot express :focus, so the focus treatment is state.
  const [titleFocused, setTitleFocused] = useState(false);

  return (
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
      />
    </header>
  );
}
