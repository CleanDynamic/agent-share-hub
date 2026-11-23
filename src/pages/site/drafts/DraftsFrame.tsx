/* Synth 10 Part A: the Drafts page's frame, in a small module of its own: the two panels, the head, the start slot, the
   row skeletons and the controls. DraftsView draws its page from these, and `DraftsLoadingView` draws the page as it
   stands while both lists load, from the same pieces, so the route table's Placeholder is the page's own loading state
   without the page's code (its menus, sheets and dialogs) in the first download.

   PANELS (Synth 03). Two panels on the page shade, 8 apart, no lines: the drafts (`minmax(0, 1fr)`) and the side panel
   (340 from 1101, 300 from 761 to 1100). Below 761 the side sections stack under the list. The frame's own panel steps
   back (`useColumnPanels`). The head is the fact: "36 drafts" as the h1, with "New build" at the right. */

import { useState, type CSSProperties, type DragEvent, type ReactNode } from "react";

import { Button } from "@/components/brand/Button";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { PANEL_GUTTER, PANEL_PAD, PANEL_RADIUS } from "@/components/shell/chromeSize";
import { useColumnPanels } from "@/components/shell/frameChrome";
import { panelColumns } from "@/components/shell/pageGrid";
import { useIsPhone, useMinWidth } from "@/components/shell/useMinWidth";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

/** Draft rows are 64 high (title 15, meta 13) and session rows 56. */
export const ROW = 64;
export const SESSION_ROW = 56;
/** The two panels show from 761; the side panel is 340 from 1101 and 300 below that. */
const TWO_PANELS_MIN = 761;
const WIDE_SIDE_MIN = 1101;

/* ── shared pieces ── */

const quiet: CSSProperties = {
  fontFamily: FIGTREE,
  fontSize: 13,
  lineHeight: "20px",
  color: t.text2,
  textDecoration: "underline",
  textDecorationColor: t.label,
  textUnderlineOffset: 3,
  background: "transparent",
  border: 0,
  cursor: "pointer",
};

/** A quiet text button: "Show all", "Remove empty drafts". */
export function TextButton({ onClick, style, children, disabled }: { onClick: () => void; style?: CSSProperties; children: ReactNode; disabled?: boolean }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button type="button" data-hit="" disabled={disabled} onClick={onClick} {...handlers} style={{ ...quiet, display: "inline-flex", alignItems: "center", height: 24, padding: "0 4px", borderRadius: r.chip, color: state.hovered ? t.text : t.text2, ...ring(state.focusVisible), ...style }}>
      {children}
    </button>
  );
}

/** A control: the shared Button, secondary, small (44 on a phone). */
export function ControlButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  const phone = useIsPhone();
  return (
    <Button variant="secondary" size={phone ? 44 : 32} disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  );
}

/** A drag that carries text is a session. Anything else (a file, a link) is not ours to answer. */
const carriesText = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("text/plain");

/** The drop target's state and handlers, shared by the start slot and every draft row. */
export function useDropTarget(onDropSession: (sessionId: string) => void) {
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

/* ── the drafts panel ── */

/** The drop target for a session that starts a build: a dashed slot under the head. On a phone nothing is dragged, and the
    head's "New build" is the way, so the slot is not drawn. */
export function StartRow({ phone, onDropSession }: { phone: boolean; onDropSession: (id: string) => void }) {
  const { over, handlers } = useDropTarget(onDropSession);
  const { state, handlers: focus } = useInteractive<HTMLAnchorElement>();
  if (phone) return null;
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
        minHeight: 48,
        margin: `0 ${PANEL_PAD}px 8px`,
        padding: "0 16px",
        boxSizing: "border-box",
        borderRadius: r.card,
        border: `1px dashed ${over ? t.evidence : t.label}`,
        background: over ? t.module : "transparent",
        textDecoration: "none",
        color: over ? t.text : t.text2,
        fontFamily: FIGTREE,
        fontSize: 13,
        lineHeight: "20px",
        ...ring(state.focusVisible),
      }}
    >
      {over ? "Drop to start a build from it" : "Drop a session here to start a build"}
    </Link>
  );
}

export const SESSION_SKELETON_ROWS = 5;
export const DRAFT_SKELETON_ROWS = 6;

export function RowSkeletons({ count, height = ROW, what }: { count: number; height?: number; what: string }) {
  return (
    <LoadingRegion what={what} style={{ display: "flex", flexDirection: "column" }}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} style={{ height, boxSizing: "border-box", display: "flex", alignItems: "center", padding: `0 ${PANEL_PAD}px` }}>
          <Skeleton height={height - 24} radius={10} />
        </div>
      ))}
    </LoadingRegion>
  );
}

/* ── the head ── */

/** The panel's head: the fact is the h1, "New build" at the right. While the count is not known the h1 is read by screen
    readers only and a line of dots holds its place. */
export function DraftsHead({ fact }: { fact: string | null }) {
  const phone = useIsPhone();
  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: `0 ${PANEL_PAD}px 8px`, minHeight: 40 }}>
      {fact === null ? (
        <>
          <h1 className="sr-only" style={{ margin: 0 }}>Drafts</h1>
          <span aria-hidden="true" style={{ display: "block", width: "40%", height: 24 }}>
            <Skeleton height={20} radius={4} />
          </span>
        </>
      ) : (
        <h1 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 20, fontWeight: 600, lineHeight: "24px", letterSpacing: "-0.01em", color: t.text }}>{fact}</h1>
      )}
      <Button variant="primary" size={phone ? 44 : 32} href="/compose/new">
        New build
      </Button>
    </header>
  );
}

/* ── the panels ── */

const panel: CSSProperties = { background: t.surface, borderRadius: PANEL_RADIUS, overflow: "clip", minWidth: 0, boxSizing: "border-box", padding: `${PANEL_PAD}px 0` };

/** A side section: its head (the fact, 20/600) and its rows. */
export function SideSection({ label, head, children }: { label: string; head: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={label} style={{ minWidth: 0, position: "relative" }}>
      {head}
      {children}
    </section>
  );
}

/** A section's head: the fact, with room for one quiet control at the right. */
export function SideHead({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: `0 ${PANEL_PAD}px 8px`, minHeight: 32 }}>
      <h2 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 20, fontWeight: 600, lineHeight: "24px", color: t.text }}>{title}</h2>
      {action}
    </div>
  );
}

/** The page: the drafts panel and the side panel. Below 761 the side sections stack under the list, in one column. */
export function DraftsLayout({
  head,
  draftsSection,
  sessionsSection,
  connectionsSection,
}: {
  head: ReactNode;
  draftsSection: ReactNode;
  sessionsSection: ReactNode;
  connectionsSection: ReactNode;
}) {
  useColumnPanels(true);
  const two = useMinWidth(TWO_PANELS_MIN);
  const wide = useMinWidth(WIDE_SIDE_MIN);
  const side = (
    <aside aria-label="Sessions and connections" style={{ ...panel, display: "flex", flexDirection: "column", gap: 24 }}>
      {sessionsSection}
      {connectionsSection}
    </aside>
  );
  return (
    <div
      data-testid="drafts-view"
      style={{
        fontFamily: FIGTREE,
        fontSize: 13,
        lineHeight: "20px",
        color: t.text,
        fontVariantNumeric: "tabular-nums",
        ...(two ? panelColumns("two", { between: !wide }) : { display: "flex", flexDirection: "column", gap: PANEL_GUTTER }),
      }}
    >
      <section aria-label="Drafts" style={{ ...panel, paddingBottom: 24 }}>
        {head}
        {draftsSection}
      </section>
      {side}
    </div>
  );
}

const noDrop = () => undefined;

/** The page while both lists load: the route table's Placeholder for /drafts. Its controls work; a session dropped on
    the start row before the page has arrived is not taken (the page that takes it is not here yet). */
export function DraftsLoadingView() {
  const phone = useIsPhone();
  return (
    <DraftsLayout
      head={<DraftsHead fact={null} />}
      draftsSection={
        <>
          <StartRow phone={phone} onDropSession={noDrop} />
          <RowSkeletons count={DRAFT_SKELETON_ROWS} what="your drafts" />
        </>
      }
      sessionsSection={
        <SideSection label="Sessions" head={<SideHead title={<span aria-hidden="true" style={{ display: "block", width: 120, height: 24 }}><Skeleton height={20} radius={4} /></span>} />}>
          <RowSkeletons count={SESSION_SKELETON_ROWS} height={SESSION_ROW} what="your sessions" />
        </SideSection>
      }
      connectionsSection={null}
    />
  );
}
