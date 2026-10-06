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
   does nothing. */

import { useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { ChevronRight, GripVertical, Plus } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/brand/Button";
import { ErrorState } from "@/components/brand/ErrorState";
import { IconButton } from "@/components/brand/IconButton";
import { Panel } from "@/components/brand/Panel";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { useFinePointer, useIsPhone } from "@/components/shell/useMinWidth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  attachedMenuItems,
  attachedTitle,
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
  status: DraftsStatus;
  onRetry: () => void;
  drafts: readonly DraftListItem[];
  /** Sessions not in a build, newest first. */
  sessions: readonly SessionSummary[];
  /** Sessions already in a build, newest first. */
  attached: readonly SessionSummary[];
  showAttached: boolean;
  onToggleAttached: () => void;
  /** A session dropped on the start row, or "Start a new build" in its menu. */
  onAddToNew: (sessionId: string) => void;
  /** A session dropped on a draft, or "Add to …" in its menu. */
  onAddToDraft: (sessionId: string, draft: Pick<DraftListItem, "id" | "title">) => void;
  /** Confirmed in the alert dialog. */
  onRemove: (sessionId: string) => void;
  /** "Connect a tool" and "How they get here" open the connector dialog. */
  onConnect: () => void;
}

/* ── shared pieces ── */

const underlined: CSSProperties = {
  fontFamily: FIGTREE,
  fontSize: 13,
  color: t.text2,
  textDecoration: "underline",
  background: "transparent",
  border: 0,
  padding: 0,
  cursor: "pointer",
};

function TextButton({ onClick, style, children }: { onClick: () => void; style?: CSSProperties; children: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button type="button" onClick={onClick} {...handlers} style={{ ...underlined, borderRadius: 6, ...ring(state.focusVisible), ...style }}>
      {children}
    </button>
  );
}

function ListHead({ title, count, right }: { title: string; count: number; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "12px 12px 8px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <h2 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 15, fontWeight: 600, color: t.text }}>{title}</h2>
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
        gap: 12,
        minHeight: 56,
        padding: "0 14px",
        marginBottom: 6,
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
      <span style={{ fontFamily: FIGTREE, fontSize: 15, fontWeight: 600 }}>Start a new build</span>
      <span style={{ marginLeft: "auto", fontFamily: FIGTREE, fontSize: 13, color: t.text2, textAlign: "right" }}>
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
          gap: 12,
          minHeight: phone ? 56 : 64,
          padding: "10px 14px",
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
              fontSize: 16,
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
  padding: 6,
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
  minHeight: 38,
  padding: "0 12px",
  borderRadius: 10,
  fontFamily: FIGTREE,
  fontSize: 14,
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
    minHeight: 48,
    padding: "0 4px",
    width: "100%",
    border: 0,
    background: "transparent",
    textAlign: "left",
    fontFamily: FIGTREE,
    fontSize: 15,
    fontWeight: 500,
    color: t.text,
    textDecoration: "none",
    cursor: "pointer",
  };

  if (phone) {
    return (
      <>
        <span style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <IconButton icon={Plus} label={label} size={38} onClick={() => setSheet(true)} />
        </span>
        <BottomSheet open={sheet} onOpenChange={setSheet} title="Add to a build">
          {items.map((item) => {
            const danger = item.kind === "remove";
            const style = { ...sheetRow, color: danger ? t.catBreakage : t.text };
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
          if (item.kind === "remove") {
            return (
              <span key={item.key}>
                <DropdownMenuSeparator style={{ height: 1, margin: "4px 6px", background: t.line }} />
                <DropdownMenuItem className={MENU_ITEM_CLASS} style={{ ...menuItem, color: t.catBreakage }} onSelect={() => onPick(item)}>
                  {item.label}
                </DropdownMenuItem>
              </span>
            );
          }
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
  attached,
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
  attached: boolean;
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
      data-testid={attached ? "session-row-attached" : "session-row"}
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
        gap: 10,
        minHeight: phone ? 56 : 52,
        padding: phone ? "6px 6px 6px 14px" : "6px 6px 6px 10px",
        borderRadius: r.control,
        background: hover ? t.rowHighlight : "transparent",
        cursor: draggable ? "grab" : "default",
        opacity: dragging ? 0.5 : 1,
        boxSizing: "border-box",
      }}
    >
      {draggable ? <GripVertical size={14} strokeWidth={1.6} color="var(--text2)" aria-hidden="true" style={{ flexShrink: 0 }} /> : null}
      <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flexGrow: 1 }}>
        <span
          style={{
            fontFamily: FIGTREE,
            fontSize: 14,
            color: attached ? t.text2 : t.text,
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

function RemoveDialog({ session, onCancel, onConfirm }: { session: SessionSummary | null; onCancel: () => void; onConfirm: (id: string) => void }) {
  return (
    <AlertDialog.Root open={session !== null} onOpenChange={(open) => (open ? undefined : onCancel())}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay style={{ position: "fixed", inset: 0, background: t.sheetDim, zIndex: 60 }} />
        <AlertDialog.Content
          style={{
            position: "fixed",
            zIndex: 61,
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(420px, calc(100vw - 32px))",
            boxSizing: "border-box",
            padding: 24,
            borderRadius: r.panel,
            background: t.solid,
            border: `1px solid ${t.line}`,
            boxShadow: t.shadowFloat,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <AlertDialog.Title style={{ margin: 0, fontFamily: FIGTREE, fontSize: 17, fontWeight: 600, color: t.text }}>
              Remove this session?
            </AlertDialog.Title>
            <AlertDialog.Description style={{ margin: 0, fontFamily: FIGTREE, fontSize: 14, color: t.text2 }}>
              It disappears from Drafts. This can&apos;t be undone.
            </AlertDialog.Description>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" size={38} fontSize={13}>Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant="primary" size={38} fontSize={13} onClick={() => session && onConfirm(session.id)}>Remove</Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/* ── the page ── */

const rows: CSSProperties = { margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 };

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
  status,
  onRetry,
  drafts,
  sessions,
  attached,
  showAttached,
  onToggleAttached,
  onAddToNew,
  onAddToDraft,
  onRemove,
  onConnect,
}: DraftsViewProps) {
  const phone = useIsPhone();
  const fine = useFinePointer();
  const canDrag = !phone && fine;
  const [dragging, setDragging] = useState<string | null>(null);
  const [removing, setRemoving] = useState<SessionSummary | null>(null);
  const loading = status === "loading";
  const failed = status === "error";

  const pick = (session: SessionSummary) => (item: MenuItem) => {
    if (item.kind === "target" || item.kind === "draft") {
      const draft = drafts.find((d) => d.id === item.buildId);
      if (draft) onAddToDraft(session.id, draft);
    } else if (item.kind === "new") onAddToNew(session.id);
    else if (item.kind === "remove") setRemoving(session);
  };

  const dragStart = (session: SessionSummary) => (event: DragEvent) => {
    event.dataTransfer.setData("text/plain", session.id);
    event.dataTransfer.effectAllowed = "copy";
    setDragging(session.id);
  };

  const heading = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <h1 style={{ ...display(phone ? 32 : 44, { mobilePageHeading: phone }), margin: 0, color: t.text }}>Drafts</h1>
      {phone ? null : (
        <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 15, color: t.text2 }}>
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
        <RowSkeletons count={3} height={phone ? 56 : 64} what="your drafts" />
      ) : failed ? (
        <div style={{ padding: "8px 12px 12px" }}>
          <ErrorState panel="Continue editing" onRetry={onRetry} />
        </div>
      ) : drafts.length === 0 ? (
        <p style={{ ...display(22), margin: 0, padding: "20px 12px 24px", color: t.text }}>Nothing in progress.</p>
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
      <ListHead
        title="Sessions"
        count={failed || loading ? 0 : sessions.length}
        right={phone ? undefined : <TextButton onClick={onConnect}>How they get here</TextButton>}
      />
      {loading ? (
        <RowSkeletons count={4} height={phone ? 56 : 52} what="your sessions" />
      ) : failed ? (
        <div style={{ padding: "8px 12px 12px" }}>
          <ErrorState panel="Sessions" onRetry={onRetry} />
        </div>
      ) : (
        <>
          {sessions.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, padding: "20px 12px 24px" }}>
              <p style={{ ...display(22), margin: 0, color: t.text }}>No new sessions.</p>
              <TextButton onClick={onConnect}>Connect a tool</TextButton>
            </div>
          ) : (
            <ul style={rows}>
              {sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  meta={sessionMeta(session, drafts, now)}
                  items={menuItems(session, drafts)}
                  attached={false}
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
          {attached.length > 0 ? (
            <>
              <TextButton onClick={onToggleAttached} style={{ margin: "6px 12px 8px", display: "block" }}>
                {showAttached ? "Hide sessions already in a build" : `Show ${attached.length} already in a build`}
              </TextButton>
              {showAttached ? (
                <ul style={rows}>
                  {attached.map((session) => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      meta={`In ${attachedTitle(session, drafts)}`}
                      items={attachedMenuItems(session, drafts)}
                      attached
                      phone={phone}
                      draggable={false}
                      dragging={false}
                      onDragStart={() => undefined}
                      onDragEnd={() => undefined}
                      onPick={() => undefined}
                    />
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </Panel>
  );

  const older = (
    <Link
      to="/drafts/posts"
      style={{ alignSelf: "flex-start", fontFamily: FIGTREE, fontSize: 13, color: t.text2, textDecoration: "underline" }}
    >
      Older post drafts
    </Link>
  );

  if (phone) {
    return (
      <div data-testid="drafts-view" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {heading}
        {continuePanel}
        {sessionsPanel}
        <Button variant="secondary" size={48} fontSize={15} fullWidth onClick={onConnect}>
          Connect a tool
        </Button>
        {older}
        <RemoveDialog session={removing} onCancel={() => setRemoving(null)} onConfirm={(id) => { setRemoving(null); onRemove(id); }} />
      </div>
    );
  }

  return (
    <div data-testid="drafts-view" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        {heading}
        <Button variant="secondary" size={42} fontSize={14} onClick={onConnect}>
          Connect a tool
        </Button>
      </div>
      <div
        style={{
          marginTop: 24,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 1fr)",
          gap: 24,
          alignItems: "start",
        }}
      >
        {continuePanel}
        {sessionsPanel}
      </div>
      <div style={{ marginTop: 24, display: "flex" }}>{older}</div>
      <RemoveDialog session={removing} onCancel={() => setRemoving(null)} onConfirm={(id) => { setRemoving(null); onRemove(id); }} />
    </div>
  );
}

export default DraftsView;
