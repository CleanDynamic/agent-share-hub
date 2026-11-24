/* Synth 06: tabs that change what a page shows (Following / Everyone, Posts / Rules, lenses): 53 tall, 15/500 `--label`;
   the current tab 15/700 `--text` with a 4px bar in `--tab-bar` (Mint; Terminal Green on light, with the 1px Ink line
   `--tab-bar-edge` under it), 56 wide, radius 2, centred at the bottom. No line
   under the row. `role="tablist"` and `role="tab"` with `aria-selected`; the arrows, Home and End move between tabs, and a
   selected tab changes at once. `height`, `gap` and `rule` are kept so callers compile; the shape is the pack's. */

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
  /** Kept for callers; tabs are 53 tall. */
  height?: 32 | 36;
  gap?: 20 | 24;
  /** Kept for callers; there is no line under the row. */
  rule?: boolean;
  /** The tabs share the row's full width, each an equal part, the label centred. */
  fill?: boolean;
}

function Tab({
  current,
  tab,
  fill,
  onSelect,
  onKeyDown,
}: {
  current: boolean;
  fill?: boolean;
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
        position: "relative",
        boxSizing: "border-box",
        height: 53,
        padding: "0 16px",
        ...(fill ? { flex: "1 1 0", minWidth: 0 } : null),
        background: "none",
        border: 0,
        fontFamily: FIGTREE,
        fontSize: 15,
        fontWeight: current ? 700 : 500,
        lineHeight: "20px",
        color: current || state.hovered ? t.text : t.label,
        whiteSpace: "nowrap",
        cursor: "pointer",
        ...ring(state.focusVisible),
      }}
    >
      {tab.label}
      {tab.count !== undefined ? (
        <span style={{ marginLeft: 6, fontWeight: 400, color: t.label, fontVariantNumeric: "tabular-nums" }}>{tab.count}</span>
      ) : null}
      {current ? (
        <span
          aria-hidden="true"
          style={{ position: "absolute", left: "calc(50% - 28px)", bottom: 0, width: 56, height: 4, borderRadius: 2, background: t.tabBar, boxShadow: `0 1px 0 ${t.tabBarEdge}` }}
        />
      ) : null}
    </button>
  );
}

export function TextTabs<V extends string = string>({ tabs, value, onChange, label, fill }: TextTabsProps<V>) {
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
      style={{ display: "flex" }}
    >
      {tabs.map((tab, index) => (
        <Tab
          key={tab.value}
          tab={tab}
          fill={fill}
          current={tab.value === value}
          onSelect={() => onChange(tab.value)}
          onKeyDown={(event) => move(event, index)}
        />
      ))}
    </div>
  );
}

export default TextTabs;
