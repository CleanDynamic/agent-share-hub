/* Prompt 21: the Builds Table on a phone: the lens tabs, the three controls (Filters, Sort, Columns), the active filters, then one
   Panel card per build in place of the rows. The whole card is the link. The three numbers on a card are the first three number
   columns the reader chose, in their order. Pure: the view-model comes from `BuildsTableView`, which knows the column names. */

import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { PhoneTabs } from "@/components/phone/PhoneTabs";
import type { TextTab } from "@/components/vision/TextTabs";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

import { MobileIcon } from "@/components/brand/MobileIcon";
import { PHONE_MARGIN } from "@/components/shell/chromeSize";

import { BuildsControl, FiltersButton, UpdatingStatus, ellipsis } from "./BuildsFrame";
import {
  CalculationSheet,
  CheckSheet,
  PHONE_CARD,
  PHONE_ROW_STYLE,
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
}

/** Cards past the first screen are skipped until near. */
const FIRST_SCREEN_CARDS = 8;
const CARD_HEIGHT = 118;

function Numbers({ numbers }: { numbers: readonly PhoneNumber[] }) {
  if (numbers.length === 0) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${numbers.length}, minmax(0, 1fr))`, columnGap: 8 }}>
      {numbers.map((entry) => (
        <div key={entry.name} style={{ minWidth: 0 }}>
          <div style={{ ...phoneText(15, 500, entry.empty ? t.label : t.text, { ...(entry.mono ? { fontFamily: DM_MONO } : null), fontVariantNumeric: "tabular-nums" }), ...ellipsis }}>{entry.value}</div>
          <div style={{ ...phoneText(12, 400, t.label), lineHeight: "16px", ...ellipsis }}>{entry.name}</div>
        </div>
      ))}
    </div>
  );
}

function BuildCard({ card, index }: { card: PhoneCardView; index: number }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  const titleId = useCardTitleId();
  return (
    <Link
      to={card.href}
      aria-labelledby={titleId}
      data-testid="build-card"
      {...handlers}
      style={{ ...PHONE_CARD, ...(index >= FIRST_SCREEN_CARDS ? { contentVisibility: "auto", containIntrinsicSize: `auto ${CARD_HEIGHT}px` } : null), ...ring(state.focusVisible) }}
    >
      <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, minWidth: 0 }}>
        <span id={titleId} style={{ minWidth: 0, ...phoneText(15, 600, t.text), ...ellipsis }}>
          {card.title}
        </span>
        <span style={{ flexShrink: 0, maxWidth: "45%", ...phoneText(13, 400, t.label), ...ellipsis }}>@{card.maker}</span>
      </span>
      {card.facts ? <span style={{ ...phoneText(13, 400, t.text2), display: "block" }}>{card.facts}</span> : null}
      <Numbers numbers={card.numbers} />
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
  const { lenses, lens, onLens, updating, activeCount, onOpenFilters, setName, sort, columns, chips, onRemoveChip, onClearAll, cards, summary, calculations, calculate, onMore, loadingMore, empty } = props;
  const [sortOpen, setSortOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [calculateOpen, setCalculateOpen] = useState(false);
  const showCards = !(cards.length === 0 && empty);
  return (
    <div data-testid="builds-table">
      <PhoneTabs tabs={lenses} value={lens} onChange={onLens} label="Lens" />

      <div style={PHONE_ROW_STYLE}>
        <FiltersButton activeCount={activeCount} setName={setName} onClick={onOpenFilters} />
        <BuildsControl aria-label={sort.current ? `Sort: ${sort.current}` : "Sort"} aria-haspopup="dialog" onClick={() => setSortOpen(true)}>
          <span style={{ color: t.text2 }}>Sort</span>
          {sort.current ? <span>{sort.current}</span> : null}
        </BuildsControl>
        {columns ? (
          <BuildsControl aria-label={`Columns: ${columns.label}`} aria-haspopup="dialog" onClick={() => setColumnsOpen(true)}>
            <span style={{ color: t.text2 }}>Columns</span>
            <span>{columns.label}</span>
          </BuildsControl>
        ) : null}
        <UpdatingStatus updating={updating} />
      </div>

      <PhoneActiveFilters chips={chips} onRemove={onRemoveChip} onClearAll={onClearAll} />

      {showCards ? (
        <div role="region" aria-label="Builds table" aria-busy={updating === true} style={{ paddingTop: 12, ...(updating ? { opacity: 0.5 } : null) }}>
          {cards.map((card, index) => (
            <BuildCard key={card.id} card={card} index={index} />
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
      {columns ? (
        <CheckSheet
          open={columnsOpen}
          onOpenChange={setColumnsOpen}
          title="Columns"
          titleNote={columns.label}
          note="On a phone, the first three numbers you choose show on each card."
          groups={columns.groups}
          onToggle={columns.onToggle}
          reset={columns.onReset ? { label: "Back to the default columns", onSelect: columns.onReset } : undefined}
        />
      ) : null}
      {calculate ? <CalculationSheet open={calculateOpen} onOpenChange={setCalculateOpen} options={calculate.options} onToggle={calculate.onToggle} /> : null}
    </div>
  );
}
