// Prompt 24: a picker on a phone. The field is a 44 tall box with a chevron; a tap pushes a full-screen searchable list inside the
// sheet: a search field (44, no placeholder words, named "Find"), then the choices as 48 tall rows under their group heads,
// the chosen one marked with a check. Picking goes back to the sheet with the value set. An optional last row ("Other model…")
// turns the list into one typed field with Save.

import { useId, useMemo, useRef, useState, type ReactNode } from "react";

import { MobileIcon } from "@/components/brand/MobileIcon";
import { ring } from "@/lib/theme/controls";
import { TOUCH_MIN } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { BigButton } from "./BigButton";
import { PhonePushPanel } from "./PushPanel";

export interface PickItem {
  value: string;
  label: string;
  /** One line under the label, 13 Text 3. */
  line?: string;
  disabled?: boolean;
}

export interface PickGroup {
  head?: string;
  items: readonly PickItem[];
}

export interface PhonePickListProps {
  open: boolean;
  onClose: () => void;
  /** The list's title: the field's name ("Model"). */
  title: string;
  groups: readonly PickGroup[];
  /** The chosen value, or null. */
  value: string | null;
  onPick: (value: string) => void;
  /** The search field's accessible name. */
  findLabel?: string;
  /** "Other model…": a typed value, up to `max` characters. */
  other?: { label: string; field: string; max: number; save: string; onSave: (typed: string) => void };
  /** Said when the search leaves nothing. */
  none?: string;
  /** More, after the rows ("Show all 140 tools"). */
  after?: ReactNode;
  /** The search, owned by the caller when it filters by its own rules (the tool list). */
  query?: string;
  onQuery?: (query: string) => void;
  /** A row that changes the list rather than choosing (Show all): the list stays open. */
  stay?: (value: string) => boolean;
}

const ROW = 48;

export const PICK_LIST_COPY = { find: "Find", none: "Nothing matches." } as const;

function Row({ item, chosen, onPick }: { item: PickItem; chosen: boolean; onPick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>({}, { disabled: item.disabled });
  return (
    <button
      type="button"
      role="option"
      aria-selected={chosen}
      aria-disabled={item.disabled || undefined}
      onClick={item.disabled ? undefined : onPick}
      data-ui="pick-row"
      {...handlers}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        minHeight: ROW,
        boxSizing: "border-box",
        padding: "6px 8px",
        border: 0,
        borderRadius: 10,
        background: chosen ? t.control : state.pressed && !item.disabled ? t.control : "transparent",
        color: t.text,
        textAlign: "left",
        fontFamily: FIGTREE,
        cursor: item.disabled ? "default" : "pointer",
        opacity: item.disabled ? 0.5 : 1,
        ...ring(state.focusVisible),
      }}
    >
      <span style={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1, minWidth: 0 }}>
        <span style={{ fontSize: 15, lineHeight: "20px", fontWeight: chosen ? 600 : 400, overflowWrap: "anywhere" }}>{item.label}</span>
        {item.line ? <span style={{ fontSize: 13, lineHeight: "16px", color: t.label }}>{item.line}</span> : null}
      </span>
      {chosen ? (
        <span aria-hidden="true" style={{ display: "inline-flex", color: t.brandAccent, flexShrink: 0 }}>
          <MobileIcon name="check" size={20} />
        </span>
      ) : null}
    </button>
  );
}

export function PhonePickList({ open, onClose, title, groups, value, onPick, findLabel = PICK_LIST_COPY.find, other, none = PICK_LIST_COPY.none, after, query: given, onQuery, stay }: PhonePickListProps) {
  const [own, setOwn] = useState("");
  const query = given ?? own;
  const setQuery = onQuery ?? setOwn;
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const find = useRef<HTMLInputElement>(null);
  const typed = useRef<HTMLInputElement>(null);
  const uid = useId();
  const shown = useMemo(() => {
    if (onQuery) return groups;
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.map((group) => ({ ...group, items: group.items.filter((item) => `${item.label} ${item.line ?? ""}`.toLowerCase().includes(q)) })).filter((group) => group.items.length > 0);
  }, [groups, query, onQuery]);
  const count = shown.reduce((sum, group) => sum + group.items.length, 0);
  const close = () => {
    setTyping(false);
    setDraft("");
    if (!onQuery) setOwn("");
    onClose();
  };
  const save = () => {
    const text = draft.trim().slice(0, other?.max ?? 80);
    if (!text || !other) return;
    other.onSave(text);
    close();
  };
  const field = { boxSizing: "border-box" as const, width: "100%", height: TOUCH_MIN, padding: "0 12px", border: 0, borderRadius: 12, background: t.surface, boxShadow: `inset 0 0 0 1px ${t.fieldEdge}`, color: t.text, fontFamily: FIGTREE, fontSize: 16, outline: "none" };
  return (
    <PhonePushPanel
      open={open}
      onClose={typing ? () => setTyping(false) : close}
      title={typing && other ? other.field : title}
      data-testid="pick-list"
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        (typing ? typed.current : find.current)?.focus({ preventScroll: true });
      }}
      footer={
        typing && other ? (
          <BigButton main onClick={save} disabled={!draft.trim()}>
            {other.save}
          </BigButton>
        ) : undefined
      }
    >
      {typing && other ? (
        <input ref={typed} autoFocus type="text" aria-label={other.field} value={draft} maxLength={other.max} autoComplete="off" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && save()} style={field} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ display: "flex", alignItems: "center", position: "relative" }}>
            <span aria-hidden="true" style={{ position: "absolute", left: 12, display: "inline-flex", color: t.label }}>
              <MobileIcon name="search" size={18} />
            </span>
            <input ref={find} type="text" role="combobox" aria-expanded="true" aria-autocomplete="list" aria-label={findLabel} aria-controls={`${uid}-list`} value={query} autoComplete="off" onChange={(event) => setQuery(event.target.value)} style={{ ...field, paddingLeft: 38 }} />
          </span>
          <div id={`${uid}-list`} role="listbox" aria-label={title} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {shown.map((group, at) => (
              <div key={group.head ?? `g${at}`} role="group" aria-label={group.head} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {group.head ? <p style={{ margin: "12px 8px 4px", fontSize: 13, lineHeight: "16px", color: t.label }}>{group.head}</p> : null}
                {group.items.map((item) => (
                  <Row key={item.value} item={item} chosen={item.value === value} onPick={() => {
                    onPick(item.value);
                    if (!stay?.(item.value)) close();
                  }} />
                ))}
              </div>
            ))}
          </div>
          {count === 0 ? <p role="status" style={{ margin: "8px", fontSize: 15, color: t.text2 }}>{none}</p> : null}
          {after}
          {other ? (
            <button
              type="button"
              onClick={() => {
                setDraft("");
                setTyping(true);
                window.setTimeout(() => typed.current?.focus(), 0);
              }}
              style={{ minHeight: ROW, padding: "0 8px", border: 0, borderRadius: 10, background: "transparent", color: t.text2, textAlign: "left", fontFamily: FIGTREE, fontSize: 15, cursor: "pointer" }}
            >
              {other.label}
            </button>
          ) : null}
        </div>
      )}
    </PhonePushPanel>
  );
}

export default PhonePickList;
