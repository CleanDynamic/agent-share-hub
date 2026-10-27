/* SV-02: the boards' tabs (series README, Visual grammar 10): text buttons 36 high, 20 apart, 500 weight, `--text2`;
   the selected one `--text` with a 1px `--text` underline that sits on the row's hairline.

   The prompt calls this `UnderlineTabs`; that name is `components/brand/UnderlineTabs.tsx` (40 high, 24 apart, 2px edge),
   which other pages use and which keeps its look, so this one is `TextTabs`. SV-10: Home's tabs are 40 high and 24 apart
   (`height`, `gap`), on a row that draws its own hairline (`rule={false}`). `role="tablist"`; the arrows, Home and End
   move between tabs, and a selected tab changes at once. */

import { useRef, type KeyboardEvent, type ReactNode } from "react";

import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export interface TextTab<V extends string = string> {
  value: V;
  label: string;
  /** After the label, in `--label`. */
  count?: ReactNode;
  /** The tab's DOM id and the panel it controls. */
  id?: string;
  controls?: string;
}

export interface TextTabsProps<V extends string = string> {
  tabs: readonly TextTab<V>[];
  value: V;
  onChange: (value: V) => void;
  /** The tablist's accessible name. */
  label: string;
  /** SV-10: Home's board draws its tabs 40 high and 24 apart. */
  height?: 36 | 40;
  gap?: 20 | 24;
  /** The hairline under the tabs. Off where the row around them draws it (Home). */
  rule?: boolean;
}

function Tab({
  current,
  tab,
  height,
  onSelect,
  onKeyDown,
}: {
  current: boolean;
  height: number;
  tab: TextTab;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      role="tab"
      id={tab.id}
      aria-selected={current}
      aria-controls={tab.controls}
      tabIndex={current ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      {...handlers}
      style={{
        boxSizing: "border-box",
        height,
        margin: "0 0 -1px",
        padding: 0,
        background: "none",
        border: 0,
        borderBottom: `1px solid ${current ? t.text : "transparent"}`,
        fontFamily: FIGTREE,
        fontSize: 13,
        fontWeight: 500,
        lineHeight: "normal",
        color: current ? t.text : state.hovered ? t.text : t.text2,
        whiteSpace: "nowrap",
        cursor: "pointer",
        ...ring(state.focusVisible),
      }}
    >
      {tab.label}
      {tab.count !== undefined ? (
        <span style={{ marginLeft: 6, fontWeight: 400, color: t.label, fontVariantNumeric: "tabular-nums" }}>{tab.count}</span>
      ) : null}
    </button>
  );
}

export function TextTabs<V extends string = string>({ tabs, value, onChange, label, height = 36, gap = 20, rule = true }: TextTabsProps<V>) {
  const list = useRef<HTMLDivElement>(null);

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    const next =
      event.key === "ArrowRight" ? (index + 1) % tabs.length
      : event.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length
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
      data-ui="text-tabs"
      role="tablist"
      aria-label={label}
      style={{ display: "flex", gap, borderBottom: rule ? `1px solid ${t.hairline}` : undefined }}
    >
      {tabs.map((tab, index) => (
        <Tab
          key={tab.value}
          tab={tab}
          current={tab.value === value}
          height={height}
          onSelect={() => onChange(tab.value)}
          onKeyDown={(event) => move(event, index)}
        />
      ))}
    </div>
  );
}

export default TextTabs;
