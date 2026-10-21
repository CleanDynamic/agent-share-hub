/* CA-12 P4 — "+ Add a session", the full-width row under the last session.

   Sessions are no longer in the Add menu: a session is a group of tiles, not a tile. This row opens a popover on a
   computer and CA-10's BottomSheet on a phone. It lists two things:
   - Your sessions: every finished session, newest first (app mark and name, date, prompt count, and "In this draft" or
     "Also in N drafts"), with a search box that filters by app, date or first prompt.
   - Start a new one here: pick an app, and an empty session is added.
   A session already in this draft cannot be added twice. */

import * as Popover from "@radix-ui/react-popover";
import { useId, useMemo, useState, type CSSProperties } from "react";

import { BottomSheet } from "@/components/shell/BottomSheet";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";

import { TextButton } from "./composeControls";
import { ToolMark } from "./refinedPieces";
import { bareButton, ellipsis, menuSurface, text, tnum, wellField } from "./refinedStyles";
import type { SourceLibraryItem } from "./sourcesModel";
import { FLOATING_Z, ToolPicker } from "./ToolPicker";

export const ADD_SESSION_COPY = {
  row: "+ Add a session",
  adding: "Adding…",
  title: "Add a session",
  yours: "Your sessions",
  search: "Search your sessions",
  searchPlaceholder: "Search by app, date or first prompt",
  none: "No session matches.",
  empty: "No sessions yet.",
  startNew: "Start a new one here",
  pickApp: "Pick an app",
  inThisDraft: "In this draft",
  more: "Show more sessions",
} as const;

/** The sessions whose app, date or first prompt holds every word typed. No words: all of them. */
export function filterSessions(items: readonly SourceLibraryItem[], query: string): SourceLibraryItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...items];
  return items.filter((item) => {
    const hay = `${item.label} ${item.date} ${item.firstPrompt ?? ""}`.toLowerCase();
    return words.every((word) => hay.includes(word));
  });
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
  /** Add this finished session to the draft. */
  onAdd: (importId: string) => void;
  /** Start an empty session with this app (an AI tool id or a typed name). */
  onStartNew: (tool: string) => void;
  inBuild?: readonly string[];
}

const rowButton: CSSProperties = { ...bareButton, display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", boxSizing: "border-box", borderRadius: 6 };

function PickerBody({ props, close }: { props: AddSessionRowProps; close: () => void }) {
  const { phone, library } = props;
  const [query, setQuery] = useState("");
  const id = useId();
  const shown = useMemo(() => filterSessions(library, query), [library, query]);
  return (
    <div data-testid="add-session-picker" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        <h3 style={{ ...text(12, 500, t.text2), margin: 0 }}>{ADD_SESSION_COPY.yours}</h3>
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
        <div role="list" aria-label={ADD_SESSION_COPY.yours} style={{ display: "flex", flexDirection: "column", maxHeight: phone ? undefined : 280, overflowY: "auto", overscrollBehavior: "contain" }}>
          {library.length === 0 ? (
            <p style={{ ...text(13, 400, t.text2), margin: 0, padding: "8px 0" }}>{ADD_SESSION_COPY.empty}</p>
          ) : shown.length === 0 ? (
            <p style={{ ...text(13, 400, t.text2), margin: 0, padding: "8px 0" }}>{ADD_SESSION_COPY.none}</p>
          ) : (
            shown.map((item) => (
              <PickRow
                key={item.id}
                item={item}
                phone={phone}
                onPick={() => {
                  close();
                  props.onAdd(item.id);
                }}
              />
            ))
          )}
          {props.hasMore ? (
            <div style={{ padding: "8px 0" }}>
              <TextButton onClick={() => props.onMore?.()} target={phone} disabled={props.loadingMore} style={text(12.5, 500, t.text2)}>
                {props.loadingMore ? "Loading…" : ADD_SESSION_COPY.more}
              </TextButton>
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, borderTop: `1px solid ${t.hairline}`, paddingTop: 12 }}>
        <h3 style={{ ...text(12, 500, t.text2), margin: 0 }}>{ADD_SESSION_COPY.startNew}</h3>
        <div>
          <ToolPicker
            label={ADD_SESSION_COPY.pickApp}
            placeholder={ADD_SESSION_COPY.pickApp}
            value={null}
            inBuild={props.inBuild ?? []}
            phone={phone}
            step="session"
            onChange={(tool) => {
              if (!tool) return;
              close();
              props.onStartNew(tool);
            }}
          />
        </div>
      </div>
    </div>
  );
}

function PickRow({ item, phone, onPick }: { item: SourceLibraryItem; phone: boolean; onPick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const here = item.inThisDraft;
  return (
    <button
      type="button"
      role="listitem"
      disabled={here}
      aria-label={`${item.label}, ${item.line}${item.alsoIn ? `, ${item.alsoIn}` : ""}${here ? `, ${ADD_SESSION_COPY.inThisDraft}` : ""}`}
      onClick={onPick}
      {...handlers}
      style={{
        ...rowButton,
        minHeight: phone ? 44 : 40,
        padding: "6px 6px",
        cursor: here ? "default" : "pointer",
        ...(here ? { filter: t.dimFilter } : null),
        ...(state.hovered && !here ? { background: t.controlOn } : null),
        ...ring(state.focusVisible),
      }}
    >
      <ToolMark tool={item.label} size={20} />
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flexGrow: 1 }}>
        <span style={{ ...text(13, 500, t.text), ...ellipsis }}>{item.label}</span>
        <span style={{ ...text(11.5, 400, t.label), ...ellipsis, ...tnum }}>{item.line}</span>
        {item.alsoIn ? <span style={{ ...text(11.5, 400, t.label), ...ellipsis }}>{item.alsoIn}</span> : null}
      </span>
      {here ? <span style={{ ...text(11.5, 400, t.label), flexShrink: 0 }}>{ADD_SESSION_COPY.inThisDraft}</span> : null}
    </button>
  );
}

export function AddSessionRow(props: AddSessionRowProps) {
  const { phone, adding } = props;
  const [open, setOpen] = useState(false);
  const trigger = useInteractive<HTMLButtonElement>();
  const triggerStyle: CSSProperties = {
    ...bareButton,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    width: "100%",
    height: phone ? 44 : 36,
    boxSizing: "border-box",
    padding: "0 12px",
    borderRadius: 6,
    border: `1px dashed ${t.line}`,
    ...text(13, 500, t.text2),
    cursor: adding ? "default" : "pointer",
    ...(trigger.state.hovered && !adding ? { background: t.controlOn } : null),
    ...ring(trigger.state.focusVisible),
  };
  const label = adding ? ADD_SESSION_COPY.adding : ADD_SESSION_COPY.row;

  if (phone) {
    return (
      <>
        <button type="button" data-testid="add-session-row" data-hit="" disabled={adding} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} {...trigger.handlers} style={triggerStyle}>
          {label}
        </button>
        <BottomSheet open={open} onOpenChange={setOpen} title={ADD_SESSION_COPY.title}>
          <PickerBody props={props} close={() => setOpen(false)} />
        </BottomSheet>
      </>
    );
  }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" data-testid="add-session-row" data-hit="" disabled={adding} aria-haspopup="dialog" {...trigger.handlers} style={triggerStyle}>
          {label}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content aria-label={ADD_SESSION_COPY.title} align="start" sideOffset={6} collisionPadding={16} style={{ ...menuSurface(360), zIndex: FLOATING_Z, padding: 12, maxHeight: "min(520px, var(--radix-popover-content-available-height))" }}>
          <PickerBody props={props} close={() => setOpen(false)} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default AddSessionRow;
