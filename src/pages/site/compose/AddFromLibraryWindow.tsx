/* SV-18: Add from Library, the window. Pure: its props are the place, the rows, the selection and the version.

   It is drawn as `design/reference/vision/dusk/composer-add-from-library.html` draws it: 640 wide, 80 from the top, `--window`
   with a 1px `--control-border`, radius 12, `--window-shadow`, over `--scrim`, no blur. The frame, the close button and the
   buttons come from `modalRecipes`; it opens and closes with the same Radix dialog the tile windows use, so its motion is
   theirs and nothing here is new. On a phone it is the same body in the existing sheet.

   WHAT IT LISTS is what fits where the maker is adding (`fitsPlace`, decided by the host); an item that does not fit is not here.
   The list is a radio group: one tab stop, the arrow keys move the choice, Enter inserts, Escape closes. The search field keeps
   the app's focus ring (the board sets `outline: none`; that is not ported). The "Current version" segment is switched on by
   SV-19, which is what knows the source's newer version; until then it is shown and cannot be chosen. */

import * as Dialog from "@radix-ui/react-dialog";
import { useRef, type CSSProperties, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";

import { Segmented } from "@/components/brand/Segmented";
import { UnderlineTabs } from "@/components/brand/UnderlineTabs";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { useWindowFocus } from "@/lib/focus/windowFocus";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { IconSquare, RecipeButton } from "./modalRecipes";

export type LibraryTab = "steps" | "collections";
export type LibraryVersion = "saved" | "current";
export type LibraryRowState = "same" | "edited" | "stale";

export interface LibraryWindowRow {
  id: string;
  title: string;
  state: LibraryRowState;
  /** "Step 7 · Call notes that write themselves · @maya · Opus 5.5 · used in 4 builds" */
  detail: string;
  /** "12 Oct": when it was saved. */
  savedOn: string;
  /** "23 Oct": when its source last changed, once SV-19 knows. */
  currentOn: string | null;
}

export const LIBRARY_WINDOW_COPY = {
  title: "Add from Library",
  close: "Close",
  cancel: "Cancel",
  insert: "Insert",
  tabs: "Kind",
  steps: "Steps",
  collections: "Collections",
  version: "Version to insert",
  states: { same: "Same", edited: "Edited since saved", stale: "Stale" } as Record<LibraryRowState, string>,
  loading: "Loading your saved items…",
  error: "Your saved items did not load.",
  retry: "Retry",
  empty: "Nothing you have saved fits here yet.",
  noMatch: "Nothing matches that.",
  openLibrary: "Open Library",
  inside: (place: string, fits: string): string => `Inside ${place} · ${fits} fit here`,
  find: (what: string): string => `Find a saved ${what}`,
  list: (what: string): string => `Saved ${what}`,
  saved: (date: string): string => `Saved version · ${date}`,
  current: (date: string | null): string => (date ? `Current version · ${date}` : "Current version"),
} as const;

export interface AddFromLibraryWindowProps {
  open: boolean;
  phone: boolean;
  /** "Session 2 · Clean-up agent". */
  place: string;
  /** "prompts": what fits here. */
  fits: string;
  /** "prompt", "agent" or "step": the word the search and the list are named by. */
  noun: string;
  tab: LibraryTab;
  counts: Record<LibraryTab, number>;
  /** Why a kind is missing, beside the tabs ("Sessions don't fit inside an agent"); null when none is. */
  missing: string | null;
  query: string;
  status: "loading" | "error" | "ready";
  rows: readonly LibraryWindowRow[];
  selectedId: string | null;
  version: LibraryVersion;
  /** The footer's sentence about the selected item. */
  footer: string;
  /** An insert is on its way: Insert waits. */
  inserting?: boolean;
  onTab: (tab: LibraryTab) => void;
  onQuery: (query: string) => void;
  onSelect: (id: string) => void;
  onVersion: (version: LibraryVersion) => void;
  /** The id of the row to insert: the chosen one, or the one Enter was pressed on. */
  onInsert: (id: string) => void;
  onClose: () => void;
  onRetry?: () => void;
  /** Where focus goes as the window closes (the Add menu). Absent: back to what opened it. */
  onCloseFocus?: (event: Event) => void;
}

const line = (size: number, weight: 400 | 500, color: string, height?: number): CSSProperties => ({ fontFamily: FIGTREE, fontSize: size, fontWeight: weight, color, ...(height ? { lineHeight: `${height}px` } : null) });

const TITLE_STYLE: CSSProperties = { ...line(14, 500, t.text), margin: 0, lineHeight: 1.3 };
const SUB_STYLE: CSSProperties = { ...line(12, 400, t.label), margin: "2px 0 0" };

/** The rows that match the search: its words are all in the title or the detail. Pure. */
export function matchingRows(rows: readonly LibraryWindowRow[], query: string): LibraryWindowRow[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...rows];
  return rows.filter((row) => {
    const haystack = `${row.title} ${row.detail}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

function Row({ row, selected, tabStop, last, phone, version, versions, onSelect, onVersion, onKeyDown }: { row: LibraryWindowRow; selected: boolean; tabStop: boolean; last: boolean; phone: boolean; version: LibraryVersion; versions: boolean; onSelect: () => void; onVersion: (version: LibraryVersion) => void; onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void }) {
  const { state, handlers } = useInteractive<HTMLDivElement>();
  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={tabStop ? 0 : -1}
      data-testid="library-row"
      data-row-id={row.id}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      {...handlers}
      style={{
        boxSizing: "border-box",
        cursor: "pointer",
        ...(selected
          ? { margin: "0 -12px", padding: 12, background: t.selectedFill, border: `1px solid ${t.selectedEdge}`, borderRadius: 8 }
          : { padding: "12px 0", borderBottom: last ? "none" : `1px solid ${t.hairline}` }),
        ...ring(state.focusVisible),
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <span style={line(13, 500, t.text, 20)}>{row.title}</span>
        <span style={{ ...line(12, 400, row.state === "edited" ? t.lit : t.label, 20), flexShrink: 0 }}>{LIBRARY_WINDOW_COPY.states[row.state]}</span>
      </div>
      <div style={line(12, 400, t.label, 17)}>{row.detail}</div>
      {selected && versions ? (
        <div style={{ marginTop: 12 }} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <Segmented<LibraryVersion>
            label={LIBRARY_WINDOW_COPY.version}
            size={phone ? 40 : 32}
            fullWidth
            value={version}
            onChange={onVersion}
            items={[
              { value: "saved", label: LIBRARY_WINDOW_COPY.saved(row.savedOn) },
              { value: "current", label: LIBRARY_WINDOW_COPY.current(row.currentOn), disabled: row.currentOn === null },
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}

function SearchField({ label, value, phone, onChange }: { label: string; value: string; phone: boolean; onChange: (value: string) => void }) {
  const { state, handlers } = useInteractive<HTMLInputElement>();
  return (
    <input
      type="search"
      aria-label={label}
      placeholder={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      {...handlers}
      style={{ boxSizing: "border-box", width: "100%", height: phone ? 44 : 32, padding: "0 10px", background: t.well, border: `1px solid ${t.wellBorder}`, borderRadius: 6, color: t.text, fontFamily: FIGTREE, fontSize: phone ? 16 : 13, ...ring(state.focusVisible) }}
    />
  );
}

/** The window's inside: head, tabs, search, the list, the footer. */
function Body(props: AddFromLibraryWindowProps) {
  const { phone, place, fits, noun, tab, counts, missing, query, status, rows, selectedId, version, footer, inserting, onTab, onQuery, onSelect, onVersion, onInsert, onClose, onRetry } = props;
  const shown = matchingRows(rows, query);
  const group = useRef<HTMLDivElement>(null);
  const selectedShown = shown.find((row) => row.id === selectedId) ?? null;
  // One tab stop: the chosen row, else the first.
  const stop = selectedShown?.id ?? shown[0]?.id ?? null;
  const copy = LIBRARY_WINDOW_COPY;
  const what = tab === "collections" ? "collection" : noun;

  const move = (event: KeyboardEvent<HTMLDivElement>, from: number) => {
    const by = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
    if (by !== 0) {
      event.preventDefault();
      const to = (from + by + shown.length) % shown.length;
      onSelect(shown[to].id);
      group.current?.querySelectorAll<HTMLElement>('[role="radio"]')[to]?.focus();
    } else if (event.key === "Enter" && !inserting) {
      event.preventDefault();
      onSelect(shown[from].id);
      onInsert(shown[from].id);
    }
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: "20px 20px 0" }}>
        <div style={{ minWidth: 0 }}>
          {phone ? <h2 style={TITLE_STYLE}>{copy.title}</h2> : <Dialog.Title style={TITLE_STYLE}>{copy.title}</Dialog.Title>}
          {phone ? <p style={SUB_STYLE}>{copy.inside(place, fits)}</p> : <Dialog.Description style={SUB_STYLE}>{copy.inside(place, fits)}</Dialog.Description>}
        </div>
        <IconSquare glyph="x" label={copy.close} phone={phone} onClick={onClose} style={{ borderRadius: 6 }} />
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: 16, padding: "0 20px", borderBottom: `1px solid ${t.hairline}` }}>
        <div style={{ marginBottom: -1 }}>
          <UnderlineTabs<LibraryTab>
            label={copy.tabs}
            value={tab}
            onChange={onTab}
            tabs={[
              { value: "steps", label: copy.steps, count: counts.steps },
              { value: "collections", label: copy.collections, count: counts.collections },
            ]}
          />
        </div>
        {missing ? <span style={{ ...line(12, 400, t.label), paddingBottom: 8, textAlign: "right" }}>{missing}</span> : null}
      </div>

      <div style={{ padding: "12px 20px 0" }}>
        <SearchField label={copy.find(what)} value={query} phone={phone} onChange={onQuery} />
      </div>

      <div style={{ padding: "8px 20px 0", overflowY: "auto", minHeight: 0, flex: "1 1 auto" }}>
        {status === "loading" ? (
          <p role="status" style={{ ...line(12.5, 400, t.label, 18), margin: "12px 0" }}>
            {copy.loading}
          </p>
        ) : status === "error" ? (
          <div role="alert" style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 0", ...line(12.5, 400, t.text2, 18) }}>
            <span>{copy.error}</span>
            {onRetry ? (
              <RecipeButton small phone={phone} onClick={onRetry}>
                {copy.retry}
              </RecipeButton>
            ) : null}
          </div>
        ) : shown.length === 0 ? (
          <p style={{ ...line(12.5, 400, t.label, 18), margin: "12px 0" }}>
            {rows.length === 0 ? copy.empty : copy.noMatch}{" "}
            {rows.length === 0 ? (
              <Link to="/library" style={{ color: t.text2, textDecoration: "underline", textUnderlineOffset: 3, textDecorationColor: t.line }}>
                {copy.openLibrary}
              </Link>
            ) : null}
          </p>
        ) : (
          <div ref={group} role="radiogroup" aria-label={copy.list(`${what}s`)}>
            {shown.map((row, at) => (
              <Row
                key={row.id}
                row={row}
                selected={row.id === selectedId}
                tabStop={row.id === stop}
                last={at === shown.length - 1}
                phone={phone}
                version={version}
                versions={tab === "steps"}
                onSelect={() => onSelect(row.id)}
                onVersion={onVersion}
                onKeyDown={(event) => move(event, at)}
              />
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, padding: "16px 20px", borderTop: `1px solid ${t.hairline}`, flexWrap: phone ? "wrap" : "nowrap" }}>
        <p aria-live="polite" style={{ ...line(12, 400, t.label, 17), margin: 0, flex: 1, minWidth: 0 }}>
          {selectedShown ? footer : ""}
        </p>
        <RecipeButton phone={phone} onClick={onClose}>
          {copy.cancel}
        </RecipeButton>
        <RecipeButton variant="primary" phone={phone} disabled={!selectedShown || inserting} onClick={() => selectedShown && onInsert(selectedShown.id)}>
          {copy.insert}
        </RecipeButton>
      </div>
    </>
  );
}

export function AddFromLibraryWindow(props: AddFromLibraryWindowProps) {
  const { open, phone, onClose, onCloseFocus } = props;
  const focus = useWindowFocus(open, onCloseFocus);
  if (phone) {
    return (
      <BottomSheet open={open} onOpenChange={(next) => !next && onClose()} title={LIBRARY_WINDOW_COPY.title}>
        {open ? <Body {...props} /> : null}
      </BottomSheet>
    );
  }
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 50 }} />
        <Dialog.Content
          data-testid="add-from-library"
          onOpenAutoFocus={focus.onOpenAutoFocus}
          onCloseAutoFocus={focus.onCloseAutoFocus}
          style={{
            position: "fixed",
            top: 80,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 51,
            width: 640,
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "calc(100dvh - 120px)",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            background: t.window,
            border: `1px solid ${t.controlBorder}`,
            borderRadius: 12,
            boxShadow: t.windowShadow,
            color: t.text,
            fontFamily: FIGTREE,
            fontSize: 13,
            lineHeight: "20px",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {open ? <Body {...props} /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default AddFromLibraryWindow;
