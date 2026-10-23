// LinkPanel: link words in the post to a reference group, a part, a session or a tile (CA-19 P3, board "References: from
// the post"). It replaces ReferencePicker's look in the post and keeps its keyboard: the search field has focus, the arrow
// keys move, Enter chooses, Escape closes (and after a typed @, puts the @ back). On a phone it is a BottomSheet.
//
// The window is 372 wide, under the selection or at the cursor. Head: "Link text", and under it the words in straight
// quotes and their post. Then the search, and under a rule the list: REFERENCE GROUPS (each with its members by name
// under it), then PARTS, SESSIONS AND TILES in build order, sessions in 12 and tiles in 24. Grouped components are left out
// of the second list. Choosing a row links at once, as one step; when the target is already linked elsewhere, an inner
// panel under the row asks first. The footer has Undo and Redo at the left, Remove the link when the words carry one, and
// Done.
//
// PURE but for its own search, active row and move question. What a choice does to the post is the caller's (PostTab).

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

import { BottomSheet } from "@/components/shell/BottomSheet";
import { linkPanelLists, type PanelGroup, type PanelRow, type RefEntry, type RefGroup } from "@/lib/build/postRefs";
import { t } from "@/lib/theme/tokens";
import { FieldInput, HEADER_ICONS, IconSquare, RecipeButton, footerStyle, frameStyle } from "@/pages/site/compose/modalRecipes";
import { DANGER, ELLIPSIS, GAP, InnerPanel, PAD, SECTION_LABEL, SquareSwatch, UndoRedo, data, words } from "@/pages/site/compose/referencePieces";

export const LINK_PANEL_COPY = {
  button: "Link to a group, part, session or tile",
  search: "Find a group, part, session or tile",
  head: "Link text",
  groups: "Reference groups",
  parts: "Parts, sessions and tiles",
  none: "Nothing has that name",
  noName: "No name",
  remove: "Remove the link",
  done: "Done",
  close: "Close",
  cancel: "Cancel",
  moveHere: "Move it here",
  components: (n: number) => `${n} ${n === 1 ? "component" : "components"}`,
  linked: " · linked",
  post: (n: number) => `Post ${n}`,
  moveLine: (name: string, linked: string, post: number) => `${name} is linked to "${linked}" in post ${post}. Linking here moves it.`,
} as const;

/** The window's width on a desktop. */
export const LINK_PANEL_WIDTH = 372;

export interface LinkPanelHistory {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export interface LinkPanelProps {
  open: boolean;
  phone: boolean;
  /** Where the window's top left goes: under the selection or at the caret. */
  anchor: { top: number; left: number } | null;
  groups: readonly RefGroup[];
  /** Every target by its `to`, groups too (`withGroupEntries`). */
  lookup: ReadonlyMap<string, RefEntry>;
  /** The link the highlighted words (or the caret) already carry: that row is active, and Remove the link is offered. */
  current: string | null;
  /** The highlighted words, trimmed; empty with nothing highlighted. */
  words: string;
  /** The post the words are in, from 1. */
  post: number;
  /** Why the words cannot be linked ("Linked text has to be one stretch inside one post."), or null. */
  refusal: string | null;
  /** A target's linked text elsewhere in the post, if it has some: choosing it asks first. */
  linkedElsewhere: (to: string) => { words: string; post: number } | null;
  /** The screen's name for a target: "Data model", "Session 3", "Login flow". */
  nameOf: (to: string) => string;
  onChoose: (entry: RefEntry) => void;
  onRemove: () => void;
  /** Escape, Done, the close square, a press outside. */
  onClose: () => void;
  history?: LinkPanelHistory;
}

type Option = { kind: "group"; group: PanelGroup } | { kind: "row"; row: PanelRow };
const toOf = (option: Option) => (option.kind === "group" ? option.group.entry.to : option.row.entry.to);

function GroupRow({ group, id, active, chosen, linked, onPick, onHover }: { group: PanelGroup; id: string; active: boolean; chosen: boolean; linked: boolean; onPick: () => void; onHover: () => void }) {
  const named = Boolean(group.entry.group?.name);
  return (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div
        id={id}
        role="option"
        aria-selected={active}
        aria-current={chosen ? "true" : undefined}
        data-ref-option={group.entry.to}
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={onHover}
        onClick={onPick}
        style={{ boxSizing: "border-box", height: 36, padding: PAD.row, borderRadius: 7, display: "flex", alignItems: "center", gap: GAP.row, cursor: "pointer", background: active ? t.controlOn : "transparent" }}
      >
        <SquareSwatch colour={group.entry.colour} />
        <span style={{ ...words(13, 500, named ? t.text : t.text2), ...ELLIPSIS, flexGrow: 1 }}>{named ? group.entry.title : LINK_PANEL_COPY.noName}</span>
        <span style={{ ...words(12, 400, t.label), flexShrink: 0 }}>
          {LINK_PANEL_COPY.components(group.count)}
          {linked ? LINK_PANEL_COPY.linked : ""}
        </span>
      </div>
      <span aria-hidden="true" style={{ ...words(12, 400, t.label), padding: PAD.members, ...ELLIPSIS }}>
        {group.members}
      </span>
    </div>
  );
}

function EntryRow({ row, id, active, chosen, onPick, onHover }: { row: PanelRow; id: string; active: boolean; chosen: boolean; onPick: () => void; onHover: () => void }) {
  const { entry } = row;
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
      style={{ boxSizing: "border-box", height: 34, flexShrink: 0, padding: PAD.row, paddingLeft: GAP.row + row.indent, borderRadius: 7, display: "flex", alignItems: "center", gap: GAP.row, cursor: "pointer", background: active ? t.controlOn : "transparent" }}
    >
      <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 2, minWidth: 22, flexShrink: 0 }}>
        <span style={data(11, t.text2)}>{entry.number}</span>
        {entry.colour ? <span aria-hidden="true" data-colour-bar="" style={{ width: 12, height: 2, borderRadius: 1, background: entry.colour }} /> : null}
      </span>
      <span style={{ ...words(13, 400, t.text), ...ELLIPSIS, flexGrow: 1 }}>{entry.title}</span>
      <span style={{ ...words(12, 400, t.label), flexShrink: 0 }}>{entry.kind}</span>
    </div>
  );
}

function MovePanel({ line, phone, onCancel, onMove }: { line: string; phone: boolean; onCancel: () => void; onMove: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  // The question opens under its row: the list scrolls so all of it shows.
  useEffect(() => {
    box.current?.scrollIntoView?.({ block: "nearest" });
  }, []);
  return (
    <div ref={box} style={{ display: "flex", flexShrink: 0 }}>
      <InnerPanel testId="link-move" style={{ margin: "4px 0 6px", display: "flex", flexDirection: "column", gap: GAP.row, flexShrink: 0, flexGrow: 1 }}>
        <p style={{ ...words(12.5, 400, t.text2, 18), margin: 0 }}>{line}</p>
        <span style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <RecipeButton small phone={phone} onClick={onCancel}>
            {LINK_PANEL_COPY.cancel}
          </RecipeButton>
          <RecipeButton small variant="primary" phone={phone} onClick={onMove}>
            {LINK_PANEL_COPY.moveHere}
          </RecipeButton>
        </span>
      </InnerPanel>
    </div>
  );
}

function PanelBody({ groups, lookup, current, words: picked, post, refusal, linkedElsewhere, nameOf, onChoose, onRemove, onClose, history, phone, field }: Omit<LinkPanelProps, "open" | "anchor"> & { field: React.RefObject<HTMLInputElement> }) {
  const [query, setQuery] = useState("");
  const [moving, setMoving] = useState<string | null>(null);
  const listId = useId();
  const lists = useMemo(() => linkPanelLists(groups, lookup, query), [groups, lookup, query]);
  const options = useMemo<Option[]>(() => [...lists.groups.map((group) => ({ kind: "group" as const, group })), ...lists.rows.map((row) => ({ kind: "row" as const, row }))], [lists]);
  // Words linked to a member of a group (an old post) open on the group.
  const groupOfCurrent = current ? lists.groups.find((group) => group.entry.group?.members.some((member) => member.to === current))?.entry.to : undefined;
  const startAt = Math.max(0, options.findIndex((option) => toOf(option) === (groupOfCurrent ?? current)));
  const [active, setActive] = useState(startAt);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActive(query ? 0 : startAt);
    setMoving(null);
    // The chosen link leads only until something is typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  useEffect(() => {
    field.current?.focus();
  }, [field]);
  useEffect(() => {
    list.current?.querySelector(`[id="${listId}-${active}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [active, listId]);

  const choose = (option: Option | undefined) => {
    if (!option || refusal) return;
    const entry = option.kind === "group" ? option.group.entry : option.row.entry;
    if (entry.to !== current && linkedElsewhere(entry.to)) setMoving(entry.to);
    else onChoose(entry);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (options.length === 0) return;
      setMoving(null);
      setActive((at) => (at + (event.key === "ArrowDown" ? 1 : options.length - 1)) % options.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = options[Math.min(active, options.length - 1)];
      if (moving && option && toOf(option) === moving) onChoose(option.kind === "group" ? option.group.entry : option.row.entry);
      else choose(option);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (moving) setMoving(null);
      else onClose();
    }
  };

  const moveFor = (entry: RefEntry) => {
    if (moving !== entry.to) return null;
    const there = linkedElsewhere(entry.to);
    if (!there) return null;
    return <MovePanel line={LINK_PANEL_COPY.moveLine(nameOf(entry.to), there.words, there.post)} phone={phone} onCancel={() => setMoving(null)} onMove={() => onChoose(entry)} />;
  };

  const subtitle = picked ? `"${picked}" · ${LINK_PANEL_COPY.post(post)}` : LINK_PANEL_COPY.post(post);
  const groupCount = lists.groups.length;

  return (
    <div data-testid="link-panel-body" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: phone ? "0 0 12px" : PAD.head }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flexGrow: 1, minWidth: 0 }}>
          {phone ? null : <span style={words(14, 500, t.text)}>{LINK_PANEL_COPY.head}</span>}
          <span data-testid="link-panel-words" style={{ ...words(12.5, 400, t.text2), overflowWrap: "anywhere" }}>
            {subtitle}
          </span>
          {refusal ? (
            <span role="alert" data-testid="link-panel-refusal" style={words(12.5, 400, DANGER, 18)}>
              {refusal}
            </span>
          ) : null}
        </div>
        {phone ? null : (
          <div style={HEADER_ICONS}>
            <IconSquare glyph="x" label={LINK_PANEL_COPY.close} onClick={onClose} />
          </div>
        )}
      </div>
      <div style={{ padding: phone ? "0 0 12px" : PAD.search }}>
        <FieldInput
          ref={field}
          phone={phone}
          role="combobox"
          aria-label={LINK_PANEL_COPY.search}
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={options.length ? `${listId}-${Math.min(active, options.length - 1)}` : undefined}
          aria-autocomplete="list"
          placeholder={LINK_PANEL_COPY.search}
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
      <div
        ref={list}
        id={listId}
        role="listbox"
        aria-label={LINK_PANEL_COPY.button}
        style={{ display: "flex", flexDirection: "column", borderTop: `1px solid ${t.hairline}`, padding: phone ? "0 0 8px" : PAD.list, maxHeight: phone ? "60dvh" : 360, overflowY: "auto", minHeight: 0 }}
      >
        {options.length === 0 ? (
          <p role="status" style={{ ...words(12.5, 400, t.text2), margin: 0, padding: PAD.label }}>
            {LINK_PANEL_COPY.none}
          </p>
        ) : null}
        {groupCount > 0 ? (
          <span role="presentation" style={{ ...SECTION_LABEL, padding: PAD.label, flexShrink: 0 }}>
            {LINK_PANEL_COPY.groups}
          </span>
        ) : null}
        {lists.groups.map((group, at) => (
          <div key={group.entry.to} style={{ display: "contents" }}>
            <GroupRow
              group={group}
              id={`${listId}-${at}`}
              active={at === active}
              chosen={group.entry.to === current}
              linked={group.entry.to === current || Boolean(linkedElsewhere(group.entry.to))}
              onHover={() => setActive(at)}
              onPick={() => {
                setActive(at);
                choose({ kind: "group", group });
              }}
            />
            {moveFor(group.entry)}
          </div>
        ))}
        {lists.rows.length > 0 ? (
          <span role="presentation" style={{ ...SECTION_LABEL, padding: PAD.label, flexShrink: 0 }}>
            {LINK_PANEL_COPY.parts}
          </span>
        ) : null}
        {lists.rows.map((row, index) => {
          const at = groupCount + index;
          return (
            <div key={row.entry.to} style={{ display: "contents" }}>
              <EntryRow
                row={row}
                id={`${listId}-${at}`}
                active={at === active}
                chosen={row.entry.to === current}
                onHover={() => setActive(at)}
                onPick={() => {
                  setActive(at);
                  choose({ kind: "row", row });
                }}
              />
              {moveFor(row.entry)}
            </div>
          );
        })}
      </div>
      <div data-testid="link-panel-footer" style={footerStyle(phone)}>
        {history ? <UndoRedo phone={phone} canUndo={history.canUndo} canRedo={history.canRedo} onUndo={history.onUndo} onRedo={history.onRedo} /> : null}
        <span style={{ flexGrow: 1 }} />
        {current ? (
          <RecipeButton small phone={phone} onClick={onRemove} data-testid="link-panel-remove">
            {LINK_PANEL_COPY.remove}
          </RecipeButton>
        ) : null}
        <RecipeButton small variant="primary" phone={phone} onClick={onClose}>
          {LINK_PANEL_COPY.done}
        </RecipeButton>
      </div>
    </div>
  );
}

export function LinkPanel(props: LinkPanelProps) {
  const { open, anchor, phone, onClose } = props;
  const field = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);

  // Under the anchor, or above it when there is no room below; never off the window's sides.
  useLayoutEffect(() => {
    if (!open || phone || !anchor) return;
    const height = box.current?.offsetHeight ?? 420;
    const below = anchor.top + 6;
    const top = below + height > window.innerHeight - 8 && below - height - 32 >= 8 ? below - height - 32 : Math.max(8, Math.min(below, window.innerHeight - height - 8));
    setPlace({ top, left: Math.max(8, Math.min(anchor.left, window.innerWidth - LINK_PANEL_WIDTH - 8)) });
  }, [open, phone, anchor]);

  // A press outside closes it, as Escape does; not inside a menu or the notice.
  useEffect(() => {
    if (!open || phone) return;
    const away = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (box.current?.contains(target) || target?.closest?.('[data-testid="reference-notice"]')) return;
      onClose();
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [open, phone, onClose]);

  if (!open) return null;

  if (phone) {
    return (
      <BottomSheet open onOpenChange={(next) => !next && onClose()} title={LINK_PANEL_COPY.head}>
        <PanelBody {...props} field={field} />
      </BottomSheet>
    );
  }

  const surface: CSSProperties = { ...frameStyle(LINK_PANEL_WIDTH), position: "fixed", zIndex: 60, top: place?.top ?? anchor?.top ?? -9999, left: place?.left ?? anchor?.left ?? 0 };
  return createPortal(
    <div ref={box} role="dialog" aria-label={LINK_PANEL_COPY.head} data-testid="link-panel" style={surface}>
      <PanelBody {...props} field={field} />
    </div>,
    document.body,
  );
}

export default LinkPanel;
