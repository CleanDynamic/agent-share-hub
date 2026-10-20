// ReferencePicker: the list @ opens over the post (CA-06 P2).
//
// A search field, "Find a tile or session", then the build grouped by session: each session's own row first ("The
// whole session", S1), then its tiles in order, the tiles inside one under it indented 12. Arrow keys move, Enter
// chooses, Escape closes. The field has focus while it is open; the editor keeps its selection, and the caller puts
// focus back. On a phone it is a BottomSheet.
//
// PURE but for its own search and active row. What a choice does to the post is the caller's (PostTab).

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

import { BottomSheet } from "@/components/shell/BottomSheet";
import { filterRefGroups, type RefEntry, type RefGroup } from "@/lib/build/postRefs";
import { fieldStyle } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";
import { ellipsis, menuSurface, text, tnum } from "@/pages/site/compose/refinedStyles";

export const REFERENCE_COPY = {
  button: "Link to a tile or session",
  search: "Find a tile or session",
  none: "Nothing has that name",
  remove: "Remove the link",
  whole: "The whole session",
} as const;

/** The picker's width on a desktop. */
export const PICKER_WIDTH = 320;
/** How far a nested tile steps in. */
const NEST_STEP = 12;

export interface ReferencePickerProps {
  open: boolean;
  groups: readonly RefGroup[];
  /** The link the highlight already holds: chosen when the picker opens, and Remove the link is offered. */
  current: string | null;
  /** Where the picker's top left goes, in the window: under the selection or the caret. */
  anchor: { top: number; left: number } | null;
  phone: boolean;
  onChoose: (entry: RefEntry) => void;
  onRemove: () => void;
  /** CA-07 P6: what the remove row reads ("Not linked" for a picture's step). Absent: Remove the link. */
  removeLabel?: string;
  /** Escape, or a click outside: nothing changes. */
  onClose: () => void;
}

type Row = { kind: "entry"; entry: RefEntry; label: string | null } | { kind: "remove" };

function rowsOf(groups: readonly RefGroup[], removable: boolean): Row[] {
  const rows: Row[] = [];
  for (const group of groups) {
    group.entries.forEach((entry, at) => {
      // A session that cannot be linked (an old build's typed prompts) still names its tiles' group.
      rows.push({ kind: "entry", entry, label: at === 0 && entry.kind !== "Session" ? group.label : null });
    });
  }
  if (removable) rows.push({ kind: "remove" });
  return rows;
}

function EntryRow({ entry, active, chosen, id, phone, onPick, onHover }: { entry: RefEntry; active: boolean; chosen: boolean; id: string; phone: boolean; onPick: () => void; onHover: () => void }) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      aria-current={chosen ? "true" : undefined}
      data-ref-option={entry.to}
      onMouseDown={(event) => event.preventDefault()}
      onMouseEnter={onHover}
      onClick={onPick}
      style={{
        boxSizing: "border-box",
        minHeight: phone ? 44 : 32,
        padding: "4px 8px",
        paddingLeft: 8 + entry.depth * NEST_STEP,
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        background: active ? t.tile : "transparent",
        boxShadow: chosen ? `inset 0 0 0 1px ${t.selectedEdge}` : undefined,
      }}
    >
      <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 2, minWidth: 24, flexShrink: 0 }}>
        <span style={{ fontFamily: DM_MONO, fontSize: 10.5, lineHeight: "normal", color: t.label, ...tnum }}>{entry.number}</span>
        {entry.colour ? <span aria-hidden="true" data-colour-bar="" style={{ width: 16, height: 2, borderRadius: 1, background: entry.colour }} /> : null}
      </span>
      <span style={{ ...text(13, entry.kind === "Session" ? 500 : 400, t.text), ...ellipsis, flexGrow: 1, minWidth: 0 }}>{entry.title}</span>
      <span style={{ ...text(12, 400, t.label), flexShrink: 0 }}>{entry.kind}</span>
    </div>
  );
}

function PickerBody({ groups, current, phone, onChoose, onRemove, onClose, field, removeLabel }: Omit<ReferencePickerProps, "open" | "anchor"> & { field: React.RefObject<HTMLInputElement> }) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const listId = useId();
  const shown = useMemo(() => filterRefGroups(groups, query), [groups, query]);
  const rows = useMemo(() => rowsOf(shown, Boolean(current)), [shown, current]);
  const startAt = Math.max(0, rows.findIndex((row) => row.kind === "entry" && row.entry.to === current));
  const [active, setActive] = useState(startAt);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActive(query ? 0 : startAt);
    // The chosen link leads only until something is typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  useEffect(() => {
    field.current?.focus();
  }, [field]);
  useEffect(() => {
    list.current?.querySelector(`[id="${listId}-${active}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [active, listId]);

  const choose = (row: Row | undefined) => {
    if (!row) return;
    if (row.kind === "remove") onRemove();
    else onChoose(row.entry);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (rows.length === 0) return;
      setActive((at) => (at + (event.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(rows[Math.min(active, rows.length - 1)]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  const fieldPaint: CSSProperties = {
    ...fieldStyle({ focusVisible: focused }),
    width: "100%",
    boxSizing: "border-box",
    height: phone ? 44 : 30,
    padding: "0 8px",
    ...text(phone ? 16 : 13, 400, t.text),
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <input
        ref={field}
        type="text"
        role="combobox"
        aria-label={REFERENCE_COPY.search}
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={rows.length ? `${listId}-${Math.min(active, rows.length - 1)}` : undefined}
        aria-autocomplete="list"
        placeholder={REFERENCE_COPY.search}
        autoComplete="off"
        spellCheck={false}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={fieldPaint}
      />
      <div ref={list} id={listId} role="listbox" aria-label={REFERENCE_COPY.button} style={{ display: "flex", flexDirection: "column", maxHeight: phone ? "60dvh" : 320, overflowY: "auto" }}>
        {rows.length === 0 || (rows.length === 1 && rows[0].kind === "remove") ? (
          <p role="status" style={{ ...text(12.5, 400, t.text2), margin: 0, padding: "8px" }}>
            {REFERENCE_COPY.none}
          </p>
        ) : null}
        {rows.map((row, at) =>
          row.kind === "remove" ? (
            <div
              key="remove"
              id={`${listId}-${at}`}
              role="option"
              aria-selected={at === active}
              data-ref-remove=""
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(at)}
              onClick={onRemove}
              style={{
                boxSizing: "border-box",
                minHeight: phone ? 44 : 32,
                padding: "4px 8px",
                marginTop: 4,
                borderTop: `1px solid ${t.hairlineModule}`,
                display: "flex",
                alignItems: "center",
                borderRadius: 6,
                cursor: "pointer",
                background: at === active ? t.tile : "transparent",
                ...text(13, 400, t.text),
              }}
            >
              {removeLabel ?? REFERENCE_COPY.remove}
            </div>
          ) : (
            <div key={row.entry.to} style={{ display: "contents" }}>
              {row.label ? <span style={{ ...text(11.5, 500, t.label), padding: "8px 8px 4px" }}>{row.label}</span> : null}
              <EntryRow
                entry={row.entry}
                id={`${listId}-${at}`}
                active={at === active}
                chosen={row.entry.to === current}
                phone={phone}
                onHover={() => setActive(at)}
                onPick={() => onChoose(row.entry)}
              />
            </div>
          ),
        )}
      </div>
    </div>
  );
}

export function ReferencePicker(props: ReferencePickerProps) {
  const { open, anchor, phone, onClose } = props;
  const field = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);

  // Under the anchor, or above it when there is no room below; never off the window's sides.
  useLayoutEffect(() => {
    if (!open || phone || !anchor) return;
    const height = box.current?.offsetHeight ?? 360;
    const below = anchor.top + 4;
    const top = below + height > window.innerHeight - 8 && below - height - 32 >= 8 ? below - height - 32 : below;
    setPlace({ top, left: Math.max(8, Math.min(anchor.left, window.innerWidth - PICKER_WIDTH - 8)) });
  }, [open, phone, anchor]);

  // A press outside closes it, as Escape does.
  useEffect(() => {
    if (!open || phone) return;
    const away = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [open, phone, onClose]);

  if (!open) return null;

  if (phone) {
    return (
      <BottomSheet open onOpenChange={(next) => !next && onClose()} title={REFERENCE_COPY.button}>
        <PickerBody {...props} field={field} />
      </BottomSheet>
    );
  }

  return createPortal(
    <div
      ref={box}
      data-testid="reference-picker"
      style={{ ...menuSurface(PICKER_WIDTH), padding: 8, position: "fixed", zIndex: 60, top: place?.top ?? anchor?.top ?? -9999, left: place?.left ?? anchor?.left ?? 0, boxSizing: "border-box" }}
    >
      <PickerBody {...props} field={field} />
    </div>,
    document.body,
  );
}

export default ReferencePicker;
