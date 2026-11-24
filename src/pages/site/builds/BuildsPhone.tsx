/* Prompt 21: the phone's pieces of Builds, below 768px. Everything here is drawn only when `useIsPhone()` says so: the desktop
   views branch to these and keep their own output at 768 and up.

   One look: the page on the Page shade, one Panel card per build (radius 12, no lines), controls as Card buttons 44 tall, and
   every choice that was a menu or a dialog on desktop a sheet from the bottom. Pure: typed props, no fetching. */

import { useId, type CSSProperties, type ReactNode } from "react";

import { MobileIcon } from "@/components/brand/MobileIcon";
import { PhoneBottomSheet } from "@/components/phone/BottomSheet";
import { BigButton } from "@/components/phone/BigButton";
import { PHONE_MARGIN } from "@/components/shell/chromeSize";
import { Skeleton } from "@/components/brand/Skeleton";
import { ring } from "@/lib/theme/controls";
import { TOUCH_MIN } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import type { TableChip } from "./BuildsTableView";

/** A line of the page's own type on a phone: 15/20 for rows, 13/16 for meta. */
export const phoneText = (px: 12 | 13 | 15 | 17 | 20, weight: 400 | 500 | 600, color: string, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: FIGTREE,
  fontSize: px,
  fontWeight: weight,
  lineHeight: px === 20 ? "24px" : px === 17 ? "22px" : px === 15 ? "20px" : "16px",
  color,
  ...extra,
});

/** The row of controls: scrolls sideways when they do not fit, 8 apart. */
export const PHONE_ROW_STYLE: CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: `12px ${PHONE_MARGIN}px 0`, overflowX: "auto", scrollbarWidth: "none" };

/** A control's hit grown to 44 by a ghost's own padding: for a text button drawn smaller than that. */
const ghost = (color: string): CSSProperties => ({ background: "none", border: 0, padding: 0, minHeight: TOUCH_MIN, minWidth: TOUCH_MIN, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", ...phoneText(13, 500, color) });

/* ── the active filters ── */

function ChipRemove({ name, value, onRemove }: { name: string; value: string; onRemove: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-label={`Remove ${name}: ${value}`}
      onClick={onRemove}
      {...handlers}
      style={{ boxSizing: "content-box", width: 28, height: 28, padding: (TOUCH_MIN - 28) / 2, margin: -((TOUCH_MIN - 28) / 2 - 2), border: 0, background: "none", color: t.text2, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", borderRadius: 999, ...ring(state.focusVisible) }}
    >
      <MobileIcon name="close" size={16} />
    </button>
  );
}

/** Chips 32 tall, radius 8, Card fill, the name in Text 2 and the value in Text; then Clear all as a ghost. */
export function PhoneActiveFilters({ chips, onRemove, onClearAll }: { chips: readonly TableChip[]; onRemove: (key: string) => void; onClearAll: () => void }) {
  const clear = useInteractive<HTMLButtonElement>();
  return (
    <div role="group" aria-label="Active filters" data-focus-list="" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: `12px ${PHONE_MARGIN}px 0` }}>
      {chips.map((chip) => (
        <span key={chip.key} data-ui="active-filter-chip" style={{ boxSizing: "border-box", height: 32, display: "inline-flex", alignItems: "center", gap: 6, padding: "0 6px 0 12px", borderRadius: 8, background: t.module, ...phoneText(13, 500, t.text), maxWidth: "100%" }}>
          <span style={{ color: t.text2, whiteSpace: "nowrap" }}>{chip.name}</span>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chip.value}</span>
          <ChipRemove name={chip.name} value={chip.value} onRemove={() => onRemove(chip.key)} />
        </span>
      ))}
      <button type="button" onClick={onClearAll} {...clear.handlers} style={{ ...ghost(t.text2), padding: "0 8px", ...ring(clear.state.focusVisible) }}>
        Clear all
      </button>
    </div>
  );
}

/* ── choosing in a sheet ── */

/** A checkbox row: 44 tall, a 20 box (radius 5; chosen Mint with a tick in On-mint), the label, and an optional mono count. The
    native checkbox covers the whole row, so the row is the target and the label names it. */
export function PhoneCheckRow({ label, checked, disabled, count, onChange, dim }: { label: string; checked: boolean; disabled?: boolean; count?: number | string; onChange: () => void; dim?: boolean }) {
  const { state, handlers } = useInteractive<HTMLInputElement>();
  return (
    <label data-ui="phone-check-row" style={{ position: "relative", boxSizing: "border-box", minHeight: TOUCH_MIN, display: "flex", alignItems: "center", gap: 12, padding: `0 ${PHONE_MARGIN}px`, cursor: disabled ? "default" : "pointer", opacity: dim ? 0.5 : 1, ...phoneText(15, 400, checked ? t.text : t.text2) }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} {...handlers} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", margin: 0, opacity: 0, cursor: "inherit" }} />
      <span aria-hidden="true" style={{ boxSizing: "border-box", width: 20, height: 20, flexShrink: 0, borderRadius: 5, display: "inline-flex", alignItems: "center", justifyContent: "center", background: checked ? t.brandAccent : t.module, color: t.onBrandAccent, boxShadow: !checked ? `inset 0 0 0 1px ${t.fieldEdge}` : undefined, ...(state.focusVisible ? { outline: `2px solid ${t.focusRing}`, outlineOffset: 2 } : null) }}>
        {checked ? <MobileIcon name="check" size={16} strokeWidth={2.5} /> : null}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
      {count !== undefined ? <span style={{ fontFamily: DM_MONO, fontSize: 13, color: t.label }}>{count}</span> : null}
    </label>
  );
}

/** A group's name over its rows: 13 Text 3. */
export function PhoneGroupLabel({ children }: { children: ReactNode }) {
  return <h3 style={{ margin: 0, padding: `16px ${PHONE_MARGIN}px 4px`, ...phoneText(13, 400, t.label) }}>{children}</h3>;
}

/** A line under a sheet's header, 13 Text 3. */
export function PhoneNote({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p id={id} style={{ margin: 0, padding: `0 ${PHONE_MARGIN}px 4px`, ...phoneText(13, 400, t.label) }}>
      {children}
    </p>
  );
}

export interface SortChoice {
  id: string;
  name: string;
  on: boolean;
}

function ChoiceRow({ label, on, onSelect }: { label: string; on: boolean; onSelect: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onSelect} {...handlers} style={{ boxSizing: "border-box", width: "100%", minHeight: 52, display: "flex", alignItems: "center", gap: 12, padding: `0 ${PHONE_MARGIN}px`, border: 0, background: "none", textAlign: "left", cursor: "pointer", ...phoneText(15, on ? 600 : 400, t.text), ...ring(state.focusVisible) }}>
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
      {on ? <MobileIcon name="check" size={20} /> : null}
    </button>
  );
}

/** Sort: the sortable columns as 52-tall rows, the chosen one ticked. Choosing closes the sheet and sorts. */
export function SortSheet({ open, onOpenChange, choices, onChoose }: { open: boolean; onOpenChange: (open: boolean) => void; choices: readonly SortChoice[]; onChoose: (id: string) => void }) {
  return (
    <PhoneBottomSheet open={open} onOpenChange={onOpenChange} title="Sort" height="content" dirty={false}>
      <div role="radiogroup" aria-label="Sort" style={{ paddingBottom: 8 }}>
        {choices.map((choice) => (
          <ChoiceRow
            key={choice.id}
            label={choice.name}
            on={choice.on}
            onSelect={() => {
              onChoose(choice.id);
              onOpenChange(false);
            }}
          />
        ))}
      </div>
    </PhoneBottomSheet>
  );
}

export interface CheckGroup {
  name?: string;
  rows: readonly { id: string; label: string; checked: boolean; disabled?: boolean; dim?: boolean }[];
}

/** A full sheet of checkbox rows by group, with a note under the header and an optional ghost in the footer. Columns and Facets shown. */
export function CheckSheet({ open, onOpenChange, title, titleNote, note, groups, onToggle, reset }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; titleNote?: ReactNode; note?: string; groups: readonly CheckGroup[]; onToggle: (id: string) => void; reset?: { label: string; onSelect: () => void } }) {
  const ghostButton = useInteractive<HTMLButtonElement>();
  return (
    <PhoneBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      titleNote={titleNote}
      height="full"
      dirty={false}
      footer={
        reset
          ? {
              actions: (
                <button type="button" onClick={reset.onSelect} {...ghostButton.handlers} style={{ ...ghost(t.text2), minHeight: 48, padding: "0 8px", fontSize: 15, fontWeight: 600, ...ring(ghostButton.state.focusVisible) }}>
                  {reset.label}
                </button>
              ),
            }
          : undefined
      }
    >
      {note ? <PhoneNote>{note}</PhoneNote> : null}
      <div role="group" aria-label={title} style={{ paddingBottom: 16 }}>
        {groups.map((group, at) => (
          <div key={group.name ?? at} role={group.name ? "group" : undefined} aria-label={group.name}>
            {group.name ? <PhoneGroupLabel>{group.name}</PhoneGroupLabel> : null}
            {group.rows.map((row) => (
              <PhoneCheckRow key={row.id} label={row.label} checked={row.checked} disabled={row.disabled} dim={row.dim} onChange={() => onToggle(row.id)} />
            ))}
          </div>
        ))}
      </div>
    </PhoneBottomSheet>
  );
}

/** The footer's "Add a calculation": a sheet of every calculation the columns allow, ticked where it is on. */
export function CalculationSheet({ open, onOpenChange, options, onToggle }: { open: boolean; onOpenChange: (open: boolean) => void; options: readonly { key: string; label: string; on: boolean }[]; onToggle: (key: string) => void }) {
  return (
    <PhoneBottomSheet open={open} onOpenChange={onOpenChange} title="Add a calculation" height="content" dirty={false}>
      <div role="group" aria-label="Calculations" style={{ paddingBottom: 8 }}>
        {options.map((option) => (
          <PhoneCheckRow key={option.key} label={option.label} checked={option.on} onChange={() => onToggle(option.key)} />
        ))}
      </div>
    </PhoneBottomSheet>
  );
}

/* ── the rest of a list ── */

/** "Show more builds": a full-width big button, 16 either side. */
export function PhoneShowMore({ onMore, loading }: { onMore: () => void; loading?: boolean }) {
  return (
    <div style={{ padding: `8px ${PHONE_MARGIN}px 0` }}>
      <BigButton full onClick={onMore} disabled={loading}>
        {loading ? "Loading" : "Show more builds"}
      </BigButton>
    </div>
  );
}

export { PhoneCardSkeletons } from "./BuildsPhoneSkeletons";

/** A card on Panel: radius 12, padding 12 14, 8 between its parts, margin 0 16 8. A link, an article, or a bare block. */
export const PHONE_CARD: CSSProperties = { boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 8, margin: `0 ${PHONE_MARGIN}px 8px`, padding: "12px 14px", borderRadius: 12, background: t.surface, color: t.text, textDecoration: "none", minWidth: 0 };

/** A card's accessible name comes from its title, so a link card reads as the build and not as every number in it. */
export function useCardTitleId(): string {
  return useId();
}
