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

import { denseFont } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { ring } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export type UnderlineTabsFontSize = 12 | 13 | 14;

export interface UnderlineTab<V extends string = string> {
  value: V;
  label: string;
  /** The tab's DOM id, for the panel's `aria-labelledby`. */
  id?: string;
  /** The panel this tab controls. */
  controls?: string;
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
  fontSize,
  id,
  controls,
  onSelect,
  onKeyDown,
  children,
  tabIndex,
}: {
  current: boolean;
  fontSize: number;
  id?: string;
  controls?: string;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  children: string;
  tabIndex: number;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={current}
      aria-controls={controls}
      tabIndex={tabIndex}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      {...handlers}
      style={{
        background: "none",
        border: 0,
        borderBottom: current ? `2px solid ${t.action}` : undefined,
        margin: 0,
        padding: 0,
        paddingBottom: current ? 7 : 9,
        fontFamily: FIGTREE,
        fontSize: denseFont(fontSize),
        lineHeight: "normal",
        fontWeight: current ? 600 : undefined,
        color: current ? t.text : t.text2,
        whiteSpace: "nowrap",
        cursor: "pointer",
        ...ring(state.focusVisible),
      }}
    >
      {children}
    </button>
  );
}

export function UnderlineTabs<V extends string = string>({
  tabs,
  value,
  onChange,
  fontSize = 14,
  label,
}: UnderlineTabsProps<V>) {
  const list = useRef<HTMLDivElement>(null);

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
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
      style={{
        display: "flex",
        gap: 17,
        alignItems: "flex-end",
        borderBottom: `1px solid ${t.line}`,
      }}
    >
      {tabs.map((tab, index) => (
        <Tab
          key={tab.value}
          current={tab.value === value}
          fontSize={fontSize}
          id={tab.id}
          controls={tab.controls}
          tabIndex={tab.value === value ? 0 : -1}
          onSelect={() => onChange(tab.value)}
          onKeyDown={(event) => move(event, index)}
        >
          {tab.label}
        </Tab>
      ))}
    </div>
  );
}

export default UnderlineTabs;
