/* Prompt 21 and 29f: the Builds Table on a phone (`07-builds.jpg`): the lens pills in the 52 row under the bar (which carries the
   structural line), the active filters when there are any, then one row per build: its name 17/22 600 over its facts 13/16 Text 2
   ("3 sessions · 12 steps · @maker"), and its cover as a 48 square at the right. No lines between rows; the whole row is the link.
   The views (Table, Maps, Classification) and the table's own controls (Filters, Sort) are rows of the bar's More sheet, so no row
   of controls pushes the list down. Pure: the view-model comes from `BuildsTableView`, which knows the column names. */

import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { CoverFallback } from "@/components/brand/CoverFallback";
import { PHONE_ROW_STYLE as PILL_ROW_STYLE, usePhoneRowLine } from "@/components/phone/phoneRow";
import { PhonePills } from "@/components/phone/PhonePills";
import { useRegisterPageBar, type MoreItem } from "@/components/shell/phoneBarRegistry";
import type { TextTab } from "@/components/vision/TextTabs";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { phoneUpdating } from "@/lib/theme/motion";
import { t } from "@/lib/theme/tokens";

import { MobileIcon } from "@/components/brand/MobileIcon";
import { PHONE_MARGIN } from "@/components/shell/chromeSize";

import { ellipsis } from "./BuildsFrame";
import {
  CalculationSheet,
  PhoneActiveFilters,
  PhoneShowMore,
  SortSheet,
  phoneText,
  useCardTitleId,
  type CheckGroup,
  type SortChoice,
} from "./BuildsPhone";
import type { TableChip } from "./BuildsTableView";

export interface PhoneNumber {
  /** The column's name, under the value. */
  name: string;
  value: string;
  /** Nothing to show: drawn "0" (or "Not measured") in Text 3. */
  empty: boolean;
  /** A count is mono; the cost is words. */
  mono: boolean;
}

export interface PhoneCardView {
  id: string;
  href: string;
  title: string;
  maker: string;
  /** "Web app · Food and drink". */
  facts: string;
  numbers: readonly PhoneNumber[];
  /** 29f: the row's facts, "3 sessions · 12 steps · @maker". */
  line?: string;
}

export interface PhoneView {
  value: string;
  label: string;
  href: string;
}

export interface PhoneTableProps {
  lenses: readonly TextTab[];
  lens: string;
  onLens: (lens: string) => void;
  updating?: boolean;
  activeCount: number;
  onOpenFilters: () => void;
  setName?: string;
  /** The sheet of sortable columns; the name on the button is the chosen one's. */
  sort: { current: string; choices: readonly SortChoice[]; onChoose: (id: string) => void };
  /** Kept for the page: with no numbers drawn on a row, the phone has no Columns sheet. */
  columns?: { label: string; groups: readonly CheckGroup[]; onToggle: (id: string) => void; onReset?: () => void };
  chips: readonly TableChip[];
  onRemoveChip: (key: string) => void;
  onClearAll: () => void;
  cards: readonly PhoneCardView[];
  /** The footer's words: "Median 11, Steps", then the calculations added. */
  summary: readonly string[];
  calculations: readonly { key: string; text: string; onRemove: () => void }[];
  calculate?: { options: readonly { key: string; label: string; on: boolean }[]; onToggle: (key: string) => void };
  onMore?: () => void;
  loadingMore?: boolean;
  empty?: ReactNode;
  /** 29f: the other views, as rows of the bar's More sheet (the page hands every view; the current one is left out). */
  views?: readonly PhoneView[];
  /** The view this table is. */
  view?: string;
}

/** Rows past the first screen are skipped until near. */
const FIRST_SCREEN_ROWS = 10;
const ROW_HEIGHT = 64;
/** The cover: a 48 square, radius 9. */
const COVER = 48;
const COVER_RADIUS = 9;

/** "3 sessions · 12 steps · @maker": the counts the build has, then its maker. */
export function rowFacts(sessions: number | null, steps: number | null, maker: string): string {
  const plural = (n: number, one: string) => `${n.toLocaleString("en-GB")} ${one}${n === 1 ? "" : "s"}`;
  return [sessions === null ? "" : plural(sessions, "session"), steps === null ? "" : plural(steps, "step"), `@${maker}`].filter(Boolean).join(" · ");
}

function BuildRow({ card, index }: { card: PhoneCardView; index: number }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  const titleId = useCardTitleId();
  return (
    <Link
      to={card.href}
      aria-labelledby={titleId}
      data-testid="build-card"
      {...handlers}
      style={{
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 12,
        minHeight: ROW_HEIGHT,
        padding: `10px ${PHONE_MARGIN}px`,
        color: t.text,
        textDecoration: "none",
        minWidth: 0,
        ...(index >= FIRST_SCREEN_ROWS ? { contentVisibility: "auto", containIntrinsicSize: `auto ${ROW_HEIGHT}px` } : null),
        ...ring(state.focusVisible),
      }}
    >
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span id={titleId} style={{ minWidth: 0, ...phoneText(17, 600, t.text), ...ellipsis }}>
          {card.title}
        </span>
        <span style={{ minWidth: 0, ...phoneText(13, 400, t.text2), ...ellipsis }}>{card.line ?? `@${card.maker}`}</span>
      </span>
      <span aria-hidden="true" data-testid="build-cover" style={{ position: "relative", flexShrink: 0, width: COVER, height: COVER, borderRadius: COVER_RADIUS, overflow: "hidden", background: t.module }}>
        <CoverFallback seed={card.id} radius={COVER_RADIUS} />
      </span>
    </Link>
  );
}

function RemoveCalculation({ text, onRemove }: { text: string; onRemove: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button type="button" aria-label={`Remove ${text}`} onClick={onRemove} {...handlers} style={{ minWidth: 44, minHeight: 44, margin: "-14px -8px", padding: 0, border: 0, background: "none", color: t.label, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", borderRadius: 999, ...ring(state.focusVisible) }}>
      <MobileIcon name="close" size={16} />
    </button>
  );
}

function AddCalculation({ onOpen }: { onOpen: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button type="button" onClick={onOpen} aria-haspopup="dialog" {...handlers} style={{ minHeight: 44, display: "inline-flex", alignItems: "center", gap: 6, padding: 0, border: 0, background: "none", cursor: "pointer", ...phoneText(13, 500, t.text2), ...ring(state.focusVisible) }}>
      <MobileIcon name="new" size={16} />
      Add a calculation
    </button>
  );
}

export function PhoneTable(props: PhoneTableProps) {
  const { lenses, lens, onLens, updating, activeCount, onOpenFilters, sort, chips, onRemoveChip, onClearAll, cards, summary, calculations, calculate, onMore, loadingMore, empty, views, view = "table" } = props;
  const [sortOpen, setSortOpen] = useState(false);
  const [calculateOpen, setCalculateOpen] = useState(false);
  const showCards = !(cards.length === 0 && empty);
  usePhoneRowLine(true);

  /* More: the other views as links, then the table's own controls. Nothing here is a row of controls on the page. */
  const more: MoreItem[] = [
    ...(views ?? []).filter((entry) => entry.value !== view).map((entry): MoreItem => ({ label: entry.label, to: entry.href })),
    { label: activeCount > 0 ? `Filters, ${activeCount} on` : "Filters", onSelect: onOpenFilters },
    { label: sort.current ? `Sort: ${sort.current}` : "Sort", onSelect: () => setSortOpen(true) },
  ];
  useRegisterPageBar({ more });

  return (
    <div data-testid="builds-table">
      <div style={PILL_ROW_STYLE}>
        <PhonePills docked label="Lens" pills={lenses.map((tab) => ({ value: tab.value, label: tab.label, count: tab.count as number | string | undefined }))} value={lens} onChange={onLens} tabs={{ idOf: (value) => `builds-lens-${value}`, controls: "builds-table-region" }} />
      </div>
      <span role="status" className="sr-only">
        {updating ? "Updating" : ""}
      </span>

      <PhoneActiveFilters chips={chips} onRemove={onRemoveChip} onClearAll={onClearAll} />

      {showCards ? (
        <div id="builds-table-region" role="region" aria-label="Builds table" aria-busy={updating === true} style={{ paddingTop: 4, ...phoneUpdating(updating) }}>
          {cards.map((card, index) => (
            <BuildRow key={card.id} card={card} index={index} />
          ))}
          {summary.length > 0 || calculations.length > 0 || calculate ? (
            <div style={{ padding: `4px ${PHONE_MARGIN}px 0` }}>
              <p style={{ margin: 0, ...phoneText(13, 400, t.label) }}>
                {summary.join(" · ")}
                {calculations.map((calculation, at) => (
                  <span key={calculation.key}>
                    {summary.length > 0 || at > 0 ? " · " : null}
                    {calculation.text}
                    <RemoveCalculation text={calculation.text} onRemove={calculation.onRemove} />
                  </span>
                ))}
              </p>
              {calculate ? <AddCalculation onOpen={() => setCalculateOpen(true)} /> : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ margin: `20px ${PHONE_MARGIN}px 0` }}>{empty}</div>
      )}

      {onMore ? <PhoneShowMore onMore={onMore} loading={loadingMore} /> : null}

      <SortSheet open={sortOpen} onOpenChange={setSortOpen} choices={sort.choices} onChoose={sort.onChoose} />
      {calculate ? <CalculationSheet open={calculateOpen} onOpenChange={setCalculateOpen} options={calculate.options} onToggle={calculate.onToggle} /> : null}
    </div>
  );
}
