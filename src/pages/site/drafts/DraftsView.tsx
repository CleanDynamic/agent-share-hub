/* UI-P46, SV-08 — Drafts: the builds in progress, and the sessions waiting to join one.

   PURE. Props in, markup out: no fetching, no `useAuth()`, no router hooks but
   links. `DraftsPage` supplies the data and the writes; the dev compare page
   supplies the sample data. The viewport is read here (768px) so both behave the
   same.

   SV-08: the board is `design/reference/vision/dusk/drafts.html`. Sections sit on the
   surface with no box: Continue editing (the creator's drafts, last edited first, a
   dashed "Start a new build" slot first, twelve rows and "Show n more") beside Sessions
   (the conversations their AI tools sent, 56 high, one line of detail), and under the
   sessions the page's one boxed tile, Connected tools. A session joins a draft by being
   dragged onto it, or with its + menu; both end in the same `onAddToDraft` /
   `onAddToNew`. Dragging is a mouse's job: below 768px, and on any pointer that is not
   fine, rows are not draggable and the + menu is the way (a bottom sheet on the phone,
   a dropdown on desktop).

   NOTHING HERE READS content_items OR content_blocks. The older post drafts are
   a link to /drafts/posts.

   THE DRAG DATA is the session id as `text/plain`, effect `copy`. A drop target
   only answers a drag that carries text, so dragging a file or a link over it
   does nothing. The pointer is never held in state while a drag runs: the row that
   is being dragged is the one piece of state, set once at the start. */

import { useState, type CSSProperties, type DragEvent, type Ref } from "react";
import { Plus } from "lucide-react";
import { PageLink as Link } from "@/lib/routing/PageLink";

import { IntentLink } from "@/lib/routing/IntentLink";

import { EmptyState } from "@/components/brand/EmptyState";
import { ErrorState } from "@/components/brand/ErrorState";
import { Glyph } from "@/components/brand/Glyph";
import { IconButton } from "@/components/brand/IconButton";
import { ModelMark } from "@/components/brand/ModelMark";
import { InnerTile } from "@/components/vision/InnerTile";
import { SectionHead } from "@/components/vision/SectionHead";

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
import { TOUCH_MIN } from "@/lib/theme/density";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import {
  ControlButton,
  DraftsLayout,
  ListSection,
  OlderDrafts,
  ROW,
  RowSkeletons,
  SESSION_SKELETON_ROWS,
  StartRow,
  TextButton,
  useDropTarget,
} from "./DraftsFrame";
import {
  DRAFTS_SHOWN,
  addLabel,
  connectedTools,
  draftEdited,
  draftSessions,
  draftTitle,
  draftsMeta,
  isUntitled,
  menuItems,
  promptLine,
  sessionMeta,
  sessionsMeta,
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

/* ── Continue editing ── */

function DraftRow({
  draft,
  now,
  onDropSession,
}: {
  draft: DraftListItem;
  now: number;
  onDropSession: (sessionId: string, draft: DraftListItem) => void;
}) {
  const { over, handlers } = useDropTarget((id) => onDropSession(id, draft));
  const { state, handlers: focus } = useInteractive<HTMLAnchorElement>();
  const untitled = isUntitled(draft.title);
  return (
    <li style={{ listStyle: "none" }}>
      <IntentLink
        to={`/compose/${draft.id}`}
        data-testid="draft-row"
        data-over={over ? "true" : undefined}
        {...handlers}
        {...focus}
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto 16px",
          columnGap: 16,
          alignItems: "center",
          minHeight: ROW,
          borderBottom: `1px solid ${over ? t.evidence : t.hairline}`,
          background: over || state.hovered ? t.rowHighlight : "transparent",
          textDecoration: "none",
          color: t.text,
          boxSizing: "border-box",
          ...ring(state.focusVisible),
        }}
      >
        <span style={{ minWidth: 0 }}>
          <span
            data-testid="draft-title"
            style={{
              display: "block",
              fontWeight: 500,
              color: untitled ? t.text2 : t.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {draftTitle(draft.title)}
          </span>
          <span style={{ display: "block", fontSize: 12, color: t.label }}>{over ? "Drop to add this session" : draftSessions(draft)}</span>
        </span>
        <span style={{ fontSize: 12, color: t.label, whiteSpace: "nowrap" }}>{draftEdited(draft, now)}</span>
        <span aria-hidden="true" style={{ display: "inline-flex", color: t.label }}>
          <Glyph name="chev" size={16} />
        </span>
      </IntentLink>
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

/** What the + is called: it opens the ways to start a build from, or add, this session. */
const ADD_NAME = "Start a build from this session";

/** The 28px + keeps its look; on a phone its hit area reaches 44 through padding with a matching negative margin. */
const hitArea = (phone: boolean): CSSProperties => ({
  display: "flex",
  flexShrink: 0,
  padding: phone ? (TOUCH_MIN - 28) / 2 : 0,
  margin: phone ? (28 - TOUCH_MIN) / 2 : 0,
});

/** The + control: a dropdown on desktop, a bottom sheet on a phone. */
function AddMenu({
  session,
  items,
  phone,
  onPick,
}: {
  session: SessionSummary;
  items: MenuItem[];
  phone: boolean;
  onPick: (item: MenuItem) => void;
}) {
  const [sheet, setSheet] = useState(false);
  const sheetRow: CSSProperties = {
    display: "flex",
    alignItems: "center",
    /* The table's 39, held at 44 on a phone (this sheet is phone-only), the touch target. */
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
        <span style={hitArea(true)}>
          <IconButton icon={Plus} label={ADD_NAME} size={28} onClick={() => setSheet(true)} />
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
        <IconButton icon={Plus} label={ADD_NAME} size={28} />
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
  return (
    <li
      data-testid="session-row"
      draggable={draggable || undefined}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      style={{
        listStyle: "none",
        display: "grid",
        gridTemplateColumns: draggable ? "12px 18px minmax(0, 1fr) 28px" : "18px minmax(0, 1fr) 28px",
        columnGap: 10,
        alignItems: "center",
        minHeight: ROW,
        borderBottom: `1px solid ${t.hairline}`,
        cursor: draggable ? "grab" : "default",
        /* A dragged row is dimmed with the filter under the refined look, never with opacity. */
        filter: dragging ? "var(--dim-filter)" : undefined,
        boxSizing: "border-box",
      }}
    >
      {draggable ? (
        <span aria-hidden="true" style={{ display: "grid", placeItems: "center", color: t.line }}>
          <Glyph name="grip" size={12} />
        </span>
      ) : null}
      <span style={{ display: "inline-flex", color: t.text }}>
        <ModelMark tool={session.modelName ? null : session.client} model={session.modelName} size={18} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{promptLine(session)}</span>
        <span style={{ display: "block", fontSize: 12, color: t.label, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta}</span>
      </span>
      <AddMenu session={session} items={items} phone={phone} onPick={onPick} />
    </li>
  );
}

/* ── Connected tools ── */

function ConnectedTools({ tools, onManage }: { tools: ReturnType<typeof connectedTools>; onManage: () => void }) {
  return (
    <InnerTile style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5 }}>
        <h3 style={{ margin: 0, fontSize: 12.5, fontWeight: 500, lineHeight: "normal" }}>Connected tools</h3>
        <TextButton onClick={onManage} style={{ fontSize: 12.5, lineHeight: "normal", textDecoration: "none" }}>
          Manage
        </TextButton>
      </div>
      <ul style={{ margin: "10px 0 0", padding: 0 }}>
        {tools.map((tool) => (
          <li key={tool.client} style={{ listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 32 }}>
            <span style={{ color: t.text2 }}>{tool.name}</span>
            <span style={{ fontSize: 12, color: t.label }}>{`last import ${tool.lastImport}`}</span>
          </li>
        ))}
      </ul>
    </InnerTile>
  );
}

/* ── the page ── */

const list: CSSProperties = { margin: 0, padding: 0 };

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
  const [showAll, setShowAll] = useState(false);
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

  const shown = showAll ? drafts : drafts.slice(0, DRAFTS_SHOWN);
  const hidden = drafts.length - shown.length;

  const continueSection = (
    <ListSection
      label="Continue editing"
      head={<SectionHead title="Continue editing" meta={failed || loading ? "\u00a0" : draftsMeta(drafts.length)} headingLevel={2} />}
    >
      <StartRow phone={phone} onDropSession={onAddToNew} />
      {loading ? (
        <div style={{ marginTop: 8 }}>
          <RowSkeletons count={6} what="your drafts" />
        </div>
      ) : failed ? (
        <div style={{ padding: "16px 0" }}>
          <ErrorState panel="Continue editing" onRetry={onRetryDrafts} error={draftsError} log="[Drafts] drafts read failed" showCode />
        </div>
      ) : drafts.length === 0 ? (
        <EmptyState line="Nothing in progress." />
      ) : (
        <>
          <ul style={{ ...list, marginTop: 8 }}>
            {shown.map((draft) => (
              <DraftRow key={draft.id} draft={draft} now={now} onDropSession={onAddToDraft} />
            ))}
          </ul>
          {hidden > 0 ? (
            <div style={{ marginTop: 16 }}>
              <ControlButton onClick={() => setShowAll(true)}>{`Show ${hidden} more`}</ControlButton>
            </div>
          ) : null}
        </>
      )}
      {emptyDrafts && emptyDrafts.count > 0 ? (
        <div style={{ minHeight: ROW, display: "flex", alignItems: "center" }}>
          <TextButton onClick={() => setConfirmingEmpty(true)}>{`Remove empty drafts (${emptyDrafts.count})`}</TextButton>
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
        </div>
      ) : null}
    </ListSection>
  );

  const sessionsSection = (
    <ListSection
      label="Sessions"
      head={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          {/* Out of the flow and over the whole section, so it adds no space and the page can tell when any of it shows. */}
          <span ref={sessionsAnchor} aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
          <SectionHead title="Sessions" meta={sessionsFailed || sessionsLoading ? "\u00a0" : sessionsMeta(sessions.length, canDrag)} headingLevel={2} />
          <TextButton onClick={onConnect}>How they get here</TextButton>
        </div>
      }
    >
      {sessionsLoading ? (
        /* CA-10 (CA-09 F15, CLS 0.305 on a phone): the height of a typical list. */
        <div style={{ marginTop: 16, borderTop: `1px solid ${t.hairline}` }}>
          <RowSkeletons count={SESSION_SKELETON_ROWS} what="your sessions" />
        </div>
      ) : sessionsFailed ? (
        <div style={{ padding: "16px 0" }}>
          <ErrorState panel="Sessions" onRetry={onRetrySessions} error={sessionsError} log="[Drafts] sessions read failed" showCode />
        </div>
      ) : (
        <>
          {sessions.length === 0 ? (
            <EmptyState line="No new sessions." action={{ label: "Connect a tool", onClick: onConnect }} />
          ) : (
            <ul style={{ ...list, marginTop: 16, borderTop: `1px solid ${t.hairline}` }}>
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
            <div style={{ marginTop: 16 }}>
              <ControlButton onClick={moreSessions.onMore} disabled={moreSessions.loading}>
                {moreSessions.loading ? "Loading…" : "Show more sessions"}
              </ControlButton>
            </div>
          ) : null}
        </>
      )}
    </ListSection>
  );

  const tools = sessionsFailed || sessionsLoading ? [] : connectedTools(sessions, now);

  return (
    <DraftsLayout
      onConnect={onConnect}
      continueSection={continueSection}
      sessionsSection={sessionsSection}
      connectedTools={tools.length > 0 ? <ConnectedTools tools={tools} onManage={onConnect} /> : null}
      after={<OlderDrafts />}
    />
  );
}

export default DraftsView;
