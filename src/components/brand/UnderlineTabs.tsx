// Underline tabs (UI-P07): a row of tabs with a rule under it, and a second,
// heavier rule in `--action` under the current one.
//
// The current tab is Figtree 600 in `--text` with 7px under it and a 2px
// action border; the others are `--text2` with 9px under them, so every tab is
// the same height and nothing jumps when the choice changes. (UI-P54, the
// density pass: 10 and 12 before, the tabs 24 apart rather than 17, and the
// type size the reference drew — 12, 13 or 14 — rendered through the table.) `role="tablist"`,
// `role="tab"` and `aria-selected`, which is what the part viewer and the build
// page's sections both need. Arrow keys move between tabs; the panels are the
// caller's, so each tab's `id` and `aria-controls` are the caller's to pass.

import { useRef, type KeyboardEvent } from "react";

import { useInteractive } from "@/lib/theme/interactive";
import { ring } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { Glyph, type GlyphName } from "./Glyph";

export type UnderlineTabsFontSize = 12 | 13 | 14;

export interface UnderlineTab<V extends string = string> {
  value: V;
  label: string;
  /** The tab's DOM id, for the panel's `aria-labelledby`. */
  id?: string;
  /** The panel this tab controls. */
  controls?: string;
  /** Refined only: a count after the label, in `--label`. */
  count?: number | string;
  /** CA-07: drawn in place of the words; the label is then the tab's accessible name. */
  glyph?: GlyphName;
  /** CA-07: a tab that cannot be chosen, with `title` saying why. */
  disabled?: boolean;
  title?: string;
}

export interface UnderlineTabsProps<V extends string = string> {
  tabs: readonly UnderlineTab<V>[];
  value: V;
  onChange: (value: V) => void;
  fontSize?: UnderlineTabsFontSize;
  /** The tablist's accessible name. */
  label: string;
}

function Tab({
  current,
  id,
  controls,
  onSelect,
  onKeyDown,
  count,
  children,
  tabIndex,
  glyph,
  disabled = false,
  title,
}: {
  current: boolean;
  id?: string;
  controls?: string;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  children: string;
  tabIndex: number;
  count?: number | string;
  glyph?: GlyphName;
  disabled?: boolean;
  title?: string;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();

  /* UI-P84: Geist 13/500, 40 high, the current tab `--text` over a 2px `--text` edge that sits on the row's hairline;
     the others `--text2` over a transparent 2px edge. */
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={current}
      aria-controls={controls}
      aria-label={glyph ? children : undefined}
      aria-disabled={disabled || undefined}
      title={title ?? (glyph ? children : undefined)}
      tabIndex={tabIndex}
      onClick={disabled ? undefined : onSelect}
      onKeyDown={onKeyDown}
      {...handlers}
      style={{
        boxSizing: "border-box",
        height: 40,
        margin: "0 0 -1px",
        padding: 0,
        background: "none",
        border: 0,
        borderBottom: `2px solid ${current ? t.text : "transparent"}`,
        fontFamily: FIGTREE,
        fontSize: 13,
        fontWeight: 500,
        lineHeight: "normal",
        color: disabled ? t.label : current ? t.text : t.text2,
        whiteSpace: "nowrap",
        cursor: disabled ? "default" : "pointer",
        ...(glyph ? { display: "inline-flex", alignItems: "center" } : null),
        ...ring(state.focusVisible),
      }}
    >
      {glyph ? <Glyph name={glyph} size={16} /> : children}
      {count !== undefined ? (
        <>
          {" "}
          <span style={{ fontSize: 11.5, fontWeight: 400, color: t.label, fontVariantNumeric: "tabular-nums" }}>
            {count}
          </span>
        </>
      ) : null}
    </button>
  );
}

export function UnderlineTabs<V extends string = string>({
  tabs,
  value,
  onChange,
  label,
}: UnderlineTabsProps<V>) {
  const list = useRef<HTMLDivElement>(null);

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    const step = (from: number, by: 1 | -1) => {
      // CA-07: a disabled tab is passed over.
      let at = from;
      for (let tries = 0; tries <= last; tries++) {
        at = (at + by + tabs.length) % tabs.length;
        if (!tabs[at].disabled) return at;
      }
      return from;
    };
    const next =
      event.key === "ArrowRight" ? step(index, 1)
      : event.key === "ArrowLeft" ? step(index, -1)
      : event.key === "Home" ? step(last, 1)
      : event.key === "End" ? step(0, -1)
      : null;
    if (next === null) return;
    event.preventDefault();
    onChange(tabs[next].value);
    list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };

  return (
    <div
      ref={list}
      data-ui="tabs"
      role="tablist"
      aria-label={label}
      style={
        { display: "flex", gap: 24, borderBottom: `1px solid ${t.hairline}` }
      }
    >
      {tabs.map((tab, index) => (
        <Tab
          key={tab.value}
          current={tab.value === value}
          id={tab.id}
          controls={tab.controls}
          count={tab.count}
          glyph={tab.glyph}
          disabled={tab.disabled}
          title={tab.title}
          tabIndex={tab.value === value ? 0 : -1}
          onSelect={() => {
            if (!tab.disabled) onChange(tab.value);
          }}
          onKeyDown={(event) => move(event, index)}
        >
          {tab.label}
        </Tab>
      ))}
    </div>
  );
}

export default UnderlineTabs;
