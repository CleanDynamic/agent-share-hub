/* CA-12 P4, CA-14 P5 — "Add a session", the full-width row under the last session.

   A text button, 36 tall, with a + in `--text2`; no dashed outline. It opens a popover on a computer and CA-10's BottomSheet
   on a phone, with two choices at the top:
   - "Start a new session": an empty session at the end, at once, "No app chosen"; the app is picked later in its head.
   - "Add from your connected chats": the list of every finished chat, newest first, under Today, This week and Earlier.
     Each row is a fixed 64 tall, so nothing runs into the row below: the app's mark and name, then the first prompt's
     opening words (at most 60 characters); the date and the prompt count under them; and where it already is at the right.
   A session already in this draft cannot be added twice. */

import * as Menu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";

import { ColourDot } from "@/components/brand/ColourButton";
import { Glyph } from "@/components/brand/Glyph";
import { MenuButton } from "@/components/brand/MenuButton";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";

import { TextButton } from "./composeControls";
import { SLIDE_ATTR } from "./flip";
import { ToolMark } from "./refinedPieces";
import { bareButton, ellipsis, menuItem, menuSurface, text, tnum, wellField } from "./refinedStyles";
import { draftNote, groupLibrary, openingWords, type SourceLibraryItem } from "./sourcesModel";
import { FLOATING_Z } from "./ToolPicker";

export const ADD_SESSION_COPY = {
  row: "Add a session",
  addPart: "Add a part",
  adding: "Adding…",
  title: "Add a session",
  startNew: "Start a new session",
  startNewLine: "An empty one at the end. Pick its app later.",
  startNewLineIn: (part: string) => `An empty one at the end of ${part}. Pick its app later.`,
  addTo: "Add to",
  fromChats: "Add from your connected chats",
  fromChatsLine: "Chats your connector has sent",
  back: "Back",
  yours: "Your connected chats",
  search: "Search your sessions",
  searchPlaceholder: "Search by app, date or first prompt",
  none: "No session matches.",
  empty: "No sessions yet.",
  inThisDraft: "In this draft",
  more: "Show more sessions",
} as const;

/** A row of the list is exactly this tall, at every width. */
export const PICK_ROW_HEIGHT = 64;

/** The sessions whose app, model, date or first prompt holds every word typed. No words: all of them. */
export function filterSessions(items: readonly SourceLibraryItem[], query: string): SourceLibraryItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...items];
  return items.filter((item) => {
    const hay = `${item.app} ${item.label} ${item.model ?? ""} ${item.date} ${item.firstPrompt ?? ""}`.toLowerCase();
    return words.every((word) => hay.includes(word));
  });
}

/** CA-17 P3: a part Add to can choose. `label` is "Part B", `title` is "Part B · Support agent". */
export interface AddToPart {
  key: string;
  label: string;
  title: string;
  colour?: string;
}

export interface AddSessionRowProps {
  phone: boolean;
  /** Every finished session, newest first. */
  library: readonly SourceLibraryItem[];
  hasMore?: boolean;
  loadingMore?: boolean;
  onMore?: () => void;
  /** A session is being added (on a new post, the draft is made first): the row says so at once. */
  adding: boolean;
  /** Add this finished session to the draft; `part` is the part it joins when the build has two or more. */
  onAdd: (importId: string, part?: string) => void;
  /** Start an empty session with no app; `part` as above. */
  onStartNew: (part?: string) => void;
  /** CA-17 P3: the build's parts when it has two or more. The picker then starts with "Add to". */
  parts?: readonly AddToPart[];
  /** The time the groups are read against; now when absent. */
  now?: number;
  /** CA-17 P2: "+ Add a session to this part" opens the picker; `n` changes on every ask. */
  openFor?: { part: string; n: number } | null;
}

const rowButton: CSSProperties = { ...bareButton, display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", boxSizing: "border-box", borderRadius: 6 };

/** One of the two choices at the top. */
function Choice({ title, line, onPick, phone, forward = false }: { title: string; line: string; onPick: () => void; phone: boolean; forward?: boolean }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onPick}
      {...handlers}
      style={{ ...rowButton, minHeight: phone ? 56 : 52, padding: "6px 8px", cursor: "pointer", ...(state.hovered ? { background: t.controlOn } : null), ...ring(state.focusVisible) }}
    >
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flexGrow: 1 }}>
        <span style={text(13, 500, t.text)}>{title}</span>
        <span style={text(11, 400, t.label)}>{line}</span>
      </span>
      {forward ? (
        <span aria-hidden="true" style={{ color: t.label, display: "inline-flex" }}>
          <Glyph name="chev" size={16} />
        </span>
      ) : null}
    </button>
  );
}

function PickRow({ item, phone, onPick }: { item: SourceLibraryItem; phone: boolean; onPick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const here = item.inThisDraft;
  const note = draftNote(item);
  const opening = openingWords(item.firstPrompt);
  const second = [item.appKnown ? null : item.model, item.date, `${item.promptCount} ${item.promptCount === 1 ? "prompt" : "prompts"}`].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      role="listitem"
      data-testid="library-row"
      disabled={here}
      aria-label={[item.app, opening, second, note].filter(Boolean).join(", ")}
      onClick={onPick}
      {...handlers}
      style={{
        ...rowButton,
        height: PICK_ROW_HEIGHT,
        flexShrink: 0,
        padding: "8px 8px",
        cursor: here ? "default" : "pointer",
        ...(here ? { filter: t.dimFilter } : null),
        ...(state.hovered && !here ? { background: t.controlOn } : null),
        ...ring(state.focusVisible),
      }}
    >
      {item.appKnown ? (
        <ToolMark tool={item.app} size={20} />
      ) : (
        <span aria-hidden="true" style={{ display: "inline-flex", width: 20, height: 20, alignItems: "center", justifyContent: "center", color: t.label, flexShrink: 0 }}>
          <Glyph name="layers" size={16} />
        </span>
      )}
      <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flexGrow: 1, overflow: "hidden" }}>
        <span style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0, height: 20, overflow: "hidden" }}>
          <span style={{ ...text(13, 500, t.text), whiteSpace: "nowrap", flexShrink: 0, maxWidth: "45%", ...ellipsis }}>{item.app}</span>
          {opening ? <span style={{ ...text(13, 400, t.text2), ...ellipsis, minWidth: 0 }}>{opening}</span> : null}
        </span>
        <span style={{ ...text(11, 400, t.label), ...ellipsis, ...tnum, height: 16 }}>{second}</span>
      </span>
      {note ? <span style={{ ...text(11, 400, t.label), flexShrink: 0, whiteSpace: "nowrap" }}>{note}</span> : null}
    </button>
  );
}

function ChatList({ props, close, back, part }: { props: AddSessionRowProps; close: () => void; back: () => void; part?: string }) {
  const { phone, library } = props;
  const [query, setQuery] = useState("");
  const id = useId();
  const shown = useMemo(() => filterSessions(library, query), [library, query]);
  const groups = useMemo(() => groupLibrary(shown, props.now ?? Date.now()), [shown, props.now]);
  return (
    <div data-testid="add-session-picker" style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, ...(phone ? { height: "calc(100dvh - 180px)", minHeight: 240 } : null) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <TextButton target={phone} onClick={back} style={text(13, 500, t.text2)}>
          {ADD_SESSION_COPY.back}
        </TextButton>
        <h3 style={{ ...text(13, 500, t.text), margin: 0 }}>{ADD_SESSION_COPY.yours}</h3>
      </div>
      <input
        id={`${id}-search`}
        type="search"
        aria-label={ADD_SESSION_COPY.search}
        placeholder={ADD_SESSION_COPY.searchPlaceholder}
        value={query}
        autoComplete="off"
        onChange={(event) => setQuery(event.target.value)}
        style={{ ...wellField, height: phone ? 44 : 32, padding: "0 10px", fontSize: phone ? 16 : 13 }}
      />
      <div role="list" aria-label={ADD_SESSION_COPY.yours} style={{ display: "flex", flexDirection: "column", gap: 0, minHeight: 0, ...(phone ? { flex: "1 1 auto" } : { maxHeight: 340 }), overflowY: "auto", overscrollBehavior: "contain" }}>
        {library.length === 0 ? (
          <p style={{ ...text(13, 400, t.text2), margin: 0, padding: "8px 0" }}>{ADD_SESSION_COPY.empty}</p>
        ) : shown.length === 0 ? (
          <p style={{ ...text(13, 400, t.text2), margin: 0, padding: "8px 0" }}>{ADD_SESSION_COPY.none}</p>
        ) : (
          groups.map((group) => (
            <div key={group.label} role="group" aria-label={group.label} style={{ display: "flex", flexDirection: "column" }}>
              <h4 style={{ ...text(11, 500, t.label), margin: 0, padding: "8px 8px 4px", flexShrink: 0 }}>{group.label}</h4>
              {group.items.map((item) => (
                <PickRow
                  key={item.id}
                  item={item}
                  phone={phone}
                  onPick={() => {
                    close();
                    if (part) props.onAdd(item.id, part);
                    else props.onAdd(item.id);
                  }}
                />
              ))}
            </div>
          ))
        )}
        {props.hasMore ? (
          <div style={{ padding: "8px 8px" }}>
            <TextButton onClick={() => props.onMore?.()} target={phone} disabled={props.loadingMore} style={text(13, 500, t.text2)}>
              {props.loadingMore ? "Loading…" : ADD_SESSION_COPY.more}
            </TextButton>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** CA-17 P3: "Add to", a menu button showing the chosen part's colour dot and title; choosing one changes where both choices add. */
function AddToField({ parts, chosen, onChoose, phone }: { parts: readonly AddToPart[]; chosen: AddToPart; onChoose: (key: string) => void; phone: boolean }) {
  return (
    <div data-testid="add-to" style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px 8px" }}>
      <Menu.Root modal={false}>
        <Menu.Trigger asChild>
          <MenuButton label={ADD_SESSION_COPY.addTo} value={chosen.title} lead={<ColourDot colour={chosen.colour} />} data-testid="add-to-button" style={phone ? { height: 44 } : undefined} />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content align="start" sideOffset={4} style={{ ...menuSurface(), zIndex: FLOATING_Z + 1 }}>
            {parts.map((part) => (
              <Menu.Item key={part.key} onSelect={() => onChoose(part.key)} style={{ ...menuItem(true, phone), gap: 8 }}>
                <ColourDot colour={part.colour} />
                <span style={{ flexGrow: 1 }}>{part.title}</span>
                <span aria-hidden="true" style={{ width: 16, display: "inline-flex" }}>
                  {part.key === chosen.key ? <Glyph name="check" size={16} /> : null}
                </span>
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}

function PickerBody({ props, close, initial }: { props: AddSessionRowProps; close: () => void; initial?: string }) {
  const [view, setView] = useState<"choices" | "list">("choices");
  const parts = props.parts && props.parts.length >= 2 ? props.parts : null;
  const [picked, setPicked] = useState<string | undefined>(initial);
  const chosen = parts ? (parts.find((part) => part.key === picked) ?? parts[parts.length - 1]) : null;
  if (view === "list") return <ChatList props={props} close={close} back={() => setView("choices")} part={chosen?.key} />;
  return (
    <div data-testid="add-session-choices" style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      {parts && chosen ? <AddToField parts={parts} chosen={chosen} onChoose={setPicked} phone={props.phone} /> : null}
      <Choice
        phone={props.phone}
        title={ADD_SESSION_COPY.startNew}
        line={chosen ? ADD_SESSION_COPY.startNewLineIn(chosen.label) : ADD_SESSION_COPY.startNewLine}
        onPick={() => {
          close();
          if (chosen) props.onStartNew(chosen.key);
          else props.onStartNew();
        }}
      />
      <Choice phone={props.phone} forward title={ADD_SESSION_COPY.fromChats} line={ADD_SESSION_COPY.fromChatsLine} onPick={() => setView("list")} />
    </div>
  );
}

/** CA-17 P2: the row's look, shared with "Add a part" under it. */
const addRowStyle = (hovered: boolean, focusVisible: boolean, adding: boolean): CSSProperties => ({
    ...bareButton,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
    width: "100%",
    height: 36,
    boxSizing: "border-box",
    padding: "0 8px",
    borderRadius: 6,
    ...text(13, 500, t.text2),
    cursor: adding ? "default" : "pointer",
    ...(hovered && !adding ? { background: t.controlOn } : null),
    ...ring(focusVisible),
});

/** CA-17 P2: "Add a part", a row exactly like "Add a session", directly under it. */
export function AddPartRow({ phone: _phone, adding, onAdd }: { phone: boolean; adding: boolean; onAdd: () => void }) {
  const trigger = useInteractive<HTMLButtonElement>();
  return (
    <button type="button" data-testid="add-part-row" {...{ [SLIDE_ATTR]: "add:part" }} data-hit="" disabled={adding} onClick={onAdd} {...trigger.handlers} style={addRowStyle(trigger.state.hovered, trigger.state.focusVisible, adding)}>
      <span aria-hidden="true" style={{ display: "inline-flex" }}>
        <Glyph name="plus" size={16} />
      </span>
      {ADD_SESSION_COPY.addPart}
    </button>
  );
}

export function AddSessionRow(props: AddSessionRowProps) {
  const { phone, adding } = props;
  const [open, setOpen] = useState(false);
  const trigger = useInteractive<HTMLButtonElement>();
  /* CA-17 P3: the part the picker starts on: the one whose "+ Add a session to this part" opened it, else the last. */
  const [startOn, setStartOn] = useState<string | undefined>(undefined);
  const openN = props.openFor?.n;
  const openPart = props.openFor?.part;
  useEffect(() => {
    if (openN === undefined) return;
    setStartOn(openPart);
    setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openN]);
  const triggerStyle: CSSProperties = addRowStyle(trigger.state.hovered, trigger.state.focusVisible, adding);
  const label = adding ? ADD_SESSION_COPY.adding : ADD_SESSION_COPY.row;
  const content = (
    <>
      {adding ? null : (
        <span aria-hidden="true" style={{ display: "inline-flex" }}>
          <Glyph name="plus" size={16} />
        </span>
      )}
      {label}
    </>
  );

  if (phone) {
    return (
      <>
        <button
          type="button"
          data-testid="add-session-row"
          {...{ [SLIDE_ATTR]: "add:session" }}
          data-hit=""
          disabled={adding}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => {
            setStartOn(undefined);
            setOpen(true);
          }}
          {...trigger.handlers}
          style={triggerStyle}
        >
          {content}
        </button>
        <BottomSheet open={open} onOpenChange={setOpen} title={ADD_SESSION_COPY.title}>
          {open ? <PickerBody props={props} close={() => setOpen(false)} initial={startOn} /> : null}
        </BottomSheet>
      </>
    );
  }
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setStartOn(undefined);
        setOpen(next);
      }}
    >
      <Popover.Trigger asChild>
        <button type="button" data-testid="add-session-row" {...{ [SLIDE_ATTR]: "add:session" }} data-hit="" disabled={adding} aria-haspopup="dialog" {...trigger.handlers} style={triggerStyle}>
          {content}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content aria-label={ADD_SESSION_COPY.title} align="start" sideOffset={6} collisionPadding={16} style={{ ...menuSurface(380), zIndex: FLOATING_Z, padding: 8, maxHeight: "min(560px, var(--radix-popover-content-available-height))" }}>
          <PickerBody props={props} close={() => setOpen(false)} initial={startOn} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default AddSessionRow;
