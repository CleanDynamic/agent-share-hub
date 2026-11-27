// The repo's tabs on a phone (prompt 17): 49 tall, padding 0 16, 15/500 Text 3; the current tab 15/700 Text with a 4px Mint bar
// (radius 2) at the bottom, as wide as its label (at least 40). `equal` shares the width; otherwise tabs that do not fit
// scroll sideways in their own row with no scrollbar. Light: the bar is `--tab-bar` over a 1px `--tab-bar-edge` line, which
// is how the tokens already draw it on desktop. Roles and `aria-selected` as `TextTabs` has them.

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { PHONE_EASE, PHONE_QUICK, prefersReducedMotion } from "@/lib/theme/motion";

import { PHONE_TAB } from "@/components/shell/chromeSize";
import type { TextTab } from "@/components/vision/TextTabs";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export interface PhoneTabsProps<V extends string = string> {
  tabs: readonly TextTab<V>[];
  value: V;
  onChange: (value: V) => void;
  /** The tablist's accessible name. */
  label: string;
  /** Every tab takes an equal share of the width. */
  equal?: boolean;
  /** 29d: the tabs sit as a centred pair, each its word plus 16 either side with 24 between, over one 3 tall indicator in Text
   *  that is exactly as wide as the word and slides between them (a transform over `PHONE_QUICK`; instantly under reduced motion). Mark the word
   *  with `data-tab-word` in a custom label so the chevron and the like are not underlined. */
  centred?: boolean;
  /** What a tab's label draws, for a tab that carries more than its words (Home's kind after a middle dot). Absent: the label. */
  renderLabel?: (tab: TextTab<V>, current: boolean) => ReactNode;
}

const BAR_MIN = 40;

function Tab({ tab, current, equal, centred, onSelect, onKeyDown, content }: { tab: TextTab; current: boolean; equal?: boolean; centred?: boolean; onSelect: () => void; onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void; content?: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const label = useRef<HTMLSpanElement>(null);
  const [bar, setBar] = useState(BAR_MIN);
  useLayoutEffect(() => {
    const w = label.current?.getBoundingClientRect().width ?? 0;
    setBar(Math.max(BAR_MIN, Math.round(w)));
  }, [tab.label, tab.count, current, content]);
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
        flex: equal ? "1 1 0" : "0 0 auto",
        minWidth: equal ? 0 : undefined,
        boxSizing: "border-box",
        height: PHONE_TAB,
        padding: "0 16px",
        background: "none",
        border: 0,
        fontFamily: FIGTREE,
        fontSize: 15,
        fontWeight: current ? 700 : 500,
        lineHeight: "20px",
        color: current ? t.text : t.label,
        whiteSpace: "nowrap",
        cursor: "pointer",
        ...ring(state.focusVisible),
      }}
    >
      <span ref={label} style={{ display: "inline-block" }}>
        {content ?? (centred ? <span data-tab-word="">{tab.label}</span> : tab.label)}
        {tab.count !== undefined ? <span style={{ marginLeft: 6, fontWeight: 400, color: t.label, fontVariantNumeric: "tabular-nums" }}>{tab.count}</span> : null}
      </span>
      {current && !centred ? (
        <span
          aria-hidden="true"
          data-testid="phone-tab-bar"
          style={{
            position: "absolute",
            left: "50%",
            bottom: 0,
            width: bar,
            height: 4,
            marginLeft: -bar / 2,
            borderRadius: 2,
            background: t.tabBar,
            boxShadow: `0 0 0 1px ${t.tabBarEdge}`,
          }}
        />
      ) : null}
    </button>
  );
}

export function PhoneTabs<V extends string = string>({ tabs, value, onChange, label, equal = false, centred = false, renderLabel }: PhoneTabsProps<V>) {
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
  /* 29d: where the one indicator stands, measured from the current tab's word. */
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);
  const measure = () => {
    const box = list.current;
    const word = box?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"] [data-tab-word]');
    if (!box || !word) return;
    const a = box.getBoundingClientRect();
    const b = word.getBoundingClientRect();
    const next = { left: Math.round(b.left - a.left), width: Math.round(b.width) };
    setBar((was) => (was && was.left === next.left && was.width === next.width ? was : next));
  };
  useLayoutEffect(() => {
    if (!centred) return;
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });
  return (
    <div
      ref={list}
      data-ui="phone-tabs"
      role="tablist"
      aria-label={label}
      className={equal || centred ? undefined : "bg-scroll-row"}
      style={{
        position: "relative",
        display: "flex",
        justifyContent: centred ? "center" : undefined,
        gap: centred ? 24 : undefined,
        overflowX: equal || centred ? "visible" : "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        background: t.bg,
      }}
    >
      {tabs.map((tab, index) => (
        <Tab key={tab.value} tab={tab} equal={equal && !centred} centred={centred} current={tab.value === value} content={renderLabel?.(tab, tab.value === value)} onSelect={() => onChange(tab.value)} onKeyDown={(e) => move(e, index)} />
      ))}
      {centred && bar ? (
        <span
          aria-hidden="true"
          data-testid="phone-tab-indicator"
          data-motion="bar"
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: bar.width,
            height: 3,
            borderRadius: 2,
            background: t.text,
            transform: `translateX(${bar.left}px)`,
            transition: prefersReducedMotion() ? "none" : `transform ${PHONE_QUICK}ms ${PHONE_EASE}`,
          }}
        />
      ) : null}
    </div>
  );
}

export default PhoneTabs;
