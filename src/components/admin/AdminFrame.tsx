/* Synth 15 Part F: the admin page's frame, shared by every tab.

   PANELS. From 1101: two panels on the page shade, `minmax(0, 1fr) 340px`, 8 apart: the tab's table and the selected row's
   detail. From 761 to 1100 the table panel is alone and the detail opens as an overlay at the right edge (the window recipe,
   340 wide, over the scrim; Escape and its close button close it). At 760 and below every row is a Card and the detail is a
   bottom sheet.

   THE DETAIL is portalled: a tab draws `<AdminDetail fact=… onClose=…>` beside its table, and the frame decides where it
   lands (the side panel, the overlay or the sheet). With nothing selected the side panel says so in one line.

   THE TABLE (prompt 06's): heads at 13 in Text 3 with no line under them, rows at least 48 tall with no lines, 2 apart, the
   hovered row on the Card fill and the selected one Card-filled too. The first cell is the row's name, a button that selects
   the row; the last holds the row's actions, small secondary buttons. On a phone the same row is a Card: the name, the other
   cells as one meta line joined by " · ", then the actions. */

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/brand/Button";
import { IconButton } from "@/components/brand/IconButton";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { HEADER_COMPACT_HEIGHT, PANEL_GUTTER, PANEL_PAD, PANEL_RADIUS } from "@/components/shell/chromeSize";
import { useColumnPanels } from "@/components/shell/frameChrome";
import { useIsPhone, useMinWidth } from "@/components/shell/useMinWidth";
import { PhonePushPanel } from "@/components/phone/PushPanel";
import { useWindowFocus } from "@/lib/focus/windowFocus";
import { ring, skeletonStyle } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, tabular, textStep } from "@/lib/theme/type";

/** The side panel's width, and the widths at which the layout changes. */
export const ADMIN_SIDE_WIDTH = 340;
export const ADMIN_WIDE_MIN = 1101;
export const ADMIN_CARDS_MAX = 760;
const ROW = 48;

/* ── type ── */

export const adminText = (size: number, color: string, extra: CSSProperties = {}): CSSProperties => ({ margin: 0, fontFamily: FIGTREE, fontSize: size, lineHeight: "20px", fontWeight: 400, color, ...extra });
export const ADMIN_HEAD: CSSProperties = adminText(textStep.headline, t.text, { fontWeight: 600, lineHeight: "24px" });
export const ADMIN_META: CSSProperties = adminText(textStep.meta, t.label);
export const ADMIN_MONO: CSSProperties = { fontFamily: DM_MONO, fontSize: textStep.body, lineHeight: "20px", color: t.text, ...tabular };

/** Where the layout is. */
export type AdminMode = "wide" | "overlay" | "cards";

export function useAdminMode(): AdminMode {
  const wide = useMinWidth(ADMIN_WIDE_MIN);
  const tablet = useMinWidth(ADMIN_CARDS_MAX + 1);
  return wide ? "wide" : tablet ? "overlay" : "cards";
}

/* ── the detail's landing place ── */

interface Registered {
  fact: string;
  close: () => void;
}

interface DetailHost {
  target: HTMLElement | null;
  register: (entry: Registered | null) => void;
}

const DetailContext = createContext<DetailHost | null>(null);

/** The selected row's detail, headed by its fact. It lands wherever the frame says; outside a frame it draws nothing. */
export function AdminDetail({ fact, onClose, children }: { fact: string; onClose: () => void; children: ReactNode }) {
  const host = useContext(DetailContext);
  const close = useRef(onClose);
  close.current = onClose;
  const register = host?.register;
  /* Mobile 28 E: the pushed page's title already says the fact, so the heading inside is for screen readers. */
  const phone = useIsPhone();
  useEffect(() => {
    if (!register) return;
    register({ fact, close: () => close.current() });
    return () => register(null);
  }, [register, fact]);
  if (!host?.target) return null;
  return createPortal(
    <div data-testid="admin-detail" style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      <h2 className={phone ? "sr-only" : undefined} style={phone ? undefined : { ...ADMIN_HEAD, overflowWrap: "anywhere" }}>{fact}</h2>
      {children}
    </div>,
    host.target,
  );
}

/** One fact in the detail: its name at 13 in Text 3 over its value at 15. */
export function DetailFact({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span style={ADMIN_META}>{label}</span>
      <span style={{ ...(mono ? ADMIN_MONO : adminText(textStep.body, t.text)), overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{children}</span>
    </div>
  );
}

/** The detail's actions, in a row that wraps. */
export function DetailActions({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{children}</div>;
}

const panel: CSSProperties = { background: t.surface, borderRadius: PANEL_RADIUS, minWidth: 0, boxSizing: "border-box" };

/** The overlay at 761 to 1100: the window recipe at the right edge, under the compact header. */
function DetailOverlay({ entry, onTarget }: { entry: Registered | null; onTarget: (el: HTMLElement | null) => void }) {
  const open = entry !== null;
  const focus = useWindowFocus(open);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => (!next ? entry?.close() : undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay data-motion="scrim" style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 40 }} />
        <Dialog.Content
          data-testid="admin-detail-overlay"
          aria-describedby={undefined}
          onOpenAutoFocus={focus.onOpenAutoFocus}
          onCloseAutoFocus={focus.onCloseAutoFocus}
          style={{
            position: "fixed",
            top: HEADER_COMPACT_HEIGHT + PANEL_GUTTER,
            right: PANEL_GUTTER,
            bottom: PANEL_GUTTER,
            zIndex: 41,
            width: ADMIN_SIDE_WIDTH,
            maxWidth: `calc(100vw - ${PANEL_GUTTER * 2}px)`,
            boxSizing: "border-box",
            overflowY: "auto",
            padding: PANEL_PAD,
            borderRadius: PANEL_RADIUS,
            background: t.window,
            boxShadow: t.windowShadow,
            color: t.text,
            fontFamily: FIGTREE,
          }}
        >
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
            <Dialog.Title style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{entry?.fact ?? ""}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton icon={X} glyph="x" label={`Close ${entry?.fact ?? ""}`} size={32} />
            </Dialog.Close>
          </div>
          <div ref={onTarget} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export interface AdminLayoutProps {
  /** The head: the h1, the facts line and the tabs. */
  head: ReactNode;
  /** The current tab's table (and the detail it draws beside it). */
  children: ReactNode;
}

/** The page: the table panel and, from 1101, the detail panel. */
export function AdminLayout({ head, children }: AdminLayoutProps) {
  const mode = useAdminMode();
  const phone = useIsPhone();
  useColumnPanels(mode !== "cards");
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [entry, setEntry] = useState<Registered | null>(null);
  const onTarget = useCallback((el: HTMLElement | null) => setTarget(el), []);
  const register = useCallback((next: Registered | null) => setEntry(next), []);
  const host = useMemo(() => ({ target, register }), [target, register]);

  const table = (
    <section aria-label="Admin" data-testid="admin-main" style={{ ...(mode === "cards" ? null : { ...panel, padding: `${PANEL_PAD}px ${PANEL_PAD}px 24px` }), display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      {head}
      {children}
    </section>
  );

  return (
    <DetailContext.Provider value={host}>
      <div
        data-testid="admin-page"
        data-mode={mode}
        style={{ fontFamily: FIGTREE, color: t.text, minWidth: 0, ...(mode === "wide" ? { display: "grid", gridTemplateColumns: `minmax(0, 1fr) ${ADMIN_SIDE_WIDTH}px`, columnGap: PANEL_GUTTER, alignItems: "start" } : null) }}
      >
        {table}
        {mode === "wide" ? (
          <aside aria-label="Selected" data-testid="admin-side" style={{ ...panel, padding: PANEL_PAD, position: "sticky", top: HEADER_COMPACT_HEIGHT + PANEL_GUTTER }}>
            {entry ? null : <p style={ADMIN_META}>Select a row to see it here.</p>}
            <div ref={onTarget} />
          </aside>
        ) : null}
      </div>
      {mode === "overlay" ? <DetailOverlay entry={entry} onTarget={onTarget} /> : null}
      {mode === "cards" && phone ? (
        /* Mobile 28 E: on a phone the selected row's detail is a page pushed over the list; Back returns to it. */
        <PhonePushPanel page open={entry !== null} onClose={() => entry?.close()} title={entry?.fact ?? "Selected"} data-testid="admin-detail-page">
          <div ref={onTarget} style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8 }} />
        </PhonePushPanel>
      ) : mode === "cards" ? (
        <BottomSheet open={entry !== null} onOpenChange={(open) => (!open ? entry?.close() : undefined)} title={entry?.fact ?? "Selected"} hideTitle>
          <div ref={onTarget} style={{ padding: "4px 4px 8px" }} />
        </BottomSheet>
      ) : null}
    </DetailContext.Provider>
  );
}

/* ── the table ── */

export interface AdminColumn<T> {
  head: string;
  cell: (row: T) => ReactNode;
  /** Mono 15, right-aligned. */
  numeric?: boolean;
  /** The cell's text on a phone's meta line, when the cell is not plain text. */
  meta?: (row: T) => string;
  /** On a phone the cell keeps its own line (a link, a note) instead of joining the meta line. */
  ownLine?: boolean;
}

export interface AdminTableProps<T> {
  /** The table's accessible name. */
  label: string;
  rows: readonly T[];
  rowKey: (row: T) => string;
  /** The first column: the row's name, which selects it. */
  name: { head: string; cell: (row: T) => ReactNode; label: (row: T) => string };
  columns: readonly AdminColumn<T>[];
  actions?: (row: T) => ReactNode;
  selected: string | null;
  onSelect: (key: string) => void;
  testId?: string;
  rowTestId?: string;
}

const CONTROLS = "button, a, input, select, textarea, [role='switch']";

const headCell: CSSProperties = { ...ADMIN_META, height: 32, padding: "0 12px", textAlign: "left", fontWeight: 400, whiteSpace: "nowrap", verticalAlign: "middle" };
const cell: CSSProperties = { ...adminText(textStep.body, t.text2), minHeight: ROW, padding: "12px", verticalAlign: "middle" };

/** The button that names and selects a row. */
function NameButton({ label, selected, onSelect, children }: { label: string; selected: boolean; onSelect: () => void; children: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      data-testid="admin-row-select"
      onClick={onSelect}
      {...handlers}
      style={{
        ...adminText(textStep.body, t.text, { fontWeight: 600 }),
        display: "block",
        maxWidth: "100%",
        padding: 0,
        border: 0,
        background: "transparent",
        textAlign: "left",
        cursor: "pointer",
        overflowWrap: "anywhere",
        textDecoration: state.hovered ? "underline" : "none",
        textUnderlineOffset: 3,
        borderRadius: 4,
        ...ring(state.focusVisible),
      }}
    >
      {children}
    </button>
  );
}

function TableRow<T>({ row, props, selected }: { row: T; props: AdminTableProps<T>; selected: boolean }) {
  const { state, handlers } = useInteractive<HTMLTableRowElement>();
  const key = props.rowKey(row);
  const pick = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest(CONTROLS)) return;
    props.onSelect(key);
  };
  const fill = selected || state.hovered ? t.module : "transparent";
  const edge = (first: boolean, last: boolean): CSSProperties => ({ background: fill, borderRadius: first && last ? 12 : first ? "12px 0 0 12px" : last ? "0 12px 12px 0" : 0 });
  const columns = props.columns.length + (props.actions ? 2 : 1);
  let index = 0;
  const at = () => {
    const i = index++;
    return edge(i === 0, i === columns - 1);
  };
  return (
    <tr data-testid={props.rowTestId} data-selected={selected ? "true" : undefined} onClick={pick} {...handlers} style={{ cursor: "pointer" }}>
      <th scope="row" style={{ ...cell, ...at(), textAlign: "left", fontWeight: 400, minWidth: 160 }}>
        <NameButton label={props.name.label(row)} selected={selected} onSelect={() => props.onSelect(key)}>
          {props.name.cell(row)}
        </NameButton>
      </th>
      {props.columns.map((column) => (
        <td key={column.head} style={{ ...cell, ...at(), ...(column.numeric ? { ...ADMIN_MONO, textAlign: "right", whiteSpace: "nowrap" } : null) }}>
          {column.cell(row)}
        </td>
      ))}
      {props.actions ? (
        <td style={{ ...cell, ...at(), whiteSpace: "nowrap", textAlign: "right" }}>
          <div style={{ display: "inline-flex", gap: 8, justifyContent: "flex-end" }}>{props.actions(row)}</div>
        </td>
      ) : null}
    </tr>
  );
}

function RowCard<T>({ row, props, selected }: { row: T; props: AdminTableProps<T>; selected: boolean }) {
  const key = props.rowKey(row);
  const metaLine = props.columns.filter((column) => !column.ownLine).map((column) => (column.meta ? column.meta(row) : null)).filter((part): part is string => Boolean(part));
  return (
    <li
      data-testid={props.rowTestId}
      data-selected={selected ? "true" : undefined}
      onClick={(event) => ((event.target as HTMLElement).closest(CONTROLS) ? undefined : props.onSelect(key))}
      style={{ background: t.module, borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4, minWidth: 0, boxShadow: selected ? `inset 0 0 0 1px ${t.text2}` : undefined }}
    >
      <NameButton label={props.name.label(row)} selected={selected} onSelect={() => props.onSelect(key)}>
        {props.name.cell(row)}
      </NameButton>
      {props.columns.filter((column) => column.ownLine).map((column) => (
        <div key={column.head} style={{ minWidth: 0 }}>{column.cell(row)}</div>
      ))}
      {metaLine.length > 0 ? <p style={ADMIN_META}>{metaLine.join(" · ")}</p> : null}
      {props.actions ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 4 }}>{props.actions(row)}</div> : null}
    </li>
  );
}

export function AdminTable<T>(props: AdminTableProps<T>) {
  const mode = useAdminMode();
  if (mode === "cards") {
    return (
      <ul aria-label={props.label} data-testid={props.testId} style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {props.rows.map((row) => (
          <RowCard key={props.rowKey(row)} row={row} props={props} selected={props.selected === props.rowKey(row)} />
        ))}
      </ul>
    );
  }
  return (
    <div role="region" aria-label={`${props.label}, table`} tabIndex={0} style={{ overflowX: "auto", margin: "0 -12px", minWidth: 0 }}>
      <table data-testid={props.testId} style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 2px" }}>
        <caption style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{props.label}</caption>
        <thead>
          <tr>
            <th scope="col" style={headCell}>{props.name.head}</th>
            {props.columns.map((column) => (
              <th key={column.head} scope="col" style={{ ...headCell, textAlign: column.numeric ? "right" : "left" }}>
                {column.head}
              </th>
            ))}
            {props.actions ? (
              <th scope="col" style={headCell}>
                <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Actions</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => (
            <TableRow key={props.rowKey(row)} row={row} props={props} selected={props.selected === props.rowKey(row)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── small pieces ── */

/** A row action: the shared Button, secondary, small (44 on a phone). */
export function RowAction({ onClick, disabled, children, testId }: { onClick: () => void; disabled?: boolean; children: ReactNode; testId?: string }) {
  const mode = useAdminMode();
  return (
    <Button variant="secondary" size={mode === "cards" ? 44 : 28} disabled={disabled} onClick={onClick} data-testid={testId}>
      {children}
    </Button>
  );
}

/** A section of a tab: its head (the fact, 20/600) and what it holds. */
export function AdminSection({ fact, label, children, testId }: { fact: string; label?: string; children: ReactNode; testId?: string }) {
  return (
    <section aria-label={label ?? fact} data-testid={testId} style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <h2 style={ADMIN_HEAD}>{fact}</h2>
      {children}
    </section>
  );
}

/** Rows while a list loads: blocks at the rows' pitch. */
export function AdminRowsLoading({ count = 3, testId }: { count?: number; testId?: string }) {
  return (
    <div data-testid={testId} aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} style={{ ...skeletonStyle(), height: ROW, borderRadius: 12 }} />
      ))}
    </div>
  );
}

/** An empty list: one line. */
export function AdminEmpty({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p data-testid={testId} style={adminText(textStep.body, t.text2)}>
      {children}
    </p>
  );
}

/** "1 report", "3 reports". */
export const countOf = (count: number, one: string, many = `${one}s`): string => `${count.toLocaleString("en-GB")} ${count === 1 ? one : many}`;
