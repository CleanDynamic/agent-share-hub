/* SV-11: the Builds filter panel, pure: typed props, no fetching, no router hooks. The board is
   `design/reference/vision/dusk/builds-table.html`; the panel is quiet (series README, Visual grammar 2): sections on the
   surface with a hairline above each, and one boxed tile, "Add a filter".

   Each kind of section is its own component, defined at module level. A section that is not live on the page is not
   given to the view (SV-11 Part 3), so the dev page draws every one and the live page the ones that work.

   REAL CONTROLS. A checklist is checkboxes with their labels; a number filter is a two-handle slider, each handle
   keyboard operable (arrows, Page Up and Down, Home and End) with `aria-valuetext`; the histogram is hidden from
   screen readers and the group carries the words; a scale is a row of buttons with `aria-pressed`; each grip is a
   button named "Move <filter>". Focus rings stay. */

import * as SliderPrimitive from "@radix-ui/react-slider";
import type { CSSProperties, ReactNode } from "react";

import { Checkbox } from "@/components/brand/Checkbox";
import { Glyph } from "@/components/brand/Glyph";
import { InnerTile } from "@/components/vision/InnerTile";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";

import { BuildsControl, BuildsTextButton, text } from "./BuildsFrame";

/* ── props ── */

export type WordOrder = "az" | "count" | "scale";

export interface WordOption {
  key: string;
  label: string;
  count: number;
  checked: boolean;
}

export interface WordSection {
  kind: "word";
  id: string;
  name: string;
  /** "az" or "count" shows the A–Z · Count pair; "scale" shows "Scale order" and keeps the taxonomy's order. */
  order: WordOrder;
  options: readonly WordOption[];
}

export interface RangeSection {
  kind: "range";
  id: string;
  name: string;
  /** "3 or more", "5 to 30". */
  valueText: string;
  /** Bars from 0 to 1, left to right, and whether each is inside the chosen range. */
  histogram: readonly { height: number; inRange: boolean }[];
  min: number;
  max: number;
  value: readonly [number, number];
  /** The words for a value, for `aria-valuetext`: "3 or more". */
  describe: (value: number, end: "min" | "max") => string;
  endLabels: readonly [string, string];
  /** The board's Steps: the histogram alone, 28 high, with no slider under it. */
  bare?: boolean;
}

export interface ScaleSection {
  kind: "scale";
  id: string;
  name: string;
  segments: readonly { key: string; label: string; on: boolean }[];
  endLabels: readonly [string, string];
}

export interface ClosedSection {
  kind: "closed";
  id: string;
  name: string;
  /** "Any", or the chosen value. */
  value: string;
}

export type FilterSection = WordSection | RangeSection | ScaleSection | ClosedSection;

export interface SavedSetRow {
  id: string;
  name: string;
  count: number;
  href: string;
}

export interface CatalogueGroup {
  name: string;
  count: number;
  /** The filters in the group, as one sentence. */
  items: string;
}

export interface BuildsFiltersViewProps {
  activeCount: number;
  onAdd?: () => void;
  /** Absent: the section is not drawn. */
  savedSets?: { rows: readonly SavedSetRow[]; onSaveCurrent: () => void };
  sections: readonly FilterSection[];
  catalogue?: { total: number; groups: readonly CatalogueGroup[] };
  onToggleOption: (sectionId: string, key: string) => void;
  onOrder?: (sectionId: string, order: "az" | "count") => void;
  onRange?: (sectionId: string, value: readonly [number, number]) => void;
  onToggleSegment?: (sectionId: string, key: string) => void;
  onOpenClosed?: (sectionId: string) => void;
  /** Absent: no grips, because filters cannot be moved yet. */
  onMove?: (sectionId: string, direction: "up" | "down") => void;
  /** Below 1000 the panel is closed to its heads. */
  collapsed?: boolean;
}

/* ── pieces ── */

const rule: CSSProperties = { padding: "20px 0", borderTop: `1px solid ${t.hairline}` };
const name12: CSSProperties = text(12.5, 500, t.text);
const small = (color: string): CSSProperties => text(12, 400, color);

/** The faint grip. A button named "Move <filter>": a click opens nothing, the arrows move the filter. */
function Grip({ name, onMove }: { name: string; onMove?: (direction: "up" | "down") => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  if (!onMove) return <span aria-hidden="true" style={{ width: 16, height: 20, flexShrink: 0 }} />;
  return (
    <button
      type="button"
      aria-label={`Move ${name}`}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          onMove(event.key === "ArrowUp" ? "up" : "down");
        }
      }}
      {...handlers}
      style={{ width: 16, height: 20, flexShrink: 0, display: "grid", placeItems: "center", background: "none", border: 0, padding: 0, color: t.line, cursor: "grab", ...ring(state.focusVisible) }}
    >
      <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden="true">
        {[2, 6, 10].flatMap((y) => [2, 6].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill="currentColor" />))}
      </svg>
    </button>
  );
}

function SectionHead({ name, onMove, right }: { name: string; onMove?: (direction: "up" | "down") => void; right: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Grip name={name} onMove={onMove} />
      <h3 style={{ ...name12, margin: 0, flex: 1 }}>{name}</h3>
      {right}
    </div>
  );
}

/* ── the head ── */

function FiltersHead({ activeCount, onAdd }: { activeCount: number; onAdd?: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, paddingBottom: 20 }}>
      <div>
        <h2 style={{ ...text(14, 500, t.text), margin: 0, lineHeight: 1.3 }}>Filters</h2>
        <p style={{ ...text(12, 400, t.label), margin: "2px 0 0", lineHeight: "normal" }}>{activeCount} active · drag to reorder</p>
      </div>
      {onAdd ? <BuildsControl onClick={onAdd}>Add</BuildsControl> : null}
    </div>
  );
}

/* ── saved filter sets ── */

function SavedSetLink({ row }: { row: SavedSetRow }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <a
      href={row.href}
      {...handlers}
      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 36, textDecoration: "none", ...text(12.5, 400, state.hovered ? t.text : t.text2), ...ring(state.focusVisible) }}
    >
      <span>{row.name}</span>
      <span style={small(t.label)}>{row.count}</span>
    </a>
  );
}

function SavedSets({ rows, onSaveCurrent }: { rows: readonly SavedSetRow[]; onSaveCurrent: () => void }) {
  return (
    <section aria-label="Saved filter sets" style={rule}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 style={{ ...name12, margin: 0 }}>Saved filter sets</h3>
        <BuildsTextButton onClick={onSaveCurrent}>Save current</BuildsTextButton>
      </div>
      <div style={{ marginTop: 6 }}>
        {rows.map((row) => (
          <SavedSetLink key={row.id} row={row} />
        ))}
      </div>
    </section>
  );
}

/* ── a word filter ── */

function OrderPair({ order, onOrder }: { order: "az" | "count"; onOrder?: (order: "az" | "count") => void }) {
  return (
    <span style={small(t.label)}>
      <BuildsTextButton aria-pressed={order === "az"} color={order === "az" ? t.text : t.label} onClick={() => onOrder?.("az")}>
        A–Z
      </BuildsTextButton>
      <span aria-hidden="true" style={{ color: t.label }}> · </span>
      <BuildsTextButton aria-pressed={order === "count"} color={order === "count" ? t.text : t.label} onClick={() => onOrder?.("count")}>
        Count
      </BuildsTextButton>
    </span>
  );
}

function OptionRow({ option, onToggle }: { option: WordOption; onToggle: () => void }) {
  return (
    <label style={{ display: "grid", gridTemplateColumns: "14px 1fr auto", columnGap: 10, alignItems: "center", minHeight: 30, cursor: "pointer", ...text(12.5, 400, option.checked ? t.text : t.text2) }}>
      <Checkbox checked={option.checked} onChange={onToggle} style={{ width: 14, height: 14 }} />
      <span>{option.label}</span>
      <span style={small(t.label)}>{option.count}</span>
    </label>
  );
}

function WordFilter({ section, onToggle, onOrder, onMove }: { section: WordSection; onToggle: (key: string) => void; onOrder?: (order: "az" | "count") => void; onMove?: (direction: "up" | "down") => void }) {
  return (
    <section aria-label={section.name} style={rule}>
      <SectionHead
        name={section.name}
        onMove={onMove}
        right={section.order === "scale" ? <span style={small(t.label)}>Scale order</span> : <OrderPair order={section.order} onOrder={onOrder} />}
      />
      <div role="group" aria-label={`${section.name} values`} style={{ marginTop: 10 }}>
        {section.options.map((option) => (
          <OptionRow key={option.key} option={option} onToggle={() => onToggle(option.key)} />
        ))}
      </div>
    </section>
  );
}

/* ── a number filter ── */

function Histogram({ bars, height }: { bars: RangeSection["histogram"]; height: number }) {
  return (
    <div aria-hidden="true" style={{ display: "flex", alignItems: "flex-end", gap: 2, height, marginTop: 14 }}>
      {bars.map((bar, index) => (
        <span key={index} style={{ flex: 1, height: `${Math.round(bar.height * 100)}%`, borderRadius: 1, background: bar.inRange ? t.label : t.line }} />
      ))}
    </div>
  );
}

function RangeFilter({ section, onChange, onMove }: { section: RangeSection; onChange?: (value: readonly [number, number]) => void; onMove?: (direction: "up" | "down") => void }) {
  const [low, high] = section.value;
  const thumb: CSSProperties = { display: "block", width: 12, height: 12, borderRadius: 6, background: t.text, outline: "none" };
  const focus = (event: { currentTarget: HTMLElement }, on: boolean) => {
    event.currentTarget.style.boxShadow = on ? `0 0 0 2px ${t.frame}, 0 0 0 4px ${t.text}` : "none";
  };
  return (
    <section aria-label={section.name} style={rule}>
      <SectionHead name={section.name} onMove={onMove} right={<span style={small(t.text2)}>{section.valueText}</span>} />
      <div role="group" aria-label={`${section.name}, ${section.valueText}`}>
        <Histogram bars={section.histogram} height={section.bare ? 28 : 32} />
        {section.bare ? null : (
        <>
        <SliderPrimitive.Root
          min={section.min}
          max={section.max}
          step={1}
          minStepsBetweenThumbs={0}
          value={[low, high]}
          onValueChange={(value) => onChange?.([value[0], value[1]])}
          style={{ position: "relative", display: "flex", alignItems: "center", height: 14, marginTop: 4, touchAction: "none", userSelect: "none" }}
        >
          <SliderPrimitive.Track style={{ position: "relative", flexGrow: 1, height: 2, borderRadius: 1, background: t.line }}>
            <SliderPrimitive.Range style={{ position: "absolute", height: "100%", borderRadius: 1, background: t.text }} />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb aria-label={`${section.name} from`} aria-valuetext={section.describe(low, "min")} style={thumb} onFocus={(e) => focus(e, true)} onBlur={(e) => focus(e, false)} />
          <SliderPrimitive.Thumb aria-label={`${section.name} to`} aria-valuetext={section.describe(high, "max")} style={thumb} onFocus={(e) => focus(e, true)} onBlur={(e) => focus(e, false)} />
        </SliderPrimitive.Root>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, ...text(11.5, 400, t.label) }}>
          <span>{section.endLabels[0]}</span>
          <span>{section.endLabels[1]}</span>
        </div>
        </>
        )}
      </div>
    </section>
  );
}

/* ── a scale filter ── */

function Segment({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
      {...handlers}
      style={{ height: 18, margin: "-6px 0", padding: 0, background: "none", border: 0, display: "flex", alignItems: "center", cursor: "pointer", ...ring(state.focusVisible) }}
    >
      <span style={{ display: "block", width: "100%", height: 6, borderRadius: 2, background: on ? t.text : t.line }} />
    </button>
  );
}

function ScaleFilter({ section, onToggle, onMove }: { section: ScaleSection; onToggle?: (key: string) => void; onMove?: (direction: "up" | "down") => void }) {
  const chosen = section.segments.filter((segment) => segment.on).map((segment) => segment.label).join(", ");
  return (
    <section aria-label={section.name} style={rule}>
      <SectionHead name={section.name} onMove={onMove} right={<span style={small(t.label)}>Scale order</span>} />
      <div role="group" aria-label={`${section.name}: ${chosen || "any"}`} style={{ marginTop: 14, display: "grid", gridTemplateColumns: `repeat(${section.segments.length}, minmax(0, 1fr))`, gap: 2 }}>
        {section.segments.map((segment) => (
          <Segment key={segment.key} label={segment.label} on={segment.on} onClick={() => onToggle?.(segment.key)} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, ...text(11.5, 400, t.label) }}>
        <span>{section.endLabels[0]}</span>
        <span>{section.endLabels[1]}</span>
      </div>
    </section>
  );
}

/* ── closed filters ── */

function ClosedRow({ section, onOpen }: { section: ClosedSection; onOpen?: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onOpen}
      {...handlers}
      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minHeight: 44, background: "none", border: 0, borderBottom: `1px solid ${t.hairline}`, padding: "0 0 0 24px", cursor: "pointer", ...text(12.5, 400, state.hovered ? t.text : t.text2), ...ring(state.focusVisible) }}
    >
      <span style={{ flex: 1, textAlign: "left" }}>{section.name}</span>
      <span style={small(t.label)}>{section.value}</span>
      <Glyph name="chev" size={10} />
    </button>
  );
}

/* ── the catalogue ── */

function Catalogue({ total, groups }: { total: number; groups: readonly CatalogueGroup[] }) {
  return (
    <InnerTile as="section" style={{ marginTop: 24, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 style={{ ...name12, margin: 0 }}>Add a filter</h3>
        <span style={small(t.label)}>{total}</span>
      </div>
      {groups.map((group) => (
        <div key={group.name} style={{ marginTop: 14 }}>
          <div style={text(11.5, 400, t.label)}>{`${group.name} · ${group.count}`}</div>
          <div style={{ ...text(12, 400, t.text2), marginTop: 2 }}>{group.items}</div>
        </div>
      ))}
    </InnerTile>
  );
}

/* ── the panel ── */

export function BuildsFiltersView(props: BuildsFiltersViewProps) {
  const { activeCount, onAdd, savedSets, sections, catalogue, onToggleOption, onOrder, onRange, onToggleSegment, onOpenClosed, onMove, collapsed = false } = props;
  const open = sections.filter((section) => section.kind !== "closed");
  const closed = sections.filter((section): section is ClosedSection => section.kind === "closed");
  return (
    <div data-testid="builds-filters">
      <FiltersHead activeCount={activeCount} onAdd={onAdd} />
      {collapsed ? null : (
        <>
          {savedSets ? <SavedSets rows={savedSets.rows} onSaveCurrent={savedSets.onSaveCurrent} /> : null}
          {open.map((section) => {
            const move = onMove ? (direction: "up" | "down") => onMove(section.id, direction) : undefined;
            if (section.kind === "word") {
              return <WordFilter key={section.id} section={section} onToggle={(key) => onToggleOption(section.id, key)} onOrder={onOrder ? (order) => onOrder(section.id, order) : undefined} onMove={move} />;
            }
            if (section.kind === "range") {
              return <RangeFilter key={section.id} section={section} onChange={onRange ? (value) => onRange(section.id, value) : undefined} onMove={move} />;
            }
            if (section.kind === "scale") {
              return <ScaleFilter key={section.id} section={section} onToggle={onToggleSegment ? (key) => onToggleSegment(section.id, key) : undefined} onMove={move} />;
            }
            return null;
          })}
          {closed.length > 0 ? (
            <section aria-label="More filters" style={{ borderTop: `1px solid ${t.hairline}` }}>
              {closed.map((section) => (
                <ClosedRow key={section.id} section={section} onOpen={onOpenClosed ? () => onOpenClosed(section.id) : undefined} />
              ))}
            </section>
          ) : null}
          {catalogue ? <Catalogue total={catalogue.total} groups={catalogue.groups} /> : null}
        </>
      )}
    </div>
  );
}
