// The compose workspace's top bar.
//
// Title, shape, save state, a way to see the build as a reader sees it, and a
// Publish control that does not publish yet. Everything here is styled with
// inline style objects: Tailwind's generated utilities win over hand-written
// classes at build time, so a class would not survive the build.

import { useState } from "react";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Build, BuildPatch, BuildShape } from "@/lib/build";
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

export function ComposeTopBar({
  build,
  isSaving,
  lastSavedAt,
  saveError,
  onPatch,
  onOpenTray,
  onOpenInspector,
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

      <SaveState isSaving={isSaving} lastSavedAt={lastSavedAt} saveError={saveError} />

      <Link
        to={`/b2/${build.slug}`}
        target="_blank"
        rel="noreferrer"
        style={{ ...controlBase, flexShrink: 0, display: "inline-flex", alignItems: "center", textDecoration: "none" }}
      >
        View
      </Link>

      <Tooltip>
        {/* A disabled button fires no pointer events, so the span carries them. */}
        <TooltipTrigger asChild>
          {/* VISUAL SLOT — the primary button surface is supplied externally.
              Structure only here: pill geometry, disabled state, no surface. */}
          <span
            data-visual-slot="btn-primary"
            style={{ display: "inline-flex", flexShrink: 0 }}
          >
            <button
              type="button"
              disabled
              style={{
                ...controlBase,
                borderRadius: 100,
                padding: "0 14px",
                color: TEXT_MUTED,
                cursor: "not-allowed",
                pointerEvents: "none",
              }}
            >
              Publish
            </button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">publishing arrives in NS-P19</TooltipContent>
      </Tooltip>
    </header>
  );
}
