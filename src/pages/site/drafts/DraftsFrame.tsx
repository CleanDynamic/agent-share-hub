/* SV-04 P5, SV-08: the Drafts page's frame, in a small module of its own: the head, the start slot, the row skeletons and
   the page's arrangement. DraftsView draws its page from these, and `DraftsLoadingView` draws the page as it stands while
   both lists load, from the same pieces, so the route table's Placeholder is the page's own loading state without the
   page's code (its menus, sheets and dialogs) in the first download.

   SV-08: the board is `design/reference/vision/dusk/drafts.html`. The surface and its padding belong to the site frame;
   what is here starts at the page head. */

import { useState, type CSSProperties, type DragEvent, type ReactNode } from "react";

import { DashedSlot } from "@/components/vision/DashedSlot";
import { SectionHead } from "@/components/vision/SectionHead";
import { Button } from "@/components/brand/Button";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { useConnectorDialog } from "@/components/connect/ConnectorDialog";
import { PageHeader } from "@/components/shell/PageHeader";
import { pageColumns } from "@/components/shell/pageGrid";
import { useIsPhone, useMinWidth } from "@/components/shell/useMinWidth";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

/* ── the board's numbers ── */

/** Draft rows and session rows are 56 high on the board. */
export const ROW = 56;
/** The columns split at 1100 on the board. */
const TWO_COLUMNS_MIN = 1101;

/* ── shared pieces ── */

const underlined: CSSProperties = {
  fontFamily: FIGTREE,
  fontSize: 12,
  lineHeight: "28px",
  color: t.text2,
  textDecoration: "underline",
  textDecorationColor: t.line,
  textUnderlineOffset: 3,
  background: "transparent",
  border: 0,
  padding: 0,
  cursor: "pointer",
};

/** An underlined text button: "How they get here", "Remove empty drafts". */
export function TextButton({ onClick, style, children, disabled }: { onClick: () => void; style?: CSSProperties; children: ReactNode; disabled?: boolean }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button type="button" data-hit="" disabled={disabled} onClick={onClick} {...handlers} style={{ ...underlined, borderRadius: 6, ...ring(state.focusVisible), ...style }}>
      {children}
    </button>
  );
}

/** A control: the shared Button, secondary, 32 high (44 on a phone). */
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

/* ── Continue editing ── */

/** "Start a new build": a page-width dashed slot, and the drop target for a session. */
export function StartRow({ phone, onDropSession }: { phone: boolean; onDropSession: (id: string) => void }) {
  const { over, handlers } = useDropTarget(onDropSession);
  const { state, handlers: focus } = useInteractive<HTMLAnchorElement>();
  return (
    <DashedSlot
      wide
      as={Link}
      to="/compose/new"
      data-testid="start-row"
      data-over={over ? "true" : undefined}
      {...handlers}
      {...focus}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        minHeight: 52,
        marginTop: 16,
        padding: "0 16px",
        borderColor: over ? t.evidence : t.label,
        background: over ? t.rowHighlight : "transparent",
        textDecoration: "none",
        color: t.text,
        fontFamily: FIGTREE,
        ...ring(state.focusVisible),
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 500 }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        Start a new build
      </span>
      <span style={{ fontSize: 12, color: t.label, textAlign: "right" }}>
        {over ? "Drop to start a build from it" : phone ? null : "or drop a session here"}
      </span>
    </DashedSlot>
  );
}

/** CA-10: the sessions skeleton's rows, as a typical list draws them. */
export const SESSION_SKELETON_ROWS = 5;
export const DRAFT_SKELETON_ROWS = 6;

export function RowSkeletons({ count, height = ROW, what }: { count: number; height?: number; what: string }) {
  return (
    <LoadingRegion what={what} style={{ display: "flex", flexDirection: "column" }}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} style={{ height, borderBottom: `1px solid ${t.hairline}`, display: "flex", alignItems: "center" }}>
          <Skeleton height={height - 24} radius={6} />
        </div>
      ))}
    </LoadingRegion>
  );
}

/* ── the page ── */

export function DraftsHeading({ onConnect }: { onConnect: () => void }) {
  return (
    <div>
      <PageHeader title="Drafts" actions={<ControlButton onClick={onConnect}>Connect a tool</ControlButton>} />
      <p style={{ margin: "4px 0 0", fontFamily: FIGTREE, fontSize: 13, lineHeight: "20px", color: t.text2 }}>Pick up a build, or start one from a session.</p>
    </div>
  );
}

/** A section: its head, then what it holds. */
export function ListSection({ label, head, children }: { label: string; head: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={label} style={{ minWidth: 0, position: "relative" }}>
      {head}
      {children}
    </section>
  );
}

/** The page's arrangement: the head with Connect a tool, the two sections, then what comes after them. On a phone the
    sections are one column: Continue editing, Sessions, Connected tools. */
export function DraftsLayout({
  onConnect,
  continueSection,
  sessionsSection,
  connectedTools,
}: {
  onConnect: () => void;
  continueSection: ReactNode;
  sessionsSection: ReactNode;
  /** The tile below the sessions: absent when no tool is known. */
  connectedTools: ReactNode;
}) {
  const wide = useMinWidth(TWO_COLUMNS_MIN);
  return (
    <div data-testid="drafts-view" style={{ display: "flex", flexDirection: "column", fontVariantNumeric: "tabular-nums", paddingBottom: 64 }}>
      <DraftsHeading onConnect={onConnect} />
      <div
        style={{
          marginTop: 48,
          /* The page grid's main and side template (9 / 3). */
          ...(wide ? pageColumns("mainSide") : { display: "grid", gridTemplateColumns: "minmax(0, 1fr)" }),
          rowGap: 48,
          alignItems: "start",
        }}
      >
        {continueSection}
        <div style={{ minWidth: 0 }}>
          {sessionsSection}
          {connectedTools}
        </div>
      </div>
    </div>
  );
}

const noDrop = () => undefined;

/** The page while both lists load: the route table's Placeholder for /drafts. Its controls work; a session dropped on
    the start row before the page has arrived is not taken (the page that takes it is not here yet). */
export function DraftsLoadingView() {
  const phone = useIsPhone();
  const connector = useConnectorDialog();
  return (
    <DraftsLayout
      onConnect={connector.open}
      continueSection={
        <ListSection label="Continue editing" head={<SectionHead title="Continue editing" meta={"\u00a0"} headingLevel={2} />}>
          <StartRow phone={phone} onDropSession={noDrop} />
          <div style={{ marginTop: 8 }}>
            <RowSkeletons count={DRAFT_SKELETON_ROWS} what="your drafts" />
          </div>
        </ListSection>
      }
      sessionsSection={
        <ListSection
          label="Sessions"
          head={
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <SectionHead title="Sessions" meta={"\u00a0"} headingLevel={2} />
              {phone ? null : <TextButton onClick={connector.open}>How they get here</TextButton>}
            </div>
          }
        >
          <div style={{ marginTop: 16, borderTop: `1px solid ${t.hairline}` }}>
            <RowSkeletons count={SESSION_SKELETON_ROWS} what="your sessions" />
          </div>
        </ListSection>
      }
      connectedTools={null}
    />
  );
}
