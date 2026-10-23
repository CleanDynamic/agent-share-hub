// The segmented control (UI-P07): one choice from a few, always visible.
//
// A track of buttons, and exactly one is current. The current segment is the
// one filled solid — `--text` with `--on-text` on it, weight 600 — so the choice
// is carried by fill and weight, not by colour. Each item is a button with
// `aria-pressed`, and the group is named, because "Following / Everyone" with
// nothing around it is two unrelated buttons to a screen reader.
//
// Sizes are the track's outer height: items are `size − 8` tall inside 4px of
// padding. The type is Figtree at 11, 12 or 13px, and each reference instance
// states its own — 30/11 for panel filters, 32/11 in the footer, 36/12 for the
// gallery lenses, 36/13 on mobile. Those are the drawn numbers: since UI-P54 an
// item renders `size − 8` through the density table (28 → 23), with 0 9px of
// padding and its type through the table too; the track's 4px and 2px are
// under the table's floor and stay.
//
// TWO ADDITIONS FOR THE ENTRANCE (UI-P36), both opt-in and neither changes a
// control that does not ask:
//
//   `href` on an item makes that segment a link. Sign in · Join free is a switch
//   between two PAGES, so each side is a real `<a>` (the current one says
//   `aria-current="page"`), not a button that navigates from a handler.
//
//   `semantics="radio"` makes the group one radio group: a single tab stop, the
//   arrows move the choice. A setting that has exactly one value — the theme —
//   is that, and the sign-in page's theme control has always been a radio group.

import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { Link } from "react-router-dom";

import { useInteractive } from "@/lib/theme/interactive";
import { ring } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { CONTROL, CONTROL_HOVER } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

/** 22 is the composer preview's width switch (PT-07); 50 draws items 44 high, the touch target on a phone (PT-09). */
export type SegmentedSize = 22 | 26 | 28 | 30 | 32 | 34 | 36 | 38 | 40 | 50;
export type SegmentedFontSize = 11 | 12 | 13;

export interface SegmentedItem<V extends string = string> {
  value: V;
  label: ReactNode;
  /** Used as the button's accessible name when `label` is not text. */
  ariaLabel?: string;
  /**
   * Draw this segment as a link to this address. The router does the
   * navigating, so `onChange` is not called for it.
   */
  href?: string;
  /** CA-03: this one segment cannot be chosen (the composer's "A team of agents" while teams are not live). */
  disabled?: boolean;
}

export interface SegmentedProps<V extends string = string> {
  items: readonly SegmentedItem<V>[];
  value: V;
  /** Optional when every item is a link. */
  onChange?: (value: V) => void;
  size?: SegmentedSize;
  fontSize?: SegmentedFontSize;
  /** The group's accessible name. */
  label: string;
  /**
   * Shown, not changeable: every segment is `aria-disabled` and ignores a click.
   * The Profile's track switch on somebody else's profile. The current segment
   * keeps its fill, so the control still says what the value is.
   */
  readOnly?: boolean;
  /**
   * What the group announces itself as: a group of toggle buttons (the default)
   * or one radio group, with the current segment the only tab stop and the
   * arrow keys moving the choice.
   */
  semantics?: "buttons" | "radio";
  /** The track takes the full width and the items share it (the composer's tabs on a phone, PT-05). */
  fullWidth?: boolean;
  /** CA-17: the map's direction switch. Items `0 9px`, radius 5, in a well of radius 7; the sizes are the track's, as always. */
  compact?: boolean;
}

function Segment({
  current,
  height,
  ariaLabel,
  readOnly,
  href,
  semantics,
  fullWidth,
  compact = false,
  disabled = false,
  tabStop,
  onSelect,
  children,
}: {
  current: boolean;
  height: number;
  ariaLabel?: string;
  readOnly?: boolean;
  href?: string;
  semantics: "buttons" | "radio";
  fullWidth: boolean;
  compact?: boolean;
  disabled?: boolean;
  /** The radio group's one tab stop: the current segment, or the first that can be chosen when none is. */
  tabStop: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  const { state, handlers } = useInteractive<HTMLElement>();

  /* UI-P84: items are `size − 6` tall (the track is `size`), `0 12px`, radius 4, Geist 12/500. The current item is the
     control recipe at its hover fill; the others are transparent in `--text2`. */
  const style: CSSProperties = {
    boxSizing: "border-box",
    height: height + 2,
    padding: compact ? "0 9px" : "0 12px",
    border: "1px solid transparent",
    borderRadius: compact ? 5 : r.chip,
    fontFamily: FIGTREE,
    fontSize: 12,
    fontWeight: 500,
    cursor: readOnly || disabled ? "default" : "pointer",
    whiteSpace: "nowrap",
    background: "transparent",
    color: t.text2,
    ...(fullWidth ? { flex: 1, justifyContent: "center", display: "inline-flex", alignItems: "center" } : null),
    ...(current ? { ...CONTROL, ...CONTROL_HOVER, color: t.text } : null),
    ...(disabled ? { filter: t.dimFilter } : null),
    ...ring(state.focusVisible),
  };

  if (href !== undefined) {
    return (
      <Link
        to={href}
        aria-current={current ? "page" : undefined}
        aria-label={ariaLabel}
        {...handlers}
        style={{ ...style, display: "inline-flex", alignItems: "center", textDecoration: "none" }}
      >
        {children}
      </Link>
    );
  }

  const radio = semantics === "radio";
  return (
    <button
      type="button"
      role={radio ? "radio" : undefined}
      aria-pressed={radio ? undefined : current}
      aria-checked={radio ? current : undefined}
      tabIndex={radio ? (tabStop ? 0 : -1) : undefined}
      aria-label={ariaLabel}
      aria-disabled={readOnly || undefined}
      disabled={disabled || undefined}
      onClick={readOnly || disabled ? undefined : onSelect}
      {...handlers}
      style={style}
    >
      {children}
    </button>
  );
}

export function Segmented<V extends string = string>({
  items,
  value,
  onChange,
  size = 34,
  label,
  readOnly = false,
  semantics = "buttons",
  fullWidth = false,
  compact = false,
}: SegmentedProps<V>) {
  const radio = semantics === "radio";
  const stop = items.some((item) => item.value === value) ? value : items.find((item) => !item.disabled)?.value;

  /* The radio group's keys: right and down step on, left and up step back, both
     wrapping, and the choice moves with the focus — the pattern a screen reader
     announces for radios. */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0 || readOnly) return;
    event.preventDefault();
    const from = items.findIndex((item) => item.value === value);
    let to = (from + step + items.length) % items.length;
    // A disabled segment is stepped over.
    for (let tries = 0; items[to].disabled && tries < items.length; tries++) to = (to + step + items.length) % items.length;
    onChange?.(items[to].value);
    event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[to]?.focus();
  };

  return (
    <div
      data-ui="segmented"
      role={radio ? "radiogroup" : "group"}
      aria-label={label}
      onKeyDown={radio ? onKeyDown : undefined}
      style={
        {
          display: fullWidth ? "flex" : "inline-flex",
          width: fullWidth ? "100%" : undefined,
          boxSizing: "border-box",
          height: size,
          gap: 2,
          padding: 2,
          borderRadius: compact ? 7 : r.control,
          background: t.segTrack,
          border: `1px solid ${t.segBorder}`,
        }
      }
    >
      {items.map((item) => (
        <Segment
          key={item.value}
          current={item.value === value}
          height={size - 8}
          ariaLabel={item.ariaLabel}
          readOnly={readOnly}
          href={item.href}
          semantics={semantics}
          fullWidth={fullWidth}
          compact={compact}
          disabled={item.disabled}
          tabStop={item.value === stop}
          onSelect={() => onChange?.(item.value)}
        >
          {item.label}
        </Segment>
      ))}
    </div>
  );
}

export default Segmented;
