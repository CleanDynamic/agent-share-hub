/* SV-11: the Builds filter panel, pure: typed props, no fetching, no router hooks. BF-06 put it in the Filters dialog; BF-07
   lists it by group: the groups on the left, the chosen group's filters on the right, every filter always drawn in a fixed
   place (a checklist with nothing to choose follows the rest of its group), and a name search across all of them.

   Each kind of section is its own component, defined at module level. A section that is not live on the page is not
   given to the view (SV-11 Part 3), so the dev page draws every one and the live page the ones that work.

   REAL CONTROLS. A checklist is checkboxes with their labels; a number filter is a two-handle slider, each handle
   keyboard operable (arrows, Page Up and Down, Home and End) with `aria-valuetext`; the histogram is hidden from
   screen readers and the group carries the words; a scale is a row of buttons with `aria-pressed`. Focus rings stay. */

import * as SliderPrimitive from "@radix-ui/react-slider";
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/brand/Button";
import { Checkbox } from "@/components/brand/Checkbox";
import { Glyph } from "@/components/brand/Glyph";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { WELL } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { BuildsFiltersDialog } from "./BuildsFiltersDialog";
import { BuildsControl, BuildsTextButton, text } from "./BuildsFrame";
import { DeleteSetDialog, SetNameDialog } from "./SetDialogs";

/* ── props ── */

/** BF-07 (A3): the dialog's groups, in the order they are listed. A filter's `group` is one of them. */
export const FILTER_GROUPS = ["Classification", "Proof", "Structure", "OpenBuilds"] as const;
export type FilterGroup = (typeof FILTER_GROUPS)[number];

export type WordOrder = "az" | "count" | "scale";

export interface WordOption {
  key: string;
  label: string;
  /** Absent: the filter has no count to show (Last confirmed, Confirmed or stale). */
  count?: number;
  checked: boolean;
}

export interface WordSection {
  kind: "word";
  id: string;
  name: string;
  /** BF-07 (A3): the dialog's group the filter is listed in. */
  group: FilterGroup;
  /** "az" or "count": the dialog's one order control (BF-07); "scale" keeps the taxonomy's order. */
  order: WordOrder;
  /** BF-07 (A7): what the filter holds, on the right of its name: "Any", the one value or "n chosen". */
  value: string;
  options: readonly WordOption[];
}

export interface RangeSection {
  kind: "range";
  id: string;
  name: string;
  group: FilterGroup;
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
  /** BF-09 (A10): how many builds the histogram counts; under five it is not drawn. */
  counted: number;
}

export interface ScaleSection {
  kind: "scale";
  id: string;
  name: string;
  group: FilterGroup;
  segments: readonly { key: string; label: string; on: boolean }[];
}

export type FilterSection = WordSection | RangeSection | ScaleSection;

export interface SavedSetRow {
  id: string;
  name: string;
  /** The board's number at the right. Absent: a word (`note`) or nothing. */
  count?: number;
  /** "Public" for a set others can open. */
  note?: string;
  href: string;
  isPublic?: boolean;
  /** The set the address names. */
  current?: boolean;
}

/** The open set's group line: who follows it, and Join or Leave for a set that is not the reader's own. */
export interface OpenSetView {
  id: string;
  name: string;
  mine: boolean;
  isPublic: boolean;
  members: number;
  member: boolean;
  onJoin?: () => void;
  onLeave?: () => void;
}

export interface SavedSetsProps {
  rows: readonly SavedSetRow[];
  /** BF-09 (F1): there is something to save: a filter or a changed layout, applied. */
  canSave: boolean;
  /** Why Save current is off, under the heading. */
  saveHint?: string;
  /** Rejects when it could not save. */
  onSaveCurrent: (name: string, isPublic: boolean) => void | Promise<void>;
  open?: OpenSetView;
  /** Absent: the rows have no menu. */
  onRename?: (id: string, name: string) => void | Promise<void>;
  onTogglePublic?: (id: string, isPublic: boolean) => void;
  onDelete?: (id: string) => void | Promise<void>;
}

export interface BuildsFiltersViewProps {
  activeCount: number;
  onAdd?: () => void;
  /** Absent: the section is not drawn. */
  savedSets?: SavedSetsProps;
  /** Every filter, each in its group, in the order drawn. */
  sections: readonly FilterSection[];
  onToggleOption: (sectionId: string, key: string) => void;
  /** BF-07 (A7): one order for every checklist, chosen in the dialog's header. */
  order: "az" | "count";
  onOrder: (order: "az" | "count") => void;
  /** BF-08 (A2): the choices are a draft; Apply commits them once. `dirty`: the draft differs from what is applied. */
  dirty: boolean;
  /** How many builds the draft (or, while nothing changed, the page) matches; null while the count is on its way. */
  matchCount: number | null;
  onApply: () => void;
  /** Cancel, Close and Escape: the draft is dropped. */
  onCancel: () => void;
  /** Clear all in the dialog: the draft's filters, not the page's. */
  onClear: () => void;
  /** The dialog opened: the draft starts from what is applied. */
  onOpen: () => void;
  onRange?: (sectionId: string, value: readonly [number, number]) => void;
  onToggleSegment?: (sectionId: string, key: string) => void;
  /** BF-11 (B1): a filter that holds a value adds its column. A layout setting, not part of the draft: it applies at once. Absent: not drawn. */
  addColumns?: boolean;
  onAddColumns?: (on: boolean) => void;
  /** BF-14 (B6): Builds must match, drawn with two or more countable filters in the draft; part of the draft. */
  match?: MatchControl;
}

export interface MatchControl {
  /** All m, then m-1 down to 1. */
  choices: readonly number[];
  /** The chosen least, or undefined for All. */
  value?: number;
  onChange: (value: number | undefined) => void;
  /** While a match applies to more builds than are loaded. */
  disabled?: boolean;
  line?: string;
  onLoadAll?: () => void;
}

/* ── pieces ── */

const rule: CSSProperties = { padding: "16px 0", borderTop: `1px solid ${t.hairline}` };
const name12: CSSProperties = text(12.5, 500, t.text);
const small = (color: string): CSSProperties => text(12, 400, color);

function SectionHead({ name, right }: { name: string; right: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <h3 style={{ ...name12, margin: 0, flex: 1 }}>{name}</h3>
      {right}
    </div>
  );
}

/* ── the head ── */

function FiltersHead({ activeCount, onAdd }: { activeCount: number; onAdd?: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 0" }}>
      {/* BF-06: the dialog's title says Filters. */}
      <p style={{ ...text(12, 400, t.label), margin: 0, lineHeight: "normal" }}>{`${activeCount} active`}</p>
      {onAdd ? <BuildsControl onClick={onAdd}>Add</BuildsControl> : null}
    </div>
  );
}

/* ── saved filter sets ── */

function SetMenu({ row, onRename, onTogglePublic, onDelete }: { row: SavedSetRow; onRename: () => void; onTogglePublic?: (isPublic: boolean) => void; onDelete: () => void }) {
  const phone = useIsPhone();
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`More for ${row.name}`}
          {...handlers}
          style={{ width: phone ? 44 : 28, height: phone ? 44 : 28, margin: phone ? -8 : 0, display: "grid", placeItems: "center", background: "none", border: 0, padding: 0, color: state.hovered ? t.text : t.label, cursor: "pointer", ...ring(state.focusVisible) }}
        >
          <Glyph name="more" size={14} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4}>
        <DropdownMenuItem onSelect={onRename}>Rename</DropdownMenuItem>
        {onTogglePublic ? <DropdownMenuItem onSelect={() => onTogglePublic(!row.isPublic)}>{row.isPublic ? "Make private" : "Make public"}</DropdownMenuItem> : null}
        <DropdownMenuItem onSelect={onDelete}>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SavedSetLink({ row, menu }: { row: SavedSetRow; menu?: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  const value = row.count !== undefined ? row.count : row.note;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Link
        to={row.href}
        aria-current={row.current ? "true" : undefined}
        {...handlers}
        style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, minHeight: 36, textDecoration: "none", borderRadius: r.chip, ...text(12.5, row.current ? 500 : 400, state.hovered || row.current ? t.text : t.text2), ...ring(state.focusVisible) }}
      >
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</span>
        {value !== undefined ? <span style={small(t.label)}>{value}</span> : null}
      </Link>
      {menu}
    </div>
  );
}

/** What the open set says about itself under the list: a group has members, and a reader who did not make it can follow it. */
function OpenSetLine({ open }: { open: OpenSetView }) {
  const members = `${open.members} ${open.members === 1 ? "member" : "members"}`;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 6, minHeight: 28 }}>
      <span style={small(t.label)}>{open.isPublic ? `${open.mine ? "Your group" : "Group"} · ${members}` : "Private to you"}</span>
      {!open.mine && open.isPublic ? (
        open.member ? (
          <BuildsTextButton onClick={open.onLeave} aria-label={`Leave ${open.name}`}>Leave</BuildsTextButton>
        ) : (
          <BuildsTextButton onClick={open.onJoin} color={t.text2} aria-label={`Join ${open.name}`}>Join</BuildsTextButton>
        )
      ) : null}
    </div>
  );
}

function SavedSets({ rows, canSave, saveHint, onSaveCurrent, open, onRename, onTogglePublic, onDelete }: SavedSetsProps) {
  const [naming, setNaming] = useState<"save" | SavedSetRow | null>(null);
  const hintId = useId();
  const [deleting, setDeleting] = useState<SavedSetRow | null>(null);
  const sets = open && !rows.some((row) => row.id === open.id) ? [{ id: open.id, name: open.name, href: "", note: undefined, current: true } as SavedSetRow] : [];
  return (
    <section aria-label="Saved filter sets" style={rule}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 style={{ ...name12, margin: 0 }}>Saved filter sets</h3>
        <BuildsTextButton disabled={!canSave} aria-describedby={saveHint ? hintId : undefined} onClick={() => setNaming("save")}>
          Save current
        </BuildsTextButton>
      </div>
      {saveHint ? (
        <p id={hintId} style={{ ...text(12, 400, t.label), margin: "2px 0 0" }}>
          {saveHint}
        </p>
      ) : null}
      <div style={{ marginTop: 6 }}>
        {rows.map((row) => (
          <SavedSetLink
            key={row.id}
            row={row}
            menu={onRename || onDelete ? <SetMenu row={row} onRename={() => setNaming(row)} onTogglePublic={onTogglePublic ? (isPublic) => onTogglePublic(row.id, isPublic) : undefined} onDelete={() => setDeleting(row)} /> : undefined}
          />
        ))}
      </div>
      {sets.length > 0 && open && !open.mine ? <p style={{ ...small(t.text2), margin: "6px 0 0" }}>Open: {open.name}</p> : null}
      {open ? <OpenSetLine open={open} /> : null}
      <SetNameDialog
        open={naming !== null}
        onOpenChange={(next) => (next ? undefined : setNaming(null))}
        title={naming === "save" || naming === null ? "Save these filters" : "Rename filter set"}
        description={naming === "save" || naming === null ? "Keep the filters you have chosen under a name. It is saved to your Library too." : "The filters in it stay as they are."}
        submitLabel={naming === "save" || naming === null ? "Save" : "Rename"}
        initialName={naming !== null && naming !== "save" ? naming.name : ""}
        askPublic={naming === "save" || naming === null}
        onSubmit={async (name, isPublic) => {
          if (naming !== null && naming !== "save") await onRename?.(naming.id, name);
          else await onSaveCurrent(name, isPublic);
        }}
      />
      <DeleteSetDialog
        name={deleting?.name ?? null}
        onCancel={() => setDeleting(null)}
        onDelete={async () => {
          if (deleting) await onDelete?.(deleting.id);
          setDeleting(null);
        }}
      />
    </section>
  );
}

/* ── a word filter ── */

function OptionRow({ option, onToggle }: { option: WordOption; onToggle: () => void }) {
  return (
    <label style={{ display: "grid", gridTemplateColumns: "14px 1fr auto", columnGap: 10, alignItems: "center", minHeight: 30, cursor: "pointer", ...text(12.5, 400, option.checked ? t.text : t.text2) }}>
      <Checkbox checked={option.checked} onChange={onToggle} style={{ width: 14, height: 14 }} />
      <span>{option.label}</span>
      {option.count === undefined ? <span /> : <span style={small(t.label)}>{option.count}</span>}
    </label>
  );
}

function WordFilter({ section, label, onToggle }: { section: WordSection; label?: string; onToggle: (key: string) => void }) {
  return (
    <section aria-label={section.name} style={rule}>
      <SectionHead
        name={section.name}
        right={<span style={small(t.label)}>{label ?? section.value}</span>}
      />
      {section.options.length === 0 ? (
        <p style={{ ...text(12, 400, t.label), margin: "8px 0 0" }}>No builds have a value yet.</p>
      ) : (
        <div role="group" aria-label={`${section.name} values`} style={{ marginTop: 8 }}>
          {section.options.map((option) => (
            <OptionRow key={option.key} option={option} onToggle={() => onToggle(option.key)} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ── a number filter ── */

function Histogram({ bars, height }: { bars: RangeSection["histogram"]; height: number }) {
  return (
    <div aria-hidden="true" style={{ display: "flex", alignItems: "flex-end", gap: 2, height, marginTop: 14 }}>
      {bars.map((bar, index) => (
        <span key={index} style={{ flex: 1, height: `${Math.round(bar.height * 100)}%`, borderRadius: 1, background: bar.inRange ? t.text : t.label }} />
      ))}
    </div>
  );
}

function RangeFilter({ section, label, onChange }: { section: RangeSection; label?: string; onChange?: (value: readonly [number, number]) => void }) {
  /* BF-08: while a handle is held the slider shows where it is; the filter changes once, when it is let go. */
  const [live, setLive] = useState<readonly [number, number] | null>(null);
  const [low, high] = live ?? section.value;
  // BF-05 (G3): the thumb is a 24 by 24 transparent hit area holding the 12px dot. The shared focus outline is drawn inside the
  // round thumb (`data-ring-inset`, 4px in), so it circles the dot and not the hit area; the dot keeps its own halo.
  const thumb: CSSProperties = { display: "grid", placeItems: "center", width: 24, height: 24, borderRadius: 12, background: "transparent", outline: "none" };
  const dot: CSSProperties = { display: "block", width: 12, height: 12, borderRadius: 6, background: t.text };
  const focus = (event: { currentTarget: HTMLElement }, on: boolean) => {
    const mark = event.currentTarget.firstElementChild as HTMLElement | null;
    if (mark) mark.style.boxShadow = on ? `0 0 0 2px ${t.frame}, 0 0 0 4px ${t.text}` : "none";
  };
  return (
    <section aria-label={section.name} style={rule}>
      <SectionHead name={section.name} right={label ? <span style={small(t.label)}>{label}</span> : <span style={small(t.text2)}>{section.valueText}</span>} />
      <div role="group" aria-label={`${section.name}, ${section.valueText}`}>
        {/* BF-09 (A10): with fewer than five builds counted the bars say nothing; the slider and the fields stay. */}
        {section.counted >= 5 ? <Histogram bars={section.histogram} height={section.bare ? 28 : 32} /> : null}
        {section.bare ? null : (
        <>
        <SliderPrimitive.Root
          min={section.min}
          max={section.max}
          step={1}
          minStepsBetweenThumbs={0}
          value={[low, high]}
          onValueChange={(value) => setLive([value[0], value[1]])}
          onValueCommit={(value) => {
            onChange?.([value[0], value[1]]);
            setLive(null);
          }}
          style={{ position: "relative", display: "flex", alignItems: "center", height: 14, margin: "4px -6px 0", touchAction: "none", userSelect: "none" }}
        >
          <SliderPrimitive.Track style={{ position: "relative", flexGrow: 1, height: 2, margin: "0 6px", borderRadius: 1, background: t.label }}>
            <SliderPrimitive.Range style={{ position: "absolute", height: "100%", borderRadius: 1, background: t.text }} />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb data-ring-inset aria-label={`${section.name} from`} aria-valuetext={section.describe(low, "min")} style={thumb} onFocus={(e) => focus(e, true)} onBlur={(e) => focus(e, false)}>
            <span aria-hidden="true" style={dot} />
          </SliderPrimitive.Thumb>
          <SliderPrimitive.Thumb data-ring-inset aria-label={`${section.name} to`} aria-valuetext={section.describe(high, "max")} style={thumb} onFocus={(e) => focus(e, true)} onBlur={(e) => focus(e, false)}>
            <span aria-hidden="true" style={dot} />
          </SliderPrimitive.Thumb>
        </SliderPrimitive.Root>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 8 }}>
          <RangeField
            label="At least"
            value={low === section.min ? "" : String(low)}
            placeholder={section.endLabels[0]}
            min={section.min}
            max={section.max}
            onCommit={(typed) => onChange?.([typed === null ? section.min : Math.min(clampTo(typed, section.min, section.max), high), high])}
          />
          <RangeField
            label="At most"
            value={high === section.max ? "" : String(high)}
            placeholder={section.endLabels[1]}
            min={section.min}
            max={section.max}
            onCommit={(typed) => onChange?.([low, typed === null ? section.max : Math.max(clampTo(typed, section.min, section.max), low)])}
          />
        </div>
        </>
        )}
      </div>
    </section>
  );
}

const clampTo = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** BF-09 (A10): one end of a range, typed. It holds its own text while focused and commits on Enter and on leaving: a whole
    number (held to the filter's bounds and the other end by the caller), or nothing, which is no limit on that end. */
function RangeField({ label, value, placeholder, min, max, onCommit }: { label: string; value: string; placeholder: string; min: number; max: number; onCommit: (typed: number | null) => void }) {
  const phone = useIsPhone();
  const [typing, setTyping] = useState<string | null>(null);
  const { state, handlers } = useInteractive<HTMLInputElement>({ onBlur: () => commit() });
  const commit = () => {
    if (typing === null) return;
    const parsed = Number.parseInt(typing.trim(), 10);
    setTyping(null);
    onCommit(typing.trim() === "" || Number.isNaN(parsed) ? null : parsed);
  };
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, ...text(12, 400, t.label) }}>
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={typing ?? value}
        placeholder={placeholder}
        onFocus={() => setTyping(value)}
        onChange={(event) => setTyping(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
        {...handlers}
        style={{
          ...WELL,
          boxSizing: "border-box",
          width: 72,
          height: phone ? 44 : 32,
          padding: "0 8px",
          borderRadius: r.control,
          fontFamily: FIGTREE,
          fontSize: phone ? 16 : 13,
          color: t.text,
          ...ring(state.focusVisible),
        }}
      />
    </label>
  );
}

/* ── a scale filter ── */

/** BF-09 (A9): one value of a scale, named: a button 36 high, its label wrapping, pressed in the selected look. */
function ScaleButton({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      {...handlers}
      style={{
        boxSizing: "border-box",
        minHeight: 36,
        padding: "6px 8px",
        borderRadius: r.control,
        ...(on ? { background: t.selectedFill, border: `1px solid ${t.selectedEdge}` } : { background: "none", border: `1px solid ${t.label}` }),
        ...text(12.5, on ? 500 : 400, on ? t.text : t.text2, { lineHeight: "16px", textAlign: "center" }),
        whiteSpace: "normal",
        cursor: "pointer",
        ...ring(state.focusVisible),
      }}
    >
      {label}
    </button>
  );
}

function ScaleFilter({ section, label, onToggle }: { section: ScaleSection; label?: string; onToggle?: (key: string) => void }) {
  const phone = useIsPhone();
  const chosen = section.segments.filter((segment) => segment.on).map((segment) => segment.label).join(", ");
  return (
    <section aria-label={section.name} style={rule}>
      <SectionHead name={section.name} right={<span style={small(t.label)}>{label ?? "Scale order"}</span>} />
      <div role="group" aria-label={`${section.name}: ${chosen || "any"}`} style={{ marginTop: 12, display: "grid", gridTemplateColumns: `repeat(${phone ? 2 : section.segments.length}, minmax(0, 1fr))`, gap: 4 }}>
        {section.segments.map((segment) => (
          <ScaleButton key={segment.key} label={segment.label} on={segment.on} onClick={() => onToggle?.(segment.key)} />
        ))}
      </div>
    </section>
  );
}

/* ── the panel ── */

/** A filter holds a value: a value ticked, a range off its ends, a step of a scale chosen. */
export function holdsValue(section: FilterSection): boolean {
  if (section.kind === "word") return section.options.some((option) => option.checked);
  if (section.kind === "scale") return section.segments.some((segment) => segment.on);
  return section.value[0] !== section.min || section.value[1] !== section.max;
}

/** A group's right-hand number: how many of its filters hold a value ("2 on"), or how many it has. */
const groupCount = (sections: readonly FilterSection[]): string => {
  const on = sections.filter(holdsValue).length;
  return on > 0 ? `${on} on` : String(sections.length);
};

/** A group's button: its name, and its number on the right. */
function GroupButton({ name, count, current, onChoose }: { name: string; count: string; current: boolean; onChoose: () => void }) {
  const phone = useIsPhone();
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-current={current ? "true" : undefined}
      onClick={onChoose}
      {...handlers}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flex: phone ? "none" : undefined,
        width: phone ? undefined : "100%",
        minHeight: phone ? 44 : 36,
        padding: "0 10px",
        borderRadius: r.control,
        border: `1px solid ${current ? t.selectedEdge : "transparent"}`,
        background: current ? t.selectedFill : "none",
        cursor: "pointer",
        whiteSpace: "nowrap",
        ...text(12.5, current ? 500 : 400, current || state.hovered ? t.text : t.text2),
        ...ring(state.focusVisible),
      }}
    >
      <span>{name}</span>
      <span style={small(t.label)}>{count}</span>
    </button>
  );
}

export interface BuildsFiltersBodyProps extends BuildsFiltersViewProps {
  /** BF-07: the name search, typed in the dialog's header. Empty: the chosen group is drawn. */
  search?: string;
}

/** The body of the dialog: the groups on the left (a row that scrolls sideways on a phone), the chosen group's filters on the
    right, or, while a name is searched, every filter whose name holds it, each labelled with its group. */
export function BuildsFiltersView(props: BuildsFiltersBodyProps) {
  const { activeCount, onAdd, savedSets, sections, onToggleOption, onRange, onToggleSegment, search = "" } = props;
  const phone = useIsPhone();
  const groups = FILTER_GROUPS.filter((group) => sections.some((section) => section.group === group));
  /* BF-09 (A8): a signed-in reader's saved sets are one more group, listed first; Classification stays the one chosen at first. */
  const [chosen, setChosen] = useState<FilterGroup | "Saved" | null>(null);
  const group = chosen === "Saved" && savedSets ? "Saved" : chosen !== null && chosen !== "Saved" && groups.includes(chosen) ? chosen : (groups[0] ?? null);
  const query = search.trim().toLowerCase();
  const shown = query ? sections.filter((section) => section.name.toLowerCase().includes(query)) : sections.filter((section) => section.group === group);
  return (
    <div data-testid="builds-filters">
      <FiltersHead activeCount={activeCount} onAdd={onAdd} />
      <div style={{ display: "grid", gridTemplateColumns: phone ? "minmax(0, 1fr)" : "200px minmax(0, 1fr)", columnGap: 24, rowGap: 12, alignItems: "start" }}>
        <div role="group" aria-label="Filter groups" style={phone ? { display: "flex", gap: 4, overflowX: "auto" } : { display: "flex", flexDirection: "column", gap: 2, position: "sticky", top: 0 }}>
          {savedSets ? <GroupButton name="Saved" count={String(savedSets.rows.length)} current={!query && group === "Saved"} onChoose={() => setChosen("Saved")} /> : null}
          {groups.map((name) => (
            <GroupButton key={name} name={name} count={groupCount(sections.filter((section) => section.group === name))} current={!query && name === group} onChoose={() => setChosen(name)} />
          ))}
        </div>
        <div style={{ minWidth: 0 }}>
          {!query && group === "Saved" && savedSets ? <SavedSets {...savedSets} /> : null}
          {query && shown.length === 0 ? <p style={{ ...text(12.5, 400, t.text2), margin: 0, padding: "16px 0" }}>No filter has that name.</p> : null}
          {shown.map((section) => {
            const label = query ? section.group : undefined;
            if (section.kind === "word") return <WordFilter key={section.id} section={section} label={label} onToggle={(key) => onToggleOption(section.id, key)} />;
            if (section.kind === "range") return <RangeFilter key={section.id} section={section} label={label} onChange={onRange ? (value) => onRange(section.id, value) : undefined} />;
            return <ScaleFilter key={section.id} section={section} label={label} onToggle={onToggleSegment ? (key) => onToggleSegment(section.id, key) : undefined} />;
          })}
        </div>
      </div>
    </div>
  );
}

/** BF-07: the Filters dialog with the panel in it, and the name search in its header. The search is held here, where both the
    header and the body reach it, and is cleared when the dialog closes. */
export function BuildsFilters({ open, onOpenChange, ...props }: BuildsFiltersViewProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [search, setSearch] = useState("");
  /* Close, Escape and Cancel drop the draft; Apply commits it. Either way the search goes. */
  const close = (next: boolean) => {
    if (next) return onOpenChange(true);
    props.onCancel();
    setSearch("");
    onOpenChange(false);
  };
  const apply = () => {
    props.onApply();
    setSearch("");
    onOpenChange(false);
  };
  return (
    <BuildsFiltersDialog
      open={open}
      onOpenChange={close}
      onOpen={props.onOpen}
      headerExtra={
        <>
          <FilterSearch value={search} onChange={setSearch} />
          <OrderValues order={props.order} onOrder={props.onOrder} />
        </>
      }
      footer={<FiltersFooter matchCount={props.matchCount} dirty={props.dirty} match={props.match} addColumns={props.addColumns} onAddColumns={props.onAddColumns} onClear={props.onClear} onCancel={() => close(false)} onApply={apply} />}
    >
      <BuildsFiltersView {...props} search={search} />
    </BuildsFiltersDialog>
  );
}

/** BF-08 (A2): how many builds the draft matches, then Clear all, Cancel and Apply (the dialog's one primary). BF-11 (B1): beside
    the count, whether each filter adds its column, which applies at once. */
/** BF-14 (B6): a native select, 32 high (44 on a phone, at 16px so the phone does not zoom), named "Builds must match". */
function MatchSelect({ match }: { match: MatchControl }) {
  const phone = useIsPhone();
  const m = match.choices[0];
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: "4px 8px", ...text(12.5, 400, t.text2) }}>
      <span aria-hidden="true">Builds must match</span>
      <select
        aria-label="Builds must match"
        value={match.value ?? ""}
        disabled={match.disabled}
        onChange={(event) => match.onChange(event.currentTarget.value === "" ? undefined : Number(event.currentTarget.value))}
        style={{ boxSizing: "border-box", height: phone ? 44 : 32, padding: "0 8px", borderRadius: r.control, border: `1px solid ${t.controlBorder}`, background: t.control, color: t.text, fontFamily: "inherit", fontSize: phone ? 16 : 12.5, opacity: match.disabled ? 0.5 : undefined }}
      >
        <option value="">{`All ${m} filters`}</option>
        {match.choices.slice(1).map((least) => (
          <option key={least} value={least}>{`At least ${least} of ${m}`}</option>
        ))}
      </select>
      {match.line ? <span>{match.line}</span> : null}
      {match.onLoadAll ? <BuildsControl onClick={match.onLoadAll}>Load all</BuildsControl> : null}
    </span>
  );
}

function FiltersFooter({ matchCount, dirty, match, addColumns, onAddColumns, onClear, onCancel, onApply }: { matchCount: number | null; dirty: boolean; match?: MatchControl; addColumns?: boolean; onAddColumns?: (on: boolean) => void; onClear: () => void; onCancel: () => void; onApply: () => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 16px" }}>
        <span role="status" style={text(12.5, 400, t.text2)}>
          {matchCount === null ? "" : `${matchCount} ${matchCount === 1 ? "build matches" : "builds match"}`}
        </span>
        {match ? <MatchSelect match={match} /> : null}
        {addColumns !== undefined && onAddColumns ? (
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 32, cursor: "pointer", ...text(12.5, 400, t.text2) }}>
            <Checkbox checked={addColumns} onChange={(event) => onAddColumns(event.currentTarget.checked)} />
            Add a column for each filter
          </label>
        ) : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <BuildsTextButton onClick={onClear}>Clear all</BuildsTextButton>
        <BuildsControl onClick={onCancel}>Cancel</BuildsControl>
        <Button variant="primary" size={32} fontSize={12} disabled={!dirty} onClick={onApply}>
          Apply
        </Button>
      </div>
    </div>
  );
}

/** BF-07 (A7): how every checklist is ordered, Most builds or A to Z; the one pressed is in `--text`. */
function OrderValues({ order, onOrder }: { order: "az" | "count"; onOrder: (order: "az" | "count") => void }) {
  const choices = [
    { value: "count", label: "Most builds" },
    { value: "az", label: "A to Z" },
  ] as const;
  return (
    <div role="group" aria-label="Order values" style={{ display: "flex", alignItems: "center", gap: 12, flex: "none" }}>
      {choices.map((choice) => (
        <BuildsTextButton key={choice.value} aria-pressed={order === choice.value} color={order === choice.value ? t.text : t.label} onClick={() => onOrder(choice.value)}>
          {choice.label}
        </BuildsTextButton>
      ))}
    </div>
  );
}

/** Find a filter: a field 36 high (44 and 16px type on a phone), in the well's paint. */
function FilterSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const phone = useIsPhone();
  const { state, handlers } = useInteractive<HTMLInputElement>();
  return (
    <input
      type="search"
      aria-label="Find a filter"
      placeholder="Find a filter"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      {...handlers}
      style={{
        ...WELL,
        boxSizing: "border-box",
        width: "100%",
        maxWidth: 280,
        minWidth: 0,
        height: phone ? 44 : 36,
        padding: "0 10px",
        borderRadius: r.control,
        fontFamily: FIGTREE,
        fontSize: phone ? 16 : 13,
        color: t.text,
        ...ring(state.focusVisible),
      }}
    />
  );
}
