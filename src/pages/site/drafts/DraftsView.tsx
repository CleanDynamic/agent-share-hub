/* UI-P46 — Drafts: the builds in progress, and the sessions waiting to join one.

   PURE. Props in, markup out: no fetching, no `useAuth()`, no router hooks but
   links. `DraftsPage` supplies the data and the writes; the dev compare page
   supplies the sample data. The viewport is read here (768px) so both behave the
   same.

   TWO PLAIN LISTS. Continue editing (the creator's drafts, last edited first,
   with a dashed "Start a new build" row first) and Sessions (the conversations
   their AI tools sent through the connector, one line each). A session joins a
   draft by being dragged onto it, or with its + menu; both end in the same
   `onAddToDraft` / `onAddToNew`. Dragging is a mouse's job: below 768px, and on
   any pointer that is not fine, rows are not draggable and the + menu is the
   way (a bottom sheet on the phone, a dropdown on desktop).

   NOTHING HERE READS content_items OR content_blocks. The older post drafts are
   a link to /drafts/posts.

   THE DRAG DATA is the session id as `text/plain`, effect `copy`. A drop target
   only answers a drag that carries text, so dragging a file or a link over it
   does nothing.

   DENSER SINCE UI-P58. No board draws Drafts, so every size this file sets is
   its old value through the density table (`design/prompts/README-density.md`):
   draft rows 52 (46 on a phone), session rows 43 (46), menu rows 31 at 13px,
   the phone's sheet rows held at 44, the touch target. The brand pieces
   (Button, IconButton, Panel, display()) take the drawn size and map it. */

import { useState, type CSSProperties, type DragEvent, type ReactNode, type Ref } from "react";
import { ChevronRight, GripVertical, Plus } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/brand/Button";
import { EmptyState } from "@/components/brand/EmptyState";
import { ErrorState } from "@/components/brand/ErrorState";
import { IconButton } from "@/components/brand/IconButton";
import { ModelMark } from "@/components/brand/ModelMark";
import { Panel } from "@/components/brand/Panel";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { ConfirmDialog } from "@/pages/site/compose/referencePieces";
import { useFinePointer, useIsPhone } from "@/components/shell/useMinWidth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DraftListItem } from "@/lib/build/drafts";
import type { SessionSummary } from "@/lib/build/sessions";
import { MENU_ITEM_CLASS, ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, display } from "@/lib/theme/type";

import {
  addLabel,
  draftMeta,
  draftTitle,
  isUntitled,
  menuItems,
  promptLine,
  sessionMeta,
  type MenuItem,
} from "./draftsModel";

/* ── the view's props ── */

export type DraftsStatus = "loading" | "error" | "ready";

export interface DraftsViewProps {
  /** The page's fit (UI-P16). Drafts is a list page: it grows with its rows either way. */
  fit?: "board" | "content";
  now: number;
  /** CA-10: each panel has its own status. The drafts panel's comes from the drafts read alone. */
  draftsStatus: DraftsStatus;
  onRetryDrafts: () => void;
  /** The drafts read's error, logged once and its code shown. */
  draftsError?: unknown;
  /** CA-10: the sessions panel's, from the waiting-sessions read alone. */
  sessionsStatus: DraftsStatus;
  onRetrySessions: () => void;
  sessionsError?: unknown;
  /** CA-10: a marker over the Sessions panel, so the page polls only while the panel is on screen. */
  sessionsAnchor?: Ref<HTMLSpanElement>;
  drafts: readonly DraftListItem[];
  /** CA-12: every finished session, newest first: waiting, in a draft, in several, or expired. None is hidden. */
  sessions: readonly SessionSummary[];
  /** CA-12: the list has another page; "Show more" asks for it. */
  moreSessions?: { loading: boolean; onMore: () => void };
  /** A session dropped on the start row, or "Start a new build" in its menu. */
  onAddToNew: (sessionId: string) => void;
  /** A session dropped on a draft, or "Add to …" in its menu. */
  onAddToDraft: (sessionId: string, draft: Pick<DraftListItem, "id" | "title">) => void;
  /** "Connect a tool" and "How they get here" open the connector dialog. */
  onConnect: () => void;
  /** SV-03 P2: drafts with no title, no sessions, no tiles, no files and no post. Removed in one delete, after the confirm window. */
  emptyDrafts?: { count: number; onRemove: () => void };
}

/* ── shared pieces ── */

const underlined: CSSProperties = {
  fontFamily: FIGTREE,
  fontSize: 12,
  color: t.text2,
  textDecoration: "underline",
  background: "transparent",
  border: 0,
  padding: 0,
  cursor: "pointer",
};

function TextButton({ onClick, style, children, disabled }: { onClick: () => void; style?: CSSProperties; children: ReactNode; disabled?: boolean }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button type="button" data-hit="" disabled={disabled} onClick={onClick} {...handlers} style={{ ...underlined, borderRadius: 6, ...ring(state.focusVisible), ...style }}>
      {children}
    </button>
  );
}

function ListHead({ title, count, right }: { title: string; count: number; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 9, padding: "9px 9px 6px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <h2 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 14, fontWeight: 600, color: t.text }}>{title}</h2>
        <span style={{ fontFamily: DM_MONO, fontSize: 12, color: t.text2 }}>{count}</span>
      </div>
      {right}
    </div>
  );
}

/** A drag that carries text is a session. Anything else (a file, a link) is not ours to answer. */
const carriesText = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("text/plain");

/** The drop target's state and handlers, shared by the start row and every draft row. */
function useDropTarget(onDropSession: (sessionId: string) => void) {
  const [over, setOver] = useState(false);
  return {
    over,
    handlers: {
      onDragEnter: (event: DragEvent) => {
        if (!carriesText(event)) return;
        event.preventDefault();
        setOver(true);
      },
      onDragOver: (event: DragEvent) => {
        if (!carriesText(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setOver(true);
      },
      onDragLeave: (event: DragEvent) => {
        // Moving onto a child of the row is not leaving it.
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setOver(false);
      },
      onDrop: (event: DragEvent) => {
        if (!carriesText(event)) return;
        event.preventDefault();
        setOver(false);
        const id = event.dataTransfer.getData("text/plain");
        if (id) onDropSession(id);
      },
    },
  };
}

/* ── Continue editing ── */

function StartRow({ phone, onDropSession }: { phone: boolean; onDropSession: (id: string) => void }) {
  const { over, handlers } = useDropTarget(onDropSession);
  const { state, handlers: focus } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to="/compose/new"
      data-testid="start-row"
      data-over={over ? "true" : undefined}
      {...handlers}
      {...focus}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        minHeight: 46,
        padding: "0 10px",
        marginBottom: 4,
        borderRadius: r.control,
        border: `1.5px dashed ${over ? t.evidence : t.line}`,
        background: over ? t.rowHighlight : "transparent",
        textDecoration: "none",
        color: t.text,
        boxSizing: "border-box",
        ...ring(state.focusVisible),
      }}
    >
      <Plus size={16} strokeWidth={1.8} aria-hidden="true" style={{ flexShrink: 0 }} />
      <span style={{ fontFamily: FIGTREE, fontSize: 14, fontWeight: 600 }}>Start a new build</span>
      <span style={{ marginLeft: "auto", fontFamily: FIGTREE, fontSize: 12, color: t.text2, textAlign: "right" }}>
        {over ? "Drop to start a build from it" : phone ? null : "or drop a session here"}
      </span>
    </Link>
  );
}

function DraftRow({
  draft,
  now,
  phone,
  onDropSession,
}: {
  draft: DraftListItem;
  now: number;
  phone: boolean;
  onDropSession: (sessionId: string, draft: DraftListItem) => void;
}) {
  const { over, handlers } = useDropTarget((id) => onDropSession(id, draft));
  const { state, handlers: focus } = useInteractive<HTMLAnchorElement>();
  const untitled = isUntitled(draft.title);
  return (
    <li style={{ listStyle: "none" }}>
      <Link
        to={`/compose/${draft.id}`}
        data-testid="draft-row"
        data-over={over ? "true" : undefined}
        {...handlers}
        {...focus}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          minHeight: phone ? 46 : 52,
          padding: "7px 10px",
          borderRadius: r.control,
          border: over ? `1.5px dashed ${t.evidence}` : "1.5px solid transparent",
          background: over || state.hovered ? t.rowHighlight : "transparent",
          textDecoration: "none",
          boxSizing: "border-box",
          ...ring(state.focusVisible),
        }}
      >
        <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flexGrow: 1 }}>
          <span
            data-testid="draft-title"
            style={{
              fontFamily: FIGTREE,
              fontSize: 15,
              fontWeight: 600,
              color: untitled ? t.text2 : t.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {draftTitle(draft.title)}
          </span>
          <span style={{ fontFamily: DM_MONO, fontSize: 12, color: t.text2 }}>
            {over ? "Drop to add this session" : draftMeta(draft, now)}
          </span>
        </span>
        <ChevronRight size={16} strokeWidth={1.6} color="var(--text2)" aria-hidden="true" style={{ flexShrink: 0 }} />
      </Link>
    </li>
  );
}

/* ── Sessions ── */

const menuContent: CSSProperties = {
  minWidth: 220,
  maxWidth: 340,
  padding: 4,
  borderRadius: r.panel,
  background: t.solid,
  border: `1px solid ${t.line}`,
  boxShadow: t.shadowFloat,
  color: t.text,
  zIndex: 50,
};

const menuItem: CSSProperties = {
  display: "flex",
  alignItems: "center",
  minHeight: 31,
  padding: "0 9px",
  borderRadius: 10,
  fontFamily: FIGTREE,
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  textDecoration: "none",
  outline: "none",
};

/** The + control: a dropdown on desktop, a bottom sheet on a phone. */
function AddMenu({
  session,
  items,
  phone,
  visible,
  onPick,
}: {
  session: SessionSummary;
  items: MenuItem[];
  phone: boolean;
  /** Full opacity: the row is hovered or has focus. */
  visible: boolean;
  onPick: (item: MenuItem) => void;
}) {
  const [sheet, setSheet] = useState(false);
  const label = items[0]?.kind === "open" ? `Open ${attachedLabelOf(items[0])}` : addLabel(session);
  const sheetRow: CSSProperties = {
    display: "flex",
    alignItems: "center",
    /* 48 before UI-P58: the table's 39, held at 44 on a phone (this sheet is phone-only), the touch target. */
    minHeight: 44,
    padding: "0 4px",
    width: "100%",
    border: 0,
    background: "transparent",
    textAlign: "left",
    fontFamily: FIGTREE,
    fontSize: 14,
    fontWeight: 500,
    color: t.text,
    textDecoration: "none",
    cursor: "pointer",
  };

  if (phone) {
    return (
      <>
        <span style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <IconButton icon={Plus} label={label} size={38} onClick={() => setSheet(true)} />
        </span>
        <BottomSheet open={sheet} onOpenChange={setSheet} title="Add to a build">
          {items.map((item) => {
            const style = { ...sheetRow, color: t.text };
            return item.kind === "open" ? (
              <Link key={item.key} to={`/compose/${item.buildId}`} style={style} onClick={() => setSheet(false)}>
                {item.label}
              </Link>
            ) : (
              <button
                key={item.key}
                type="button"
                style={style}
                onClick={() => {
                  setSheet(false);
                  onPick(item);
                }}
              >
                {item.label}
              </button>
            );
          })}
        </BottomSheet>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          icon={Plus}
          label={label}
          size={34}
          style={{ opacity: visible ? 1 : 0.75 }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} style={menuContent}>
        {items.map((item) => {
          if (item.kind === "open") {
            return (
              <DropdownMenuItem key={item.key} asChild className={MENU_ITEM_CLASS} style={menuItem}>
                <Link to={`/compose/${item.buildId}`}>{item.label}</Link>
              </DropdownMenuItem>
            );
          }
          return (
            <DropdownMenuItem key={item.key} className={MENU_ITEM_CLASS} style={menuItem} onSelect={() => onPick(item)}>
              {item.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** "Open {title}" → "{title}", for the + button's accessible name. */
const attachedLabelOf = (item: MenuItem) => item.label.replace(/^Open /, "");

function SessionRow({
  session,
  meta,
  items,
  phone,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
  onPick,
}: {
  session: SessionSummary;
  meta: string;
  items: MenuItem[];
  phone: boolean;
  draggable: boolean;
  dragging: boolean;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
  onPick: (item: MenuItem) => void;
}) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  return (
    <li
      data-testid="session-row"
      draggable={draggable || undefined}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        listStyle: "none",
        display: "flex",
        alignItems: "center",
        gap: 7,
        minHeight: phone ? 46 : 43,
        padding: phone ? "4px 4px 4px 10px" : "4px 4px 4px 7px",
        borderRadius: r.control,
        background: hover ? t.rowHighlight : "transparent",
        cursor: draggable ? "grab" : "default",
        /* A dragged row is dimmed with the filter under the refined look, never with opacity; its rows are hairline-separated. */
        ...{ filter: dragging ? "var(--dim-filter)" : undefined, borderBottom: `1px solid ${t.hairline}`, borderRadius: 0 },
        boxSizing: "border-box",
      }}
    >
      {draggable ? <GripVertical size={14} strokeWidth={1.6} color="var(--text2)" aria-hidden="true" style={{ flexShrink: 0 }} /> : null}
      <span style={{ display: "inline-flex", flexShrink: 0, color: t.text }}>
        <ModelMark tool={session.modelName ? null : session.client} model={session.modelName} size={18} />
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flexGrow: 1 }}>
        <span
          style={{
            fontFamily: FIGTREE,
            fontSize: 13,
            color: t.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {promptLine(session)}
        </span>
        <span style={{ fontFamily: DM_MONO, fontSize: 11, color: t.text2 }}>{meta}</span>
      </span>
      <AddMenu session={session} items={items} phone={phone} visible={hover || focus} onPick={onPick} />
    </li>
  );
}

/* ── the page ── */

const rows: CSSProperties = { margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 };

/** CA-10: the sessions skeleton's rows, as a typical list draws them. */
const SESSION_SKELETON_ROWS = 5;
const SESSION_ROW = 43;
const SESSION_ROW_PHONE = 46;

function RowSkeletons({ count, height, what }: { count: number; height: number; what: string }) {
  return (
    <LoadingRegion what={what} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} height={height} radius={12} />
      ))}
    </LoadingRegion>
  );
}

export function DraftsView({
  now,
  draftsStatus,
  onRetryDrafts,
  draftsError,
  sessionsStatus,
  onRetrySessions,
  sessionsError,
  sessionsAnchor,
  drafts,
  sessions,
  moreSessions,
  onAddToNew,
  onAddToDraft,
  onConnect,
  emptyDrafts,
}: DraftsViewProps) {
  const phone = useIsPhone();
  const [confirmingEmpty, setConfirmingEmpty] = useState(false);
  const fine = useFinePointer();
  const canDrag = !phone && fine;
  const [dragging, setDragging] = useState<string | null>(null);
  const loading = draftsStatus === "loading";
  const failed = draftsStatus === "error";
  const sessionsLoading = sessionsStatus === "loading";
  const sessionsFailed = sessionsStatus === "error";

  const pick = (session: SessionSummary) => (item: MenuItem) => {
    if (item.kind === "target" || item.kind === "draft") {
      const draft = drafts.find((d) => d.id === item.buildId);
      if (draft) onAddToDraft(session.id, draft);
    } else if (item.kind === "new") onAddToNew(session.id);
  };

  const dragStart = (session: SessionSummary) => (event: DragEvent) => {
    event.dataTransfer.setData("text/plain", session.id);
    event.dataTransfer.effectAllowed = "copy";
    setDragging(session.id);
  };

  const heading = (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <h1 style={{ ...display(phone ? 32 : 44, { mobilePageHeading: phone }), margin: 0, color: t.text }}>Drafts</h1>
      {phone ? null : (
        <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 14, color: t.text2 }}>
          Pick up a build, or start one from a session.
        </p>
      )}
    </div>
  );

  const continuePanel = (
    <Panel surface="plain" padding="8px" style={{ minWidth: 0 }}>
      <ListHead title="Continue editing" count={failed || loading ? 0 : drafts.length} />
      <StartRow phone={phone} onDropSession={onAddToNew} />
      {loading ? (
        <RowSkeletons count={3} height={phone ? 46 : 52} what="your drafts" />
      ) : failed ? (
        <div style={{ padding: "6px 9px 9px" }}>
          <ErrorState panel="Continue editing" onRetry={onRetryDrafts} error={draftsError} log="[Drafts] drafts read failed" showCode />
        </div>
      ) : drafts.length === 0 ? (
        /* UI-P97: under refined, the empty line is the 13 `--text` line; the start row above it is the one action. */
        <EmptyState line="Nothing in progress." />
      ) : (
        <ul style={rows}>
          {drafts.map((draft) => (
            <DraftRow key={draft.id} draft={draft} now={now} phone={phone} onDropSession={onAddToDraft} />
          ))}
        </ul>
      )}
    </Panel>
  );

  const sessionsPanel = (
    <Panel surface="plain" padding="8px" style={{ minWidth: 0 }}>
      {/* Out of the flow and over the whole panel, so it adds no space and the page can tell when any of it shows. */}
      <span ref={sessionsAnchor} aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
      <ListHead
        title="Sessions"
        count={sessionsFailed || sessionsLoading ? 0 : sessions.length}
        right={phone ? undefined : <TextButton onClick={onConnect}>How they get here</TextButton>}
      />
      {sessionsLoading ? (
        /* CA-10 (CA-09 F15, CLS 0.305 on a phone): the height of a typical list, its rows and the "Show N" line. */
        <RowSkeletons count={SESSION_SKELETON_ROWS} height={phone ? SESSION_ROW_PHONE : SESSION_ROW} what="your sessions" />
      ) : sessionsFailed ? (
        <div style={{ padding: "6px 9px 9px" }}>
          <ErrorState panel="Sessions" onRetry={onRetrySessions} error={sessionsError} log="[Drafts] sessions read failed" showCode />
        </div>
      ) : (
        <>
          {sessions.length === 0 ? (
            <EmptyState line="No new sessions." action={{ label: "Connect a tool", onClick: onConnect }} />
          ) : (
            <ul style={rows}>
              {sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  meta={sessionMeta(session, drafts, now)}
                  items={menuItems(session, drafts)}
                  phone={phone}
                  draggable={canDrag}
                  dragging={dragging === session.id}
                  onDragStart={dragStart(session)}
                  onDragEnd={() => setDragging(null)}
                  onPick={pick(session)}
                />
              ))}
            </ul>
          )}
          {moreSessions ? (
            <TextButton onClick={moreSessions.onMore} disabled={moreSessions.loading} style={{ margin: "4px 9px 6px", display: "block" }}>
              {moreSessions.loading ? "Loading…" : "Show more sessions"}
            </TextButton>
          ) : null}
        </>
      )}
    </Panel>
  );

  const older = (
    <Link
      to="/drafts/posts"
      data-hit=""
      style={{ alignSelf: "flex-start", fontFamily: FIGTREE, fontSize: 12, color: t.text2, textDecoration: "underline" }}
    >
      Older post drafts
    </Link>
  );

  const removeEmpty =
    emptyDrafts && emptyDrafts.count > 0 ? (
      <>
        <TextButton onClick={() => setConfirmingEmpty(true)} style={{ alignSelf: "flex-start" }}>
          {`Remove empty drafts (${emptyDrafts.count})`}
        </TextButton>
        <ConfirmDialog
          open={confirmingEmpty}
          title={`Remove ${emptyDrafts.count} empty ${emptyDrafts.count === 1 ? "draft" : "drafts"}?`}
          body="They have no title, no sessions, no parts, no files and no post. This can't be undone."
          action="Remove"
          onCancel={() => setConfirmingEmpty(false)}
          onConfirm={() => {
            setConfirmingEmpty(false);
            emptyDrafts.onRemove();
          }}
        />
      </>
    ) : null;

  if (phone) {
    return (
      <div data-testid="drafts-view" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {heading}
        {continuePanel}
        {sessionsPanel}
        <Button variant="secondary" size={48} fontSize={15} fullWidth onClick={onConnect}>
          Connect a tool
        </Button>
        {older}
        {removeEmpty}
      </div>
    );
  }

  return (
    <div data-testid="drafts-view" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        {heading}
        <Button variant="secondary" size={42} fontSize={14} onClick={onConnect}>
          Connect a tool
        </Button>
      </div>
      <div
        style={{
          marginTop: 17,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 1fr)",
          gap: 17,
          alignItems: "start",
        }}
      >
        {continuePanel}
        {sessionsPanel}
      </div>
      <div style={{ marginTop: 17, display: "flex", flexDirection: "column", gap: 8 }}>
        {older}
        {removeEmpty}
      </div>
    </div>
  );
}

export default DraftsView;
