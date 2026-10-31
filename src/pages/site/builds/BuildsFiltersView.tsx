/* SV-11: the Builds filter panel, pure: typed props, no fetching, no router hooks. The board is
   `design/reference/vision/dusk/builds-table.html`; the panel is quiet (series README, Visual grammar 2): sections on the
   surface with a hairline above each, and one boxed tile, "Add a filter".

   Each kind of section is its own component, defined at module level. A section that is not live on the page is not
   given to the view (SV-11 Part 3), so the dev page draws every one and the live page the ones that work.

   REAL CONTROLS. A checklist is checkboxes with their labels; a number filter is a two-handle slider, each handle
   keyboard operable (arrows, Page Up and Down, Home and End) with `aria-valuetext`; the histogram is hidden from
   screen readers and the group carries the words; a scale is a row of buttons with `aria-pressed`; each grip is a
   button named "Move <filter>" that opens a menu with Move up and Move down, and drags the filter where a drop is wanted
   (SV-24 P2: `filterDrag.ts`); a checklist can be given a height with a handle, a separator with its value that the arrow
   keys, Page Up and Down, Home and End move. Focus rings stay. */

import * as SliderPrimitive from "@radix-ui/react-slider";
import { Fragment, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { Link } from "react-router-dom";

import { Checkbox } from "@/components/brand/Checkbox";
import { Glyph } from "@/components/brand/Glyph";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { InnerTile } from "@/components/vision/InnerTile";
import { HEIGHT_MAX, HEIGHT_MIN, HEIGHT_STEP } from "@/lib/build/buildsLayout";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";

import { BuildsControl, BuildsTextButton, text } from "./BuildsFrame";
import { heightAfterKey, useFilterDrag, useListResize, type GripDrag } from "./filterDrag";
import { DeleteSetDialog, SetNameDialog } from "./SetDialogs";

/* ── props ── */

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
  /** Rejects when it could not save. */
  onSaveCurrent: (name: string, isPublic: boolean) => void | Promise<void>;
  open?: OpenSetView;
  /** Absent: the rows have no menu. */
  onRename?: (id: string, name: string) => void | Promise<void>;
  onTogglePublic?: (id: string, isPublic: boolean) => void;
  onDelete?: (id: string) => void | Promise<void>;
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
  savedSets?: SavedSetsProps;
  sections: readonly FilterSection[];
  catalogue?: { total: number; groups: readonly CatalogueGroup[] };
  onToggleOption: (sectionId: string, key: string) => void;
  onOrder?: (sectionId: string, order: "az" | "count") => void;
  onRange?: (sectionId: string, value: readonly [number, number]) => void;
  onToggleSegment?: (sectionId: string, key: string) => void;
  onOpenClosed?: (sectionId: string) => void;
  /** Absent: no grips, because filters cannot be moved. A grip opens a menu with Move up and Move down. */
  onMove?: (sectionId: string, direction: "up" | "down") => void;
  /** SV-24 P2: a filter dragged by its grip was dropped here: its place among the filters drawn open. Absent: no drag. */
  onDrop?: (sectionId: string, index: number) => void;
  /** SV-24 P2: a checklist's height in px, where the reader set one. */
  heights?: Readonly<Record<string, number>>;
  /** Absent: no resize handles. */
  onResize?: (sectionId: string, height: number) => void;
  /** Below 1000 the panel is closed to its heads. */
  collapsed?: boolean;
}

/* ── pieces ── */

const rule: CSSProperties = { padding: "20px 0", borderTop: `1px solid ${t.hairline}` };
const name12: CSSProperties = text(12.5, 500, t.text);
const small = (color: string): CSSProperties => text(12, 400, color);

/** Where a filter stands among those drawn open, so the menu can leave out a move there is no room for. */
export interface GripPlace {
  first: boolean;
  last: boolean;
}

/** The faint grip. A button named "Move <filter>": pressed and let go it opens a menu with Move up and Move down (so a filter moves
    without a pointer), dragged it moves the filter (`onDrop`). Keyboard: Enter, Space or the arrow opens the menu. */
function Grip({ name, onMove, drag, place }: { name: string; onMove?: (direction: "up" | "down") => void; drag?: GripDrag; place?: GripPlace }) {
  const [menu, setMenu] = useState(false);
  /* The press handlers go through the hook so it chains them: spread after, it would replace them. */
  const { state, handlers } = useInteractive<HTMLButtonElement>({
    onPointerDown: drag?.onPointerDown,
    onPointerUp: (event) => {
      if (drag?.onPointerUp(event)) setMenu(true);
    },
    onPointerCancel: drag?.onPointerCancel,
  });
  if (!onMove) return <span aria-hidden="true" style={{ width: 16, height: 20, flexShrink: 0 }} />;
  return (
    <DropdownMenu open={menu} onOpenChange={setMenu}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Move ${name}`}
          onPointerMove={drag?.onPointerMove}
          {...handlers}
          style={{ width: 16, height: 20, flexShrink: 0, display: "grid", placeItems: "center", background: "none", border: 0, padding: 0, color: t.line, cursor: "grab", touchAction: drag ? "none" : undefined, ...ring(state.focusVisible) }}
        >
          <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden="true">
            {[2, 6, 10].flatMap((y) => [2, 6].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill="currentColor" />))}
          </svg>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={4}>
        <DropdownMenuItem disabled={place?.first} onSelect={() => onMove("up")}>
          Move up
        </DropdownMenuItem>
        <DropdownMenuItem disabled={place?.last} onSelect={() => onMove("down")}>
          Move down
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface Moving {
  onMove?: (direction: "up" | "down") => void;
  drag?: GripDrag;
  place?: GripPlace;
}

function SectionHead({ name, move, right }: { name: string; move: Moving; right: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Grip name={name} onMove={move.onMove} drag={move.drag} place={move.place} />
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

function SavedSets({ rows, onSaveCurrent, open, onRename, onTogglePublic, onDelete }: SavedSetsProps) {
  const [naming, setNaming] = useState<"save" | SavedSetRow | null>(null);
  const [deleting, setDeleting] = useState<SavedSetRow | null>(null);
  const sets = open && !rows.some((row) => row.id === open.id) ? [{ id: open.id, name: open.name, href: "", note: undefined, current: true } as SavedSetRow] : [];
  return (
    <section aria-label="Saved filter sets" style={rule}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 style={{ ...name12, margin: 0 }}>Saved filter sets</h3>
        <BuildsTextButton onClick={() => setNaming("save")}>Save current</BuildsTextButton>
      </div>
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
      {option.count === undefined ? <span /> : <span style={small(t.label)}>{option.count}</span>}
    </label>
  );
}

/** The handle under a checklist: drag it, or focus it and use the keys. Invisible at rest (the panel keeps the board's look); a line
    shows while it is focused. A separator with a value, the pattern for a pane that can be resized. */
function ResizeHandle({ name, list, height, onResize }: { name: string; list: RefObject<HTMLDivElement | null>; height?: number; onResize: (px: number) => void }) {
  const phone = useIsPhone();
  const drag = useListResize(list, onResize);
  const { state, handlers } = useInteractive<HTMLDivElement>({ onPointerDown: drag.onPointerDown, onPointerUp: drag.onPointerUp, onPointerCancel: drag.onPointerCancel });
  const now = height ?? (list.current ? Math.round(list.current.getBoundingClientRect().height) : HEIGHT_MAX);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    /* The height is read from the list when it was never set; the step is from that. */
    const base = height ?? (list.current ? Math.round(list.current.getBoundingClientRect().height) : HEIGHT_MAX);
    const next = heightAfterKey(event.key, base, HEIGHT_STEP);
    if (next === null) return;
    event.preventDefault();
    onResize(next);
  };
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={`Resize ${name}`}
      aria-valuemin={HEIGHT_MIN}
      aria-valuemax={HEIGHT_MAX}
      aria-valuenow={now}
      aria-valuetext={`${now} pixels tall`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerMove={drag.onPointerMove}
      {...handlers}
      style={{ position: "absolute", left: 0, right: 0, bottom: phone ? -12 : -4, height: phone ? 24 : 8, cursor: "ns-resize", touchAction: "none", display: "flex", alignItems: "center", ...ring(state.focusVisible) }}
    >
      <span aria-hidden="true" style={{ flex: 1, height: 1, background: state.focusVisible ? t.line : "transparent" }} />
    </div>
  );
}

function WordFilter({ section, onToggle, onOrder, move, height, onResize }: { section: WordSection; onToggle: (key: string) => void; onOrder?: (order: "az" | "count") => void; move: Moving; height?: number; onResize?: (px: number) => void }) {
  const list = useRef<HTMLDivElement>(null);
  return (
    <section aria-label={section.name} style={rule}>
      <SectionHead
        name={section.name}
        move={move}
        right={section.order === "scale" ? <span style={small(t.label)}>Scale order</span> : <OrderPair order={section.order} onOrder={onOrder} />}
      />
      <div style={onResize ? { position: "relative" } : undefined}>
        <div ref={list} role="group" aria-label={`${section.name} values`} style={{ ...(height ? { maxHeight: height, overflowY: "auto" } : null), marginTop: 10 }}>
          {section.options.map((option) => (
            <OptionRow key={option.key} option={option} onToggle={() => onToggle(option.key)} />
          ))}
        </div>
        {onResize ? <ResizeHandle name={section.name} list={list} height={height} onResize={onResize} /> : null}
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

function RangeFilter({ section, onChange, move }: { section: RangeSection; onChange?: (value: readonly [number, number]) => void; move: Moving }) {
  const [low, high] = section.value;
  const thumb: CSSProperties = { display: "block", width: 12, height: 12, borderRadius: 6, background: t.text, outline: "none" };
  const focus = (event: { currentTarget: HTMLElement }, on: boolean) => {
    event.currentTarget.style.boxShadow = on ? `0 0 0 2px ${t.frame}, 0 0 0 4px ${t.text}` : "none";
  };
  return (
    <section aria-label={section.name} style={rule}>
      <SectionHead name={section.name} move={move} right={<span style={small(t.text2)}>{section.valueText}</span>} />
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

function ScaleFilter({ section, onToggle, move }: { section: ScaleSection; onToggle?: (key: string) => void; move: Moving }) {
  const chosen = section.segments.filter((segment) => segment.on).map((segment) => segment.label).join(", ");
  return (
    <section aria-label={section.name} style={rule}>
      <SectionHead name={section.name} move={move} right={<span style={small(t.label)}>Scale order</span>} />
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
  const { activeCount, onAdd, savedSets, sections, catalogue, onToggleOption, onOrder, onRange, onToggleSegment, onOpenClosed, onMove, onDrop, heights, onResize, collapsed = false } = props;
  const container = useRef<HTMLDivElement>(null);
  const gripFor = useFilterDrag(container, onDrop);
  const open = sections.filter((section) => section.kind !== "closed");
  const closed = sections.filter((section): section is ClosedSection => section.kind === "closed");
  return (
    <div ref={container} data-testid="builds-filters">
      <FiltersHead activeCount={activeCount} onAdd={onAdd} />
      {collapsed ? null : (
        <>
          {savedSets ? <SavedSets {...savedSets} /> : null}
          {open.map((section, at) => {
            const move: Moving = {
              onMove: onMove ? (direction) => onMove(section.id, direction) : undefined,
              drag: gripFor?.(section.id),
              place: { first: at === 0, last: at === open.length - 1 },
            };
            const resize = onResize ? (px: number) => onResize(section.id, px) : undefined;
            let drawn: ReactNode = null;
            if (section.kind === "word") {
              drawn = <WordFilter section={section} onToggle={(key) => onToggleOption(section.id, key)} onOrder={onOrder ? (order) => onOrder(section.id, order) : undefined} move={move} height={heights?.[section.id]} onResize={resize} />;
            } else if (section.kind === "range") {
              drawn = <RangeFilter section={section} onChange={onRange ? (value) => onRange(section.id, value) : undefined} move={move} />;
            } else if (section.kind === "scale") {
              drawn = <ScaleFilter section={section} onToggle={onToggleSegment ? (key) => onToggleSegment(section.id, key) : undefined} move={move} />;
            }
            /* The wrapper is what a drag moves; it is drawn only where a drag is. */
            return onDrop ? (
              <div key={section.id} data-filter-slot={section.id}>
                {drawn}
              </div>
            ) : (
              <Fragment key={section.id}>{drawn}</Fragment>
            );
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
