// What a reader can put in a message: a build (RC-P20).
//
// ONE KIND ⟦hicks-law⟧. The picker offered blueprints, stages and blocks, all
// of which the clear removed; it offers "Builds" now and nothing else: the
// reader's own published builds and the ones they saved, the most recent
// first, at most twenty shown (listShareableBuilds), with a search box.
// Keyboard: up and down move, Enter picks, Escape closes.
//
// Painted from the theme's tokens, so it reads in both rooms: the panel is
// --bg on a --line hairline at --r-panel with the raised elevation, rows lift
// to --recess, and the text is --text over --text2. Loading is skeleton rows
// at the rows' size (STATES.md row 20); empty is one sentence and one
// secondary action (row 19), because the composer's Send is the primary; a
// refusal is its sentence and a secondary "Try again" (row 21). The entrance
// fades and lifts 8px, and under reduced motion it does not move at all.

import * as React from "react";
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
  useTransitionStyles,
} from "@floating-ui/react";
import { Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { isPermissionError } from "@/lib/errors/permission";
import { skeletonStyle } from "@/lib/theme/controls";
import { elevation } from "@/lib/theme/elevation";
import { prefersReducedMotion } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { body, data, eyebrow, tabular } from "@/lib/theme/type";

/** The one kind a message can carry. */
export const REFERENCE_KINDS = ["Builds"] as const;

/** The most rows the picker shows. */
export const REFERENCE_MAX = 20;

/** A row's height: a 44px target, and the skeleton's pitch. */
const ROW_HEIGHT = 44;

/**
 * STATES.md row 2, the RC secondary: Button's outline variant paints a glass
 * surface, and the secondary is transparent.
 */
const SECONDARY = { background: "transparent", minHeight: ROW_HEIGHT } as const;

export interface ReferenceItem {
  id: string;
  name: string;
  /** "Yours" or "Saved": why it is offered. */
  subtitle?: string;
  slug?: string;
}

export interface ThreadReferencePickerProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  results: ReferenceItem[];
  isLoading?: boolean;
  /** Why the builds could not be read, if they could not. */
  error?: unknown;
  onRetry?: () => void;
  onSelect: (item: ReferenceItem) => void;
  anchorEl: HTMLElement | null;
}

export function ThreadReferencePicker({
  isOpen,
  onClose,
  query,
  onQueryChange,
  results,
  isLoading = false,
  error = null,
  onRetry,
  onSelect,
  anchorEl,
}: ThreadReferencePickerProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const shown = results.slice(0, REFERENCE_MAX);

  const floating = useFloating({
    open: isOpen,
    placement: "top-start",
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    elements: { reference: anchorEl },
  });
  const { refs, floatingStyles, context } = floating;

  const { isMounted, styles: transitionStyles } = useTransitionStyles(context, {
    duration: prefersReducedMotion() ? 0 : 150,
    initial: { opacity: 0, transform: "translateY(8px)" },
  });

  React.useEffect(() => {
    if (isOpen && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const [selectedIndex, setSelectedIndex] = React.useState(0);
  React.useEffect(() => setSelectedIndex(0), [results, query]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, shown.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && shown[selectedIndex]) {
        e.preventDefault();
        onSelect(shown[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [shown, selectedIndex, onSelect, onClose],
  );

  if (!isMounted) return null;

  return (
    <div
      ref={refs.setFloating}
      data-testid="reference-picker"
      role="dialog"
      aria-label="Share a build"
      style={{
        ...floatingStyles,
        ...transitionStyles,
        zIndex: 60,
        width: 340,
        maxWidth: "calc(100vw - 16px)",
        background: t.bg,
        border: `1px solid ${t.line}`,
        borderRadius: r.panel,
        overflow: "hidden",
        ...elevation.raised,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: SPACE.sm,
          borderBottom: `1px solid ${t.line}`,
        }}
      >
        {/* The one kind, named: there is nothing to switch between. */}
        <span data-testid="reference-kind" style={{ ...eyebrow, color: t.text2 }}>
          {REFERENCE_KINDS[0]}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: ROW_HEIGHT,
            height: ROW_HEIGHT,
            border: "none",
            background: "transparent",
            color: t.text2,
            cursor: "pointer",
          }}
        >
          <X size={16} />
        </button>
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: SPACE.xs,
          padding: `0 ${SPACE.sm}px`,
          minHeight: ROW_HEIGHT,
          borderBottom: `1px solid ${t.line}`,
        }}
      >
        <Search size={16} color={t.text2} aria-hidden />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search your builds and saves"
          aria-label="Search your builds and saves"
          style={{ ...body, flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: t.text }}
        />
      </label>

      <div data-testid="reference-results" style={{ maxHeight: ROW_HEIGHT * 6, overflowY: "auto" }}>
        {isLoading ? (
          <div
            aria-busy="true"
            aria-label="Loading builds"
            style={{ display: "flex", flexDirection: "column", gap: SPACE.xs, padding: SPACE.xs }}
          >
            {[0, 1, 2].map((index) => (
              <div key={index} style={{ ...skeletonStyle(), height: ROW_HEIGHT - SPACE.xs }} />
            ))}
          </div>
        ) : error ? (
          <div
            data-testid="reference-error"
            style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: SPACE.xs, padding: SPACE.sm }}
          >
            <p style={{ ...body, color: t.text, margin: 0 }}>
              {isPermissionError(error) ? "You don't have access to this." : "Something went wrong."}
            </p>
            {onRetry ? (
              <Button type="button" variant="outline" onClick={onRetry} style={SECONDARY}>
                Try again
              </Button>
            ) : null}
          </div>
        ) : shown.length === 0 ? (
          <div
            data-testid="reference-empty"
            style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: SPACE.xs, padding: SPACE.sm }}
          >
            <p style={{ ...body, color: t.text2, margin: 0 }}>
              {query.trim() ? "No build of yours or saved by you has that in its title." : "Publish or save a build and it can go in a message."}
            </p>
            {query.trim() ? (
              <Button type="button" variant="outline" onClick={() => onQueryChange("")} style={SECONDARY}>
                Clear search
              </Button>
            ) : (
              <Button asChild variant="outline" style={SECONDARY}>
                <Link to="/gallery">Browse the gallery</Link>
              </Button>
            )}
          </div>
        ) : (
          shown.map((item, index) => (
            <button
              key={item.id}
              type="button"
              data-testid="reference-item"
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => onSelect(item)}
              style={{
                width: "100%",
                minHeight: ROW_HEIGHT,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: SPACE.xs,
                padding: `0 ${SPACE.sm}px`,
                border: "none",
                background: index === selectedIndex ? t.recess : "transparent",
                color: t.text,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <span style={{ ...body, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.name}
              </span>
              {item.subtitle ? (
                <span style={{ ...data, color: t.text2, flexShrink: 0, ...tabular }}>
                  {item.subtitle}
                </span>
              ) : null}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default ThreadReferencePicker;
