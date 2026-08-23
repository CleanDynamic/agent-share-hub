// type: "list" — a repeating group over the field's `of` definitions.
//
// This is the only widget with real behaviour: add a row, remove a row, drag
// rows into a different order. Everything inside a row is rendered by the same
// registry that renders the top level, resolved through resolveWidget, so a
// list of anything the dialect can express works without a line of code here
// knowing what it holds. The dialect allows one level of nesting only — a field
// inside `of` never itself carries `of` — and that is enforced rather than
// assumed: a sub-field of type list is dropped from the row with a console
// warning, so a bad schema row shows up in the console of whoever wrote it
// instead of recursing this component into a shape the dialect cannot store.
//
// A row lays its sub-fields out side by side while each of them can still hold
// SUBFIELD_MIN_WIDTH across at most two lines. Past that — five short
// sub-fields in the 340px rail, or any row in a rail narrower still — it
// stacks them one per line, because a control too narrow to read its own
// placeholder is not a control anybody can fill in.
//
// The drag lives in its own DndContext nested inside the workspace's. The two
// never see each other's drags: useSortable registers with the nearest context,
// and the listeners are bound to the grip handle alone, so a pointer landing in
// one of the row's inputs starts no drag in either context.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, X } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import type { FieldDef } from "@/lib/build";
import {
  HAIRLINE,
  TEXT_MUTED,
  TEXT_SECONDARY,
  cardGlass,
  labelText,
} from "@/components/build/tokens";
import { FieldShell } from "../SchemaForm";
import { resolveWidget, type FieldWidgetProps } from "./index";

/** A row is an object keyed by the sub-field keys. Anything else is repaired. */
type Row = Record<string, Json | undefined>;

/** Narrowest a sub-field is allowed to get before the row wraps or stacks. */
const SUBFIELD_MIN_WIDTH = 104;
/** The gap between two sub-fields on the same line. */
const SUBFIELD_GAP = 8;
/** Grip, remove button, their gaps and the card's padding. */
const ROW_CHROME_WIDTH = 60;
/** A row of two lines still reads as one row. Three does not. */
const MAX_ROW_LINES = 2;

/**
 * Whether a row must stack its sub-fields one per line.
 *
 * `contentWidth` is the space the sub-fields actually get, chrome already
 * subtracted. A width of 0 means nothing has been measured yet — before the
 * first layout, and in any environment without a ResizeObserver — and the
 * side-by-side layout is the answer there, because it is the one that wraps on
 * its own rather than committing to a shape from a measurement it does not have.
 */
export function shouldStackRow(contentWidth: number, subFieldCount: number): boolean {
  if (contentWidth <= 0 || subFieldCount <= 1) return false;
  const perLine = Math.floor(
    (contentWidth + SUBFIELD_GAP) / (SUBFIELD_MIN_WIDTH + SUBFIELD_GAP)
  );
  if (perLine < 1) return true;
  return Math.ceil(subFieldCount / perLine) > MAX_ROW_LINES;
}

/**
 * The sub-fields of a list, with anything the dialect forbids removed.
 *
 * A list inside a list is not expressible in the six-field-type dialect and
 * there is no storage shape for it, so it is dropped rather than rendered.
 * The warning names the exact path so the schema row can be corrected; it is
 * emitted once per path per session rather than once per render, since a form
 * that repaints on every keystroke would otherwise bury the console.
 */
const warnedNestedPaths = new Set<string>();

export function acceptedSubFields(field: FieldDef): FieldDef[] {
  const of = field.of ?? [];
  return of.filter((subField) => {
    if (subField.type !== "list" && subField.of === undefined) return true;
    const path = `${field.key}.${subField.key}`;
    if (!warnedNestedPaths.has(path)) {
      warnedNestedPaths.add(path);
      console.warn(
        `[NeoScale] node_types schema: "${path}" nests a list inside a list. ` +
          "The schema dialect allows one level of nesting only, so this " +
          "sub-field is not rendered. Fix the node_types row."
      );
    }
    return false;
  });
}

let keySeed = 0;
const nextKey = () => `list-row-${(keySeed += 1)}`;

/**
 * Read whatever is stored into an array of row objects.
 *
 * A payload predating a schema change can hold a string, an object, or an array
 * of scalars where an array of objects is expected. None of those should blank
 * the field: a non-array becomes no rows, and a non-object row becomes an empty
 * one, so the creator sees the structure and can refill it.
 */
function toRows(value: Json | undefined): Row[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) =>
    entry && typeof entry === "object" && !Array.isArray(entry) ? (entry as Row) : {}
  );
}

const gripStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 18,
  alignSelf: "stretch",
  flexShrink: 0,
  background: "transparent",
  border: "none",
  padding: 0,
  color: TEXT_MUTED,
  cursor: "grab",
  touchAction: "none",
};

const removeStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 20,
  height: 20,
  flexShrink: 0,
  alignSelf: "flex-start",
  marginTop: 2,
  background: "transparent",
  border: "none",
  padding: 0,
  borderRadius: 4,
  color: TEXT_MUTED,
  cursor: "pointer",
};

interface ListRowProps {
  rowKey: string;
  index: number;
  row: Row;
  of: FieldDef[];
  fieldId: string;
  /** One sub-field per line: the row is too narrow to sit them side by side. */
  stacked: boolean;
  onSetSubField: (index: number, key: string, value: Json | null) => void;
  onRemove: (index: number) => void;
}

function ListRow({
  rowKey,
  index,
  row,
  of,
  fieldId,
  stacked,
  onSetSubField,
  onRemove,
}: ListRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: rowKey });

  return (
    <li
      ref={setNodeRef}
      style={{
        ...cardGlass,
        display: "flex",
        alignItems: "flex-start",
        gap: 6,
        padding: "8px 8px 8px 2px",
        // Vertical only, by dropping the x component rather than by pulling in
        // @dnd-kit/modifiers: a list reorders up and down, and a new package on
        // this route is not worth one axis.
        transform: transform ? CSS.Transform.toString({ ...transform, x: 0 }) : undefined,
        transition,
        // Lifted rather than removed, so the row keeps its place in the list
        // and the gap the others close is the one it will land in.
        opacity: isDragging ? 0.4 : 1,
        position: "relative",
        zIndex: isDragging ? 1 : 0,
      }}
    >
      {/* The listeners live here and nowhere else. A pointer down on one of the
          inputs below must never become a drag. */}
      <button
        type="button"
        aria-label={`Reorder row ${index + 1}`}
        style={gripStyle}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={13} aria-hidden />
      </button>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: SUBFIELD_GAP,
        }}
      >
        {of.map((subField) => {
          const Widget = resolveWidget(subField);
          return (
            <div
              key={subField.key}
              style={
                stacked
                  ? { flex: "1 1 100%", minWidth: 0 }
                  : { flex: `1 1 ${SUBFIELD_MIN_WIDTH}px`, minWidth: SUBFIELD_MIN_WIDTH }
              }
            >
              <Widget
                field={subField}
                value={row[subField.key]}
                id={`${fieldId}-${index}-${subField.key}`}
                compact
                onChange={(next) => onSetSubField(index, subField.key, next)}
              />
            </div>
          );
        })}
      </div>

      <button
        type="button"
        aria-label={`Remove row ${index + 1}`}
        onClick={() => onRemove(index)}
        style={removeStyle}
      >
        <X size={13} aria-hidden />
      </button>
    </li>
  );
}

export function ListField({ field, value, onChange, id, touched, compact }: FieldWidgetProps) {
  const rows = toRows(value);
  const of = useMemo(() => acceptedSubFields(field), [field]);

  /**
   * The width the rows actually have, watched rather than assumed.
   *
   * The same list renders in a 340px rail and in a full-width bottom sheet, and
   * a media query on the viewport would not tell the two apart — the rail is
   * narrow at every viewport width. The element measures itself instead.
   */
  const widthRef = useRef<HTMLDivElement | null>(null);
  const [contentWidth, setContentWidth] = useState(0);
  useEffect(() => {
    const element = widthRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const measure = (width: number) =>
      setContentWidth(Math.max(0, width - ROW_CHROME_WIDTH));
    measure(element.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) measure(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const stacked = shouldStackRow(contentWidth, of.length);

  /**
   * Stable identities for the rows, which the stored objects do not carry.
   *
   * dnd-kit needs an id per sortable item that survives a reorder. An index
   * would not: moving row 0 to row 2 renames every id between them mid-drag.
   * These keys move with their rows instead, and are only regenerated when the
   * array's length changes underneath the component — a reload, or an undo.
   */
  const keysRef = useRef<string[]>([]);
  if (keysRef.current.length !== rows.length) {
    const next = keysRef.current.slice(0, rows.length);
    while (next.length < rows.length) next.push(nextKey());
    keysRef.current = next;
  }
  const keys = keysRef.current;

  const sensors = useSensors(
    // Without the distance constraint a click on the grip is a zero-length drag
    // that swallows the focus it should have handed to the row.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const setSubField = useCallback(
    (index: number, key: string, next: Json | null) => {
      const updated = rows.map((row, position) =>
        position === index ? { ...row, [key]: next } : row
      );
      onChange(updated as Json);
    },
    [onChange, rows]
  );

  const addRow = useCallback(() => {
    // An empty object rather than one key per sub-field: the row is what the
    // creator has filled in, and a row of nulls would export as a row of nulls.
    onChange([...rows, {}] as Json);
  }, [onChange, rows]);

  const removeRow = useCallback(
    (index: number) => {
      keysRef.current = keys.filter((_, position) => position !== index);
      onChange(rows.filter((_, position) => position !== index) as Json);
    },
    [keys, onChange, rows]
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const from = keys.indexOf(String(active.id));
      const to = keys.indexOf(String(over.id));
      if (from === -1 || to === -1) return;

      // The keys move with the rows, in the same call. Letting them fall out of
      // step for even one render would hand dnd-kit the wrong row.
      keysRef.current = arrayMove(keys, from, to);
      onChange(arrayMove(rows, from, to) as Json);
    },
    [keys, onChange, rows]
  );

  return (
    <FieldShell
      field={field}
      id={id}
      touched={touched}
      isEmpty={rows.length === 0}
      compact={compact}
      // The rows are the control; a label pointing at a <ul> would point at
      // nothing focusable.
      labelAsText
    >
      <div ref={widthRef} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={keys} strategy={verticalListSortingStrategy}>
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {rows.map((row, index) => (
                  <ListRow
                    key={keys[index]}
                    rowKey={keys[index]}
                    index={index}
                    row={row}
                    of={of}
                    fieldId={id}
                    stacked={stacked}
                    onSetSubField={setSubField}
                    onRemove={removeRow}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        <button
          type="button"
          onClick={addRow}
          style={{
            ...labelText,
            display: "flex",
            alignItems: "center",
            gap: 6,
            alignSelf: "flex-start",
            padding: "5px 10px",
            borderRadius: 8,
            background: "transparent",
            border: `1px dashed ${HAIRLINE}`,
            color: TEXT_SECONDARY,
            cursor: "pointer",
          }}
        >
          <Plus size={12} aria-hidden />
          Add {field.label.toLowerCase()}
        </button>
      </div>
    </FieldShell>
  );
}
