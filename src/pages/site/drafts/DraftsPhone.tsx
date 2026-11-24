/* The Drafts page on a phone (mobile prompt 25, Part A): below 768 only. The top bar (back, the fact as its title, New build) is
   the frame's; this is the page under it, on the Page shade with no panels: the order as tabs, the filters as pills, draft rows,
   then "8 sessions" and "2 connections" as sections. Everything it does goes through DraftsView's own props, so the reads, the
   writes and their toasts are the desktop's.

   A phone cannot drag a session onto a draft, so each session's plus opens a sheet that lists the drafts ("New build" first).
   The sheet's rows are the same `menuItems` the desktop's menu uses, and end in the same `onAddToNew` / `onAddToDraft`. */

import { useState, type CSSProperties } from "react";

import { MobileIcon } from "@/components/brand/MobileIcon";
import { PageFailed, PageState } from "@/components/pagestate/PageState";
import { allFailed, shownState } from "@/components/pagestate/pageStateModel";
import { useSessionPhase } from "@/components/pagestate/useSessionPhase";
import { PhoneBottomSheet } from "@/components/phone/BottomSheet";
import { PhonePills } from "@/components/phone/PhonePills";
import { PhoneRow } from "@/components/phone/PhoneRow";
import { PhoneTabs } from "@/components/phone/PhoneTabs";
import { SectionFact } from "@/components/phone/SectionFact";
import { PHONE_MARGIN } from "@/components/shell/chromeSize";
import { useColumnPanels } from "@/components/shell/frameChrome";
import { useRegisterPageBar } from "@/components/shell/phoneBarRegistry";
import { ring } from "@/lib/theme/controls";
import { TOUCH_MIN } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";
import { shortAgo } from "@/pages/site/home/homeModel";
import type { DraftListItem } from "@/lib/build/drafts";
import type { SessionSummary } from "@/lib/build/sessions";

import type { DraftsViewProps } from "./DraftsView";

/** The confirm window is DraftsView's (the one import this folder keeps from the composer); the phone page is handed it. */
export type ConfirmDialogComponent = (props: { open: boolean; title: string; body: string; action: string; onCancel: () => void; onConfirm: () => void }) => React.ReactNode;
import { RowSkeletons, SESSION_ROW, SESSION_SKELETON_ROWS } from "./DraftsFrame";
import {
  DRAFTS_SHOWN,
  SESSIONS_SHOWN,
  connectedTools,
  connectionsMeta,
  draftForLine,
  draftRowTitle,
  draftSessions,
  draftsMeta,
  menuItems,
  promptLine,
  sessionMeta,
  sessionsMeta,
  type MenuItem,
} from "./draftsModel";

type Order = "latest" | "oldest" | "most";
type Filter = "all" | "with" | "none";

const ORDER = [
  { value: "latest" as const, label: "Latest" },
  { value: "oldest" as const, label: "Oldest" },
  { value: "most" as const, label: "Most sessions" },
];

const byOrder = (order: Order) => (a: DraftListItem, b: DraftListItem) =>
  order === "most" ? b.sessionCount - a.sessionCount || (a.updatedAt < b.updatedAt ? 1 : -1) : order === "oldest" ? (a.updatedAt < b.updatedAt ? -1 : 1) : a.updatedAt < b.updatedAt ? 1 : -1;

const linkButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: TOUCH_MIN,
  padding: "0 4px",
  border: 0,
  background: "transparent",
  fontFamily: FIGTREE,
  fontSize: 15,
  lineHeight: "20px",
  color: t.text,
  textDecoration: "underline",
  textUnderlineOffset: 3,
  cursor: "pointer",
};

function LinkButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: string }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button type="button" disabled={disabled} onClick={onClick} {...handlers} style={{ ...linkButton, ...ring(state.focusVisible) }}>
      {children}
    </button>
  );
}

/** The 44 secondary plus at the right of a session. */
function AddButton({ onClick }: { onClick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-label="Add to a draft"
      onClick={onClick}
      {...handlers}
      style={{ boxSizing: "border-box", width: TOUCH_MIN, height: TOUCH_MIN, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", border: 0, borderRadius: TOUCH_MIN / 2, background: t.control, color: t.text, cursor: "pointer", ...ring(state.focusVisible) }}
    >
      <MobileIcon name="new" size={20} />
    </button>
  );
}

/** The sheet's rows: "New build" first, then the drafts, as the desktop's + menu lists them. */
function AddSheet({ session, drafts, onClose, onPick }: { session: SessionSummary; drafts: readonly DraftListItem[]; onClose: () => void; onPick: (item: MenuItem) => void }) {
  const items = menuItems(session, drafts);
  const label = (item: MenuItem) => (item.kind === "new" ? "New build" : item.label);
  const ordered = [...items.filter((item) => item.kind === "new"), ...items.filter((item) => item.kind !== "new")];
  return (
    <>
      {ordered.map((item) =>
        item.kind === "open" ? (
          <PhoneRow key={item.key} title={label(item)} to={`/compose/${item.buildId}`} trail={{ kind: "chevron" }} />
        ) : (
          <PhoneRow
            key={item.key}
            title={label(item)}
            onSelect={() => {
              onClose();
              onPick(item);
            }}
          />
        ),
      )}
    </>
  );
}

function SessionLine({ session, meta, drafts, onPick }: { session: SessionSummary; meta: string; drafts: readonly DraftListItem[]; onPick: (item: MenuItem) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li data-testid="session-row" style={{ listStyle: "none" }}>
      <PhoneRow lead={{ kind: "grip" }} title={promptLine(session)} line={meta} trail={{ kind: "node", node: <AddButton onClick={() => setOpen(true)} /> }} />
      <PhoneBottomSheet open={open} onOpenChange={setOpen} title="Add to a draft">
        <AddSheet session={session} drafts={drafts} onClose={() => setOpen(false)} onPick={onPick} />
      </PhoneBottomSheet>
    </li>
  );
}

export function DraftsPhone({ ConfirmDialog, now, draftsRead, sessionsRead, sessionsAnchor, drafts, sessions, moreSessions, onAddToNew, onAddToDraft, onConnect, emptyDrafts }: DraftsViewProps & { ConfirmDialog: ConfirmDialogComponent }) {
  const [order, setOrder] = useState<Order>("latest");
  const [filter, setFilter] = useState<Filter>("all");
  const [showAll, setShowAll] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [confirmingEmpty, setConfirmingEmpty] = useState(false);
  /* The frame's own panel steps back: a phone draws sections on the Page shade. */
  useColumnPanels(true);
  useSessionPhase();
  const pageFailed = allFailed([draftsRead, sessionsRead]);
  const draftsShown = shownState([draftsRead]) === "ready";
  const sessionsShown = shownState([sessionsRead]) === "ready";
  const fact = draftsShown ? draftsMeta(drafts.length) : null;
  /* The fact is the bar's title; the page keeps its h1 for screen readers. */
  useRegisterPageBar(fact ? { title: fact } : null);

  const withSessions = drafts.filter((draft) => draft.sessionCount > 0).length;
  const none = drafts.length - withSessions;
  const visible = drafts.filter((draft) => (filter === "with" ? draft.sessionCount > 0 : filter === "none" ? draft.sessionCount === 0 : true)).sort(byOrder(order));
  const shown = showAll ? visible : visible.slice(0, DRAFTS_SHOWN);
  const hidden = visible.length - shown.length;
  const sessionsList = showAllSessions ? sessions : sessions.slice(0, SESSIONS_SHOWN);
  const sessionsHidden = sessions.length - sessionsList.length;
  const tools = sessionsShown ? connectedTools(sessions, now) : [];

  const pick = (session: SessionSummary) => (item: MenuItem) => {
    if (item.kind === "target" || item.kind === "draft") {
      const draft = drafts.find((d) => d.id === item.buildId);
      if (draft) onAddToDraft(session.id, draft);
    } else if (item.kind === "new") onAddToNew(session.id);
  };

  return (
    <div data-testid="drafts-view" data-phone="" style={{ fontFamily: FIGTREE, fontSize: 15, lineHeight: "20px", color: t.text, fontVariantNumeric: "tabular-nums", paddingBottom: 24 }}>
      <h1 className="sr-only">{fact ?? "Drafts"}</h1>
      <section aria-label="Drafts">
        {pageFailed ? (
          <PageFailed reads={[draftsRead, sessionsRead]} region="Drafts" logs={["[Drafts] drafts read failed", "[Drafts] sessions read failed"]} style={{ padding: PHONE_MARGIN }} />
        ) : (
          <PageState
            read={draftsRead}
            thing="your drafts"
            region="Drafts"
            log="[Drafts] drafts read failed"
            style={{ padding: PHONE_MARGIN }}
            skeleton={<RowSkeletons count={6} what="your drafts" />}
            empty={{ when: () => drafts.length === 0, line: "Nothing in progress." }}
          >
            {() => (
              <>
                <PhoneTabs<Order> label="Order" tabs={ORDER} value={order} onChange={setOrder} />
                <PhonePills<Filter>
                  label="Show"
                  value={filter}
                  onChange={setFilter}
                  pills={[
                    { value: "all", label: "All", count: drafts.length },
                    { value: "with", label: "With sessions", count: withSessions },
                    { value: "none", label: "No sessions", count: none },
                  ]}
                />
                <ul style={{ margin: 0, padding: 0 }}>
                  {shown.map((draft) => {
                    const forLine = draftForLine(draft);
                    return (
                      <li key={draft.id} style={{ listStyle: "none" }}>
                        <PhoneRow
                          work
                          monoLine
                          intent
                          data-testid="draft-row"
                          to={`/compose/${draft.id}`}
                          title={draftRowTitle(draft)}
                          line={[forLine, draftSessions(draft)].filter(Boolean).join(" · ")}
                          trail={{ kind: "node", node: <span style={{ fontFamily: DM_MONO, fontSize: 13, lineHeight: "16px", color: t.label }}>{shortAgo(draft.updatedAt, now)}</span> }}
                        />
                      </li>
                    );
                  })}
                </ul>
                {hidden > 0 ? (
                  <div style={{ padding: `0 ${PHONE_MARGIN - 4}px` }}>
                    <LinkButton onClick={() => setShowAll(true)}>{`Show ${hidden} more`}</LinkButton>
                  </div>
                ) : null}
              </>
            )}
          </PageState>
        )}
        {emptyDrafts && emptyDrafts.count > 0 ? (
          <div style={{ padding: `0 ${PHONE_MARGIN - 4}px` }}>
            <LinkButton onClick={() => setConfirmingEmpty(true)}>{`Remove empty drafts (${emptyDrafts.count})`}</LinkButton>
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
      </section>

      <section aria-label="Sessions" style={{ position: "relative" }}>
        {/* Out of the flow and over the whole section, so the page can tell when any of it shows. */}
        <span ref={sessionsAnchor} aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
        <SectionFact fact={sessionsShown ? sessionsMeta(sessions.length) : "Sessions"} />
        {pageFailed ? null : (
          <PageState
            read={sessionsRead}
            thing="your sessions"
            region="Sessions"
            log="[Drafts] sessions read failed"
            style={{ padding: PHONE_MARGIN }}
            skeleton={<RowSkeletons count={SESSION_SKELETON_ROWS} height={SESSION_ROW} what="your sessions" />}
            empty={{ when: () => sessions.length === 0 && !moreSessions, line: "No new sessions.", action: { label: "Connect a tool", onClick: onConnect } }}
          >
            {() => (
              <>
                {sessions.length === 0 ? null : (
                  <ul style={{ margin: 0, padding: 0 }}>
                    {sessionsList.map((session) => (
                      <SessionLine key={session.id} session={session} meta={sessionMeta(session, drafts, now)} drafts={drafts} onPick={pick(session)} />
                    ))}
                  </ul>
                )}
                {sessionsHidden > 0 || moreSessions ? (
                  <div style={{ padding: `0 ${PHONE_MARGIN - 4}px`, display: "flex", gap: 8 }}>
                    {sessionsHidden > 0 ? <LinkButton onClick={() => setShowAllSessions(true)}>Show all</LinkButton> : null}
                    {moreSessions && sessionsHidden === 0 ? (
                      <LinkButton onClick={moreSessions.onMore} disabled={moreSessions.loading}>
                        {moreSessions.loading ? "Loading…" : "Show more sessions"}
                      </LinkButton>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </PageState>
        )}
      </section>

      {sessionsShown ? (
        <section aria-label="Connections">
          <SectionFact fact={connectionsMeta(tools.length)} />
          <div style={{ padding: `0 ${PHONE_MARGIN}px`, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
            {tools.length > 0 ? <p style={{ margin: 0, fontSize: 15, lineHeight: "20px", color: t.text }}>{`Last import ${tools[0].lastImport}`}</p> : null}
            <p style={{ margin: 0, fontSize: 13, lineHeight: "16px", color: t.label }}>Sessions arrive through the OpenBuilds connector.</p>
            <PhoneConnect onClick={onConnect} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** "Connect a tool": a small secondary button, 44 tall. */
function PhoneConnect({ onClick }: { onClick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onClick}
      {...handlers}
      style={{ boxSizing: "border-box", height: TOUCH_MIN, padding: "0 20px", border: 0, borderRadius: TOUCH_MIN / 2, background: t.control, color: t.text, fontFamily: FIGTREE, fontSize: 13, fontWeight: 600, cursor: "pointer", ...ring(state.focusVisible) }}
    >
      Connect a tool
    </button>
  );
}
