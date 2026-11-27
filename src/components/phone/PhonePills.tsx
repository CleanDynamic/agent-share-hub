// The pill row on a phone (29d): 32 tall pills, padding 0 14, radius 16, 13/16 500 (29g: labels and pills are 13/16); off is Card with Text 2, on is Text with the
// Page colour. 8 apart, 16 at the sides, 10 above and below. A row that overflows scrolls sideways and a 40 wide fade to Page
// stands at its right edge until the end is reached. One Mint element per region stays the round create button.
// Each pill is a toggle (`aria-pressed`), or a tab when `tabs` is given.

import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";

import { FilterChip } from "@/components/brand/FilterChip";
import { MobileIcon } from "@/components/brand/MobileIcon";
import type { MobileIconName } from "@/components/brand/mobileIcons";
import { PHONE_MARGIN } from "@/components/shell/chromeSize";
import { PHONE_PILL } from "@/components/shell/chromeSize";
import { ring } from "@/lib/theme/controls";
import { TOUCH_MIN } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export interface PhonePill<V extends string = string> {
  value: V;
  label: string;
  count?: number | string;
  /** A link pill: the row's choice is an address, so it stays in the address. `onChange` is not called for it. */
  href?: string;
  /** Pointing at or focusing a link pill (to start fetching what it opens). */
  onIntent?: () => void;
  /** An icon at 16 before the label (the editor's List, Map and Sources). */
  icon?: MobileIconName;
}

export interface PhonePillsProps<V extends string = string> {
  pills: readonly PhonePill<V>[];
  /** The chosen pill. */
  value: V | null;
  onChange: (value: V) => void;
  /** The row's accessible name. */
  label: string;
  /** The pills are tabs (prompt 22): a `tablist`, each pill a `tab` with its id and the panel it controls. */
  tabs?: { idOf: (value: V) => string; controls: string };
  /** The row sits under the top bar (a 52 row: 10 above and below the 32 pills). */
  docked?: boolean;
}

/** A pill that is a link: the same 32 tall shape, its hit area grown to 44 by padding with a matching negative margin. */
function LinkPill({ pill, on }: { pill: PhonePill; on: boolean }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  const grow = (TOUCH_MIN - PHONE_PILL) / 2;
  return (
    <Link
      to={pill.href as string}
      preventScrollReset
      aria-current={on ? "page" : undefined}
      onPointerEnter={pill.onIntent}
      onFocus={pill.onIntent}
      {...handlers}
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        boxSizing: "border-box",
        paddingBlock: grow,
        marginBlock: -grow,
        textDecoration: "none",
        borderRadius: PHONE_PILL / 2,
        ...ring(state.focusVisible),
      }}
    >
      <span
        style={{
          boxSizing: "border-box",
          height: PHONE_PILL,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "0 14px",
          borderRadius: PHONE_PILL / 2,
          background: on ? t.text : t.module,
          color: on ? t.bg : t.text2,
          fontFamily: FIGTREE,
          fontSize: 13,
          fontWeight: 500,
          lineHeight: "16px",
          whiteSpace: "nowrap",
        }}
      >
        {pill.label}
        {pill.count !== undefined ? <span style={{ fontWeight: 400, opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>{pill.count}</span> : null}
      </span>
    </Link>
  );
}

/** In a tablist, the arrow keys, Home and End move between the tabs, as `ScrollRow`'s do. */
function moveTab(event: KeyboardEvent<HTMLDivElement>) {
  const tabs = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')];
  const at = tabs.indexOf(document.activeElement as HTMLElement);
  if (at < 0) return;
  const last = tabs.length - 1;
  const next =
    event.key === "ArrowRight" ? (at === last ? 0 : at + 1)
    : event.key === "ArrowLeft" ? (at === 0 ? last : at - 1)
    : event.key === "Home" ? 0
    : event.key === "End" ? last
    : null;
  if (next === null) return;
  event.preventDefault();
  tabs[next].focus();
  tabs[next].click();
}

const FADE = 40;

export function PhonePills<V extends string = string>({ pills, value, onChange, label, tabs }: PhonePillsProps<V>) {
  const row = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState(false);
  const check = () => {
    const el = row.current;
    if (!el) return;
    setFade(el.scrollWidth - el.clientWidth - el.scrollLeft > 1);
  };
  useLayoutEffect(() => {
    check();
    const el = row.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [pills.length]);
  return (
    <div style={{ position: "relative" }}>
      <div
        ref={row}
        data-ui="phone-pills"
        className="bg-scroll-row"
        role={tabs ? "tablist" : "group"}
        aria-label={label}
        onKeyDown={tabs ? moveTab : undefined}
        onScroll={check}
        style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", padding: `10px ${PHONE_MARGIN}px` }}
      >
        {pills.map((pill) =>
          pill.href !== undefined ? (
            <LinkPill key={pill.value} pill={pill} on={pill.value === value} />
          ) : (
            <FilterChip
              key={pill.value}
              label={pill.label}
              count={pill.count}
              leading={pill.icon ? <MobileIcon name={pill.icon} size={16} /> : undefined}
              on={pill.value === value}
              onClick={() => onChange(pill.value)}
              tab={tabs ? { id: tabs.idOf(pill.value), controls: tabs.controls } : undefined}
              style={{
                height: PHONE_PILL,
                minHeight: PHONE_PILL,
                padding: "0 14px",
                borderRadius: PHONE_PILL / 2,
                background: pill.value === value ? t.text : t.module,
                color: pill.value === value ? t.bg : t.text2,
                fontSize: 13,
                fontWeight: 500,
                lineHeight: "16px",
              }}
            />
          ),
        )}
      </div>
      {fade ? (
        <span aria-hidden="true" data-testid="phone-pills-fade" style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: FADE, pointerEvents: "none", background: `linear-gradient(to right, transparent, ${t.bg})` }} />
      ) : null}
    </div>
  );
}

export default PhonePills;
