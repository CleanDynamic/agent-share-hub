// type: "list" — a repeating group over the field's `of` definitions.
//
// This is the only widget with real behaviour: add a row, remove a row, drag
// rows into a different order. Everything inside a row is rendered by the same
// registry that renders the top level, resolved through FIELD_WIDGETS, so a
// list of anything the dialect can express works without a line of code here
// knowing what it holds. The dialect allows one level of nesting only — a field
// inside `of` never itself carries `of` — so a row can never contain a list and
// this component never recurses into itself.
//
// The drag lives in its own DndContext nested inside the workspace's. The two
// never see each other's drags: useSortable registers with the nearest context,
// and the listeners are bound to the grip handle alone, so a pointer landing in
// one of the row's inputs starts no drag in either context.

import { useCallback, useRef } from "react";
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

/** Widest a sub-field gets before the row wraps. Keeps three strings on one
 *  line in the 340px rail and stacks them in the bottom sheet. */
const SUBFIELD_MIN_WIDTH = 104;

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
  onSetSubField: (index: number, key: string, value: Json | null) => void;
  onRemove: (index: number) => void;
}

function ListRow({
  rowKey,
  index,
  row,
  of,
  fieldId,
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
          gap: 8,
        }}
      >
        {of.map((subField) => {
          const Widget = resolveWidget(subField);
          return (
            <div
              key={subField.key}
              style={{ flex: `1 1 ${SUBFIELD_MIN_WIDTH}px`, minWidth: SUBFIELD_MIN_WIDTH }}
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
  const of = field.of ?? [];

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
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
