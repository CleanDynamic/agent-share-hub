/* SV-04 P5: the Drafts page's frame, in a small module of its own: the heading, the two panels' heads, the start row,
   the row skeletons and the page's arrangement. DraftsView draws its page from these, and `DraftsLoadingView` draws the
   page as it stands while both lists load, from the same pieces, so the route table's Placeholder is the page's own
   loading state without the page's code (its menus, sheets and dialogs) in the first download. */

import { useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/brand/Button";
import { Panel } from "@/components/brand/Panel";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { useConnectorDialog } from "@/components/connect/ConnectorDialog";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, display } from "@/lib/theme/type";

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

export function TextButton({ onClick, style, children, disabled }: { onClick: () => void; style?: CSSProperties; children: ReactNode; disabled?: boolean }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button type="button" data-hit="" disabled={disabled} onClick={onClick} {...handlers} style={{ ...underlined, borderRadius: 6, ...ring(state.focusVisible), ...style }}>
      {children}
    </button>
  );
}

export function ListHead({ title, count, right }: { title: string; count: number; right?: ReactNode }) {
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

export function StartRow({ phone, onDropSession }: { phone: boolean; onDropSession: (id: string) => void }) {
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

/** CA-10: the sessions skeleton's rows, as a typical list draws them. */
export const SESSION_SKELETON_ROWS = 5;
export const SESSION_ROW = 43;
export const SESSION_ROW_PHONE = 46;

export function RowSkeletons({ count, height, what }: { count: number; height: number; what: string }) {
  return (
    <LoadingRegion what={what} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} height={height} radius={12} />
      ))}
    </LoadingRegion>
  );
}

/* ── the page ── */

export function DraftsHeading({ phone }: { phone: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <h1 style={{ ...display(phone ? 32 : 44, { mobilePageHeading: phone }), margin: 0, color: t.text }}>Drafts</h1>
      {phone ? null : (
        <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 14, color: t.text2 }}>
          Pick up a build, or start one from a session.
        </p>
      )}
    </div>
  );
}

export function OlderDrafts() {
  return (
    <Link
      to="/drafts/posts"
      data-hit=""
      style={{ alignSelf: "flex-start", fontFamily: FIGTREE, fontSize: 12, color: t.text2, textDecoration: "underline" }}
    >
      Older post drafts
    </Link>
  );
}

/** The page's arrangement: the heading and Connect a tool, the two panels, then what comes after them. */
export function DraftsLayout({
  phone,
  onConnect,
  continuePanel,
  sessionsPanel,
  after,
}: {
  phone: boolean;
  onConnect: () => void;
  continuePanel: ReactNode;
  sessionsPanel: ReactNode;
  after: ReactNode;
}) {
  if (phone) {
    return (
      <div data-testid="drafts-view" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <DraftsHeading phone />
        {continuePanel}
        {sessionsPanel}
        <Button variant="secondary" size={48} fontSize={15} fullWidth onClick={onConnect}>
          Connect a tool
        </Button>
        {after}
      </div>
    );
  }

  return (
    <div data-testid="drafts-view" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        <DraftsHeading phone={false} />
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
      <div style={{ marginTop: 17, display: "flex", flexDirection: "column", gap: 8 }}>{after}</div>
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
      phone={phone}
      onConnect={connector.open}
      continuePanel={
        <Panel surface="plain" padding="8px" style={{ minWidth: 0 }}>
          <ListHead title="Continue editing" count={0} />
          <StartRow phone={phone} onDropSession={noDrop} />
          <RowSkeletons count={3} height={phone ? 46 : 52} what="your drafts" />
        </Panel>
      }
      sessionsPanel={
        <Panel surface="plain" padding="8px" style={{ minWidth: 0 }}>
          <span aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
          <ListHead title="Sessions" count={0} right={phone ? undefined : <TextButton onClick={connector.open}>How they get here</TextButton>} />
          <RowSkeletons count={SESSION_SKELETON_ROWS} height={phone ? SESSION_ROW_PHONE : SESSION_ROW} what="your sessions" />
        </Panel>
      }
      after={<OlderDrafts />}
    />
  );
}
