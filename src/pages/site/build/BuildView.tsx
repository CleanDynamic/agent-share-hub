/* UI-P90 — the Build page's first screen and The build in the refined look, as
   `design/reference/refined/{dusk,noon}/build-list.html` draws them.

   UI-P99: THIS WAS THE REFINED FORK. The current view it forked is deleted and this took its name; what follows was written when both existed, so "the current look" below means the look that has been retired. `BuildView` stays the current look; this takes its props (`BuildViewProps`, imported, not
   copied) and keeps its data, handlers, copy, accessible names and order of parts. `BuildPage` and the dev pages
   choose between the two with `useLook()`.

   DESKTOP. The frame draws the breadcrumb. Then a wrapping row, gap 48: the hero module (`flex: 999 1 640px`) and the
   reproduction column (`flex: 1 1 300px`, max 340, gap 20). Then, with the steps, a second wrapping row, gap 48: The
   build (`flex: 999 1 640px`, gap 16) and What you need (`flex: 1 1 300px`, max 340, a hairline on its left). Without
   the steps the page's lower row is the current anatomy, part viewer and timeline, on their module paint.

   THE HERO. A 280-high media well with the dot grid; the picture light; the result window centred 64 from the top with
   the build's own cover in it; the shape tag top-left; the action dock top-right, text only. Under the well the
   build's mark in a 44 control tile, the title, the outcome and the credit. The picture light is the plaque's lamp, so
   it is lit, dimmed or absent from `plaqueState()` (data), never as decoration.

   PHONE keeps today's stacking order: the hero, the action row, the reproduction, the sections as chips, then the
   steps and What you need (or the anatomy, the viewer and the timeline). */

import { useRef, useState, type CSSProperties, type ReactNode, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import * as Menu from "@radix-ui/react-dropdown-menu";

import { Avatar } from "@/components/brand/Avatar";
import { Button } from "@/components/brand/Button";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { FilterChip } from "@/components/brand/FilterChip";
import { PictureLight, ResultWindow } from "@/components/brand/FramedWork";
import { MadeWithMarks } from "@/components/brand/MadeWithMarks";
import { Mark } from "@/components/brand/Mark";
import { Plaque, plaqueState } from "@/components/brand/Plaque";
import { Row } from "@/components/brand/Row";
import { StripedBar, type StripedBarTick } from "@/components/brand/StripedBar";
import { UnderlineTabs } from "@/components/brand/UnderlineTabs";
import { PostThread } from "@/components/post/PostThread";
import { PostRefsProvider } from "@/components/post/RefLinks";
import { MediaViewerProvider } from "@/components/post/media/MediaViewer";
import { ScrollRow } from "@/components/shell/ScrollRow";
import {
  BETWEEN,
  useIsPhone,
  useMinWidth,
  useWidthTier,
  sideTrack,
  type WidthTier,
} from "@/components/shell/useMinWidth";
import { EngagementRow } from "@/components/social/EngagementRow";
import { asideStyle, mainStyle, trackRow } from "@/lib/theme/refinedLayout";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { scrollBehavior } from "@/lib/theme/motion";
import { CONTROL } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, figure, DM_MONO, display } from "@/lib/theme/type";

import type {
  BuildActionsView,
  BuildCreditView,
  BuildHeroView,
  BuildProofView,
  BuildStepsView,
  BuildThreadView,
  BuildViewerView,
  CompletenessView,
} from "./buildModel";
import { NeedPanel, StepsList } from "./BuildSteps";
import { menuItem, menuSurface } from "../compose/refinedStyles";
import { buildSummary } from "@/lib/build/buildSummary";
import * as Dialog from "@radix-ui/react-dialog";
import { Maximize2, Play, X } from "lucide-react";
import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";
import { EmptyState } from "@/components/brand/EmptyState";
import { ErrorState } from "@/components/brand/ErrorState";
import { IconButton } from "@/components/brand/IconButton";
import { Panel, PanelHead } from "@/components/brand/Panel";
import { PartViewer } from "@/components/brand/PartViewer";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { Timeline } from "@/components/brand/Timeline";
import { BOARD_GRID_HEIGHT, boardHeight, type PageFit } from "@/components/shell/siteFrameFit";
import { categoryColour } from "@/lib/theme/category";
import { r } from "@/lib/theme/radius";
import {
  anatomySubtitle,
  tabReadsPart,
  timelineSubtitle,
  type BuildAnatomyView,
  type BuildTabKey,
  type BuildTimelineView,
  type PartRowView,
  type ProofActionKind,
} from "./buildModel";

export interface BuildViewProps {
  fit?: PageFit;
  /** The clock the plaque reads. The compare page freezes it. */
  now?: number;
  hero: BuildHeroView;
  actions: BuildActionsView;
  proof: BuildProofView;
  anatomy: BuildAnatomyView;
  viewer: BuildViewerView;
  timeline: BuildTimelineView;
  /**
   * UI-P73 — the steps. Given, the second row is The build and What you need,
   * and the anatomy, the part viewer and the timeline are not drawn. Absent,
   * the page is exactly as it was.
   */
  steps?: BuildStepsView;
}

/** The first row's height on the desktop board. */
export const HERO_ROW = 402;

/** The bottom row's height on the board: what the 820 leaves under the hero row. */
export const BOTTOM_ROW = BOARD_GRID_HEIGHT - HERO_ROW - 12;

/* UI-P39 — the two rows between the boards. The hero row keeps both tracks to
   1024 (the proof narrowing to 340) and stacks below. The bottom row's narrowest
   panel, the timeline, drops below the anatomy and the viewer under 1280, full
   width at the row's height. */
export function heroRow(tier: WidthTier): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: tier === "stacked" ? "minmax(0, 1fr)" : `minmax(0, 1fr) ${sideTrack(420)}`,
    gridAutoRows: tier === "stacked" ? `minmax(${HERO_ROW}px, auto)` : undefined,
    gap: 8,
    flexShrink: 0,
  };
}

export function bottomRow(tier: WidthTier): CSSProperties {
  return tier === "full"
    ? { display: "grid", gridTemplateColumns: "300px minmax(0, 1fr) 280px", gap: 8, flexGrow: 1, minHeight: 0 }
    : { display: "grid", gridTemplateColumns: "300px minmax(0, 1fr)", gridAutoRows: `minmax(${BOTTOM_ROW}px, auto)`, gap: 8, flexGrow: 1 };
}

/** The timeline's cell: its own track at 1280 and up, the row's full width below. */
export const dropped = (tier: WidthTier): CSSProperties => (tier === "full" ? {} : { gridColumn: "1 / -1" });

/** The phone shows this many parts before "Show n more parts". */
export const PHONE_PARTS = 6;

export const NOTE = "Your run relights the lamp and records the model you used.";

export const ACTION_LABEL: Record<ProofActionKind, string> = {
  reproduce: "I ran this and it worked",
  reconfirm: "Re-confirm it still works",
  "sign-in": "Sign in to confirm",
};

/** The viewer's body, which the tabs control. */
export const VIEWER_PANEL = "build-viewer-panel";

export const tabId = (tab: BuildTabKey) => `build-viewer-tab-${tab}`;

/** How long a tile or a button says it worked. */
export const CONFIRMED_MS = 1500;

/** One live region for the page's two copy controls. Saying the same word twice re-announces it. */
export function useAnnouncer() {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const announce = useCallback((text: string) => {
    clearTimeout(timer.current);
    setMessage("");
    timer.current = setTimeout(() => {
      setMessage(text);
      timer.current = setTimeout(() => setMessage(""), CONFIRMED_MS * 2);
    }, 50);
  }, []);

  const region = (
    <div data-testid="build-live" role="status" aria-live="polite" style={VISUALLY_HIDDEN}>
      {message}
    </div>
  );
  return { announce, region };
}

/** True for CONFIRMED_MS after `confirm()` is called. */
export function useConfirmed(): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const confirm = useCallback(() => {
    setOn(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), CONFIRMED_MS);
  }, []);
  return [on, confirm];
}

/** An optimistic run that the server refused: said once in the panel, with a retry. */
export function RunFailed({ failure }: { failure: NonNullable<BuildProofView["writeError"]> }) {
  return (
    <ErrorState
      line="That didn't save."
      panel="Reproduction"
      onRetry={failure.onRetry}
      error={failure.error}
      style={{ marginTop: 8 }}
      data-testid="build-run-error"
    />
  );
}

export function PartRow({
  part,
  selected,
  phone,
  onSelect,
}: {
  part: PartRowView;
  selected: boolean;
  phone: boolean;
  onSelect: (id: string) => void;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const meta = part.gap ? (part.ask ?? "left open") : part.meta;

  return (
    <button
      type="button"
      data-testid="build-part-row"
      data-part-id={part.id}
      data-gap={part.gap ? "" : undefined}
      aria-current={selected ? "true" : undefined}
      onClick={() => onSelect(part.id)}
      {...handlers}
      style={{
        display: "grid",
        gridTemplateColumns: phone ? "30px minmax(0, 1fr) auto" : "28px minmax(0, 1fr) auto",
        gap: 6,
        alignItems: "center",
        /* The reference sizes the row's content box, so a gap's dashed edge adds
           to it rather than eating into it. The row stretches across the list as
           a flex item, so no width is needed. */
        boxSizing: "content-box",
        /* A part is a control: 46 drawn on a phone, held at the 44px touch floor; 40 → 33 above it. */
        ...(phone ? { minHeight: 44 } : { height: 33 }),
        padding: "0 8px",
        borderRadius: r.control,
        /* Longhands: a shorthand holding a var() is one declaration some engines drop whole. */
        borderWidth: part.gap ? 1.5 : 0,
        borderStyle: part.gap ? "dashed" : "none",
        borderColor: part.gap ? t.catBreakage : "transparent",
        background: selected ? t.rowHighlight : "transparent",
        color: t.text,
        textAlign: "left",
        cursor: "pointer",
        ...ring(state.focusVisible),
      }}
    >
      <span style={{ ...display(20), color: t.label }}>{String(part.number).padStart(2, "0")}</span>
      <span style={{ display: "flex", alignItems: "center", gap: phone ? 6 : 4, minWidth: 0 }}>
        <span
          aria-hidden="true"
          style={{
            width: phone ? 8 : 7,
            height: phone ? 8 : 7,
            borderRadius: "50%",
            backgroundColor: categoryColour(part.category),
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: FIGTREE,
            fontSize: phone ? 13 : 12,
            color: t.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {part.title}
        </span>
      </span>
      {meta ? (
        <span style={{ fontFamily: DM_MONO, fontSize: phone ? 11 : 10, color: part.gap ? t.catBreakage : t.text2 }}>{meta}</span>
      ) : (
        <span />
      )}
    </button>
  );
}

export function AnatomyDialog({
  open,
  onOpenChange,
  children,
  title = "Anatomy",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.sheetDim, zIndex: 40 }} />
        <Dialog.Content
          data-testid="build-anatomy-dialog"
          aria-describedby={undefined}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 41,
            width: "min(880px, calc(100vw - 28px))",
            maxHeight: "88dvh",
            overflowY: "auto",
            boxSizing: "border-box",
            padding: "12px 12px 16px",
            borderRadius: r.panel,
            background: t.solid,
            border: `1px solid ${t.glassBorder}`,
            boxShadow: t.shadowSheet,
            color: t.text,
            fontFamily: FIGTREE,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Dialog.Title style={{ margin: 0, fontFamily: FIGTREE, fontSize: 15, fontWeight: 600, color: t.text }}>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton icon={X} label="Close" size={34} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AnatomyPanel({ anatomy, phone, onSelect }: { anatomy: BuildAnatomyView; phone: boolean; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { parts, gaps, selectedId } = anatomy;

  const selectedIndex = parts.findIndex((part) => part.id === selectedId);
  const all = !phone || expanded || selectedIndex >= PHONE_PARTS;
  const shown = all ? parts : parts.slice(0, PHONE_PARTS);
  const more = parts.length - shown.length;

  return (
    <Panel surface="glass" padding={phone ? "14px 10px" : "14px 12px"} style={phone ? undefined : { height: "100%" }}>
      <div data-testid="build-anatomy">
        <PanelHead
          headingLevel={2}
          title="Anatomy"
          subtitle={parts.length > 0 ? anatomySubtitle(parts.length, gaps) : undefined}
          right={
            phone ? undefined : (
              <IconButton icon={Maximize2} label="Show the full anatomy" size={34} onClick={() => setOpen(true)} disabled={parts.length === 0} />
            )
          }
        />
        {parts.length === 0 ? (
          <EmptyState line="This build has no parts yet." data-testid="build-anatomy-empty" />
        ) : (
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
            {shown.map((part) => (
              <PartRow key={part.id} part={part} selected={part.id === selectedId} phone={phone} onSelect={onSelect} />
            ))}
          </div>
        )}
        {more > 0 ? (
          <button
            type="button"
            data-testid="build-anatomy-more"
            data-ring-inset=""
            onClick={() => setExpanded(true)}
            style={{
              display: "block",
              /* A 44px target around a 12px line: the padding is the target, the
                 negative margins keep the line where the reference draws it (7
                 under the list and 7 in since the density pass). The padding is
                 the touch target and does not take the table (UI-P59). */
              margin: "-8px 0 -16px",
              padding: "16px 0 16px 8px",
              border: 0,
              background: "transparent",
              fontFamily: FIGTREE,
              fontSize: 12,
              color: t.action,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            Show {more} more {more === 1 ? "part" : "parts"}
          </button>
        ) : null}
      </div>
      {phone ? null : (
        <AnatomyDialog open={open} onOpenChange={setOpen}>
          {anatomy.full}
        </AnatomyDialog>
      )}
    </Panel>
  );
}

export function Viewer({
  viewer,
  part,
  phone,
  announce,
}: {
  viewer: BuildViewerView;
  part: PartRowView | null;
  phone: boolean;
  announce: (text: string) => void;
}) {
  const copy = async () => {
    if (await viewer.onCopy()) announce("Copied");
  };
  return (
    <div data-testid="build-viewer" style={{ height: phone ? undefined : "100%", minWidth: 0 }}>
      <PartViewer<BuildTabKey>
        variant={phone ? "phone" : "desktop"}
        number={part ? part.number : null}
        category={part?.category ?? ""}
        categoryLabel={part?.category ?? ""}
        name={part?.title ?? "Nothing placed yet"}
        tabs={viewer.tabs.map((tab) => ({ ...tab, id: tabId(tab.value), controls: VIEWER_PANEL }))}
        tab={viewer.tab}
        onTabChange={viewer.onTabChange}
        mode={viewer.mode}
        onModeChange={viewer.onModeChange}
        blurb={viewer.blurb}
        onCopy={() => void copy()}
        panelId={VIEWER_PANEL}
        tools={tabReadsPart(viewer.tab)}
      >
        {viewer.content}
      </PartViewer>
    </div>
  );
}

export function TimelinePanel({ timeline, phone, onPlay }: { timeline: BuildTimelineView; phone: boolean; onPlay: () => void }) {
  const { events, duration } = timeline;
  return (
    <Panel surface="glass" padding="14px 16px" style={phone ? undefined : { height: "100%" }}>
      <div data-testid="build-timeline">
        <PanelHead
          headingLevel={2}
          title="Watch it get built"
          subtitle={timelineSubtitle(duration, events.length)}
          right={<IconButton icon={Play} label="Play the build" size={phone ? 38 : 34} onClick={onPlay} disabled={events.length === 0} />}
        />
        <div style={{ marginTop: 8 }}>
          {events.length > 0 ? (
            <Timeline events={events} size={phone ? "phone" : "desktop"} label="Kept steps" />
          ) : (
            <EmptyState line="No events were kept for this build." data-testid="build-timeline-empty" style={{ padding: "12px 0" }} />
          )}
        </div>
      </div>
    </Panel>
  );
}

export const selectedPart = (anatomy: BuildAnatomyView): PartRowView | null =>
  anatomy.parts.find((part) => part.id === anatomy.selectedId) ?? anatomy.parts[0] ?? null;

export const MOCK_ROWS = 6;

/** The proof panel before the record arrives: the orb's circle, the plaque, the button and the details, as bones. */
export function ProofSkeleton({ phone }: { phone: boolean }) {
  const orb = phone ? 118 : 128;
  return (
    <Panel surface="glass" padding={phone ? "16px" : "16px 18px"} style={phone ? { minHeight: 440 } : { height: "100%" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Skeleton width={orb} height={orb} radius="50%" />
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexGrow: 1, minWidth: 0 }}>
          <Skeleton width={90} height={11} />
          <Skeleton height={phone ? 37 : 51} radius={r.chip} />
          {phone ? null : <Skeleton height={31} radius={r.control} />}
          {phone ? null : <Skeleton width="80%" height={11} />}
        </div>
      </div>
      {/* The phone's action: drawn 48, rendered 44 (the touch floor). */}
      {phone ? <Skeleton height={44} radius={r.control} style={{ marginTop: 8 }} /> : null}
      <Skeleton height={phone ? 161 : 107} radius={r.control} style={{ marginTop: 8 }} />
    </Panel>
  );
}

/** The first screen's shape before the record arrives: the panels, their heads and padding are the real ones; only what is inside them is a bone. */
export function BuildViewSkeleton({ fit = "content" }: { fit?: PageFit }) {
  const phone = useIsPhone();
  const tier = useWidthTier();
  const rows = (height: number, count: number, gap: number) =>
    Array.from({ length: count }, (_, i) => <Skeleton key={i} height={height} radius={r.control} style={i ? { marginTop: gap } : undefined} />);
  if (phone) {
    return (
      <LoadingRegion what="the build" announce data-testid="build-loading" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Skeleton height={382} radius={18} />
        <Skeleton height={76} radius={18} />
        <ProofSkeleton phone />
        <Skeleton height={30} radius={r.media} />
        <Panel surface="glass" padding="14px 10px">
          <PanelHead headingLevel={2} title="Anatomy" subtitle={"\u00a0"} />
          <div style={{ marginTop: 6 }}>{rows(46, MOCK_ROWS, 2)}</div>
          {/* "Show n more parts" */}
          <Skeleton width={120} height={13} style={{ margin: "8px 0 0 8px" }} />
        </Panel>
        <Skeleton height={317} radius={r.panel} />
        <Panel surface="glass" padding="14px 16px">
          <PanelHead headingLevel={2} title="Watch it get built" subtitle={"\u00a0"} />
          <div style={{ marginTop: 8 }}>{rows(43, 4, 0)}</div>
        </Panel>
      </LoadingRegion>
    );
  }
  const board = fit === "board" && tier === "full";
  return (
    <LoadingRegion
      what="the build"
      announce
      data-testid="build-loading"
      style={{ display: "flex", flexDirection: "column", gap: 8, lineHeight: "normal", ...boardHeight(fit) }}
    >
      <div style={{ ...heroRow(tier), ...(board ? { height: HERO_ROW } : { minHeight: HERO_ROW }) }}>
        <div style={{ minHeight: 0 }}>
          <Skeleton height="100%" radius={r.panel} style={{ minHeight: HERO_ROW + 2, boxSizing: "border-box" }} />
        </div>
        <div style={{ minHeight: 0 }}>
          <ProofSkeleton phone={false} />
        </div>
      </div>
      <div style={bottomRow(tier)}>
        <Panel surface="glass" padding="14px 12px" style={{ height: "100%" }}>
          <PanelHead headingLevel={2} title="Anatomy" subtitle={"\u00a0"} />
          <div style={{ marginTop: 6 }}>{rows(40, MOCK_ROWS, 2)}</div>
        </Panel>
        <Skeleton height="100%" radius={r.panel} />
        <Panel surface="glass" padding="14px 16px" style={{ height: "100%", ...dropped(tier) }}>
          <PanelHead headingLevel={2} title="Watch it get built" subtitle={"\u00a0"} />
          <div style={{ marginTop: 8 }}>{rows(41, 5, 0)}</div>
        </Panel>
      </div>
    </LoadingRegion>
  );
}

/** The record could not be read: the page's own panel says so, inside the frame, with a retry. The h1 is for assistive technology alone. */
export function BuildViewFailed({ onRetry, error }: { onRetry: () => void; error?: unknown }) {
  return (
    <Panel padding="24px 24px">
      <h1 style={VISUALLY_HIDDEN}>The build</h1>
      <ErrorState panel="The build" onRetry={onRetry} error={error} data-testid="build-error" />
    </Panel>
  );
}

/** A record that is not there, or could not be read: one Sentient line and one action. */
export function BuildViewNotice({ line, detail, action }: { line: string; detail?: string; action: ReactNode }) {
  return (
    <Panel padding="24px 24px">
      <div data-testid="build-notice" role="status" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
        <h1 style={{ ...display(30), margin: 0, color: t.text }}>{line}</h1>
        {detail ? <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, lineHeight: 1.55, color: t.text2, maxWidth: "68ch" }}>{detail}</p> : null}
        {action}
      </div>
    </Panel>
  );
}

/* ── type and recipes ── */

const text = (px: number, weight: 400 | 500, color: string, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: FIGTREE,
  fontSize: px,
  fontWeight: weight,
  lineHeight: "normal",
  color,
  ...extra,
});

const tnum: CSSProperties = { fontVariantNumeric: "tabular-nums" };

const moduleStyle: CSSProperties = {
  background: t.module,
  border: `1px solid ${t.moduleBorder}`,
  borderRadius: 8,
  boxShadow: t.moduleShadow,
  boxSizing: "border-box",
  minWidth: 0,
};

/** A row of a wide column and a side column, as the board lays both rows out; one column below 1024 (UI-P97). */
const pair = (stacked: boolean): CSSProperties => trackRow(stacked, 48);
const wide = (stacked: boolean): CSSProperties => mainStyle(stacked, { flex: "999 1 640px", minWidth: 0 });
const side: CSSProperties = { flex: "1 0 300px", maxWidth: 340, minWidth: 0 };

/* ── the hero ── */

/** One item of the action dock: 28 high, `0 12px`, 12.5/500, text only. */
function DockItem({
  label,
  first,
  phone,
  height,
  onClick,
  to,
  testId,
}: {
  label: string;
  first: boolean;
  phone: boolean;
  /** The item's height on a desktop: 28 on the hero's well, 30 in the thread's title block. A phone's is 44. */
  height: number;
  onClick?: () => void;
  to?: string;
  testId: string;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement & HTMLAnchorElement>();
  const style = dockItemStyle(first, phone, height, state);
  if (to) {
    return (
      <Link to={to} data-testid={testId} {...handlers} style={style}>
        {label}
      </Link>
    );
  }
  return (
    <button type="button" data-testid={testId} onClick={onClick} {...handlers} style={style}>
      {label}
    </button>
  );
}

/** A dock item's paint: 28 high (30 inline, 44 on a phone), text only, a control border between items. */
function dockItemStyle(first: boolean, phone: boolean, height: number, state: { hovered?: boolean; focusVisible?: boolean }): CSSProperties {
  return {
    appearance: "none",
    boxSizing: "border-box",
    height: phone ? 44 : height,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 12px",
    margin: 0,
    border: 0,
    borderLeft: first ? 0 : `1px solid ${t.controlBorder}`,
    background: state.hovered ? t.controlOn : "transparent",
    ...text(12.5, 500, t.text),
    whiteSpace: "nowrap",
    textDecoration: "none",
    cursor: "pointer",
    minWidth: 0,
    ...ring(state.focusVisible),
  };
}

export const DOWNLOAD_COPY = {
  build: "The build",
  setup: "The setup, as a folder",
} as const;

/** CA-04 P4: Download as a menu once the build has a session setup: the build as before, or the setup as a folder. */
function DownloadMenu({ phone, height, onBuild, onSetup }: { phone: boolean; height: number; onBuild: () => void; onSetup: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <button type="button" data-testid="build-download" aria-haspopup="menu" {...handlers} style={dockItemStyle(false, phone, height, state)}>
          Download
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={4} style={menuSurface()}>
          <Menu.Item onSelect={onBuild} style={menuItem(true, phone)}>
            {DOWNLOAD_COPY.build}
          </Menu.Item>
          <Menu.Item onSelect={onSetup} style={menuItem(true, phone)}>
            {DOWNLOAD_COPY.setup}
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** Copy for AI, Download, Rebuild, Lineage: one control-recipe group on the hero, or the row under it on a phone. */
function ActionDock({
  actions,
  phone,
  announce,
  inline = false,
}: {
  actions: BuildActionsView;
  phone: boolean;
  announce: (text: string) => void;
  /** In the flow, at the right of the thread's title block, rather than laid over the hero's well. */
  inline?: boolean;
}) {
  const [, confirmCopied] = useConfirmed();
  const copy = async () => {
    if (await actions.onCopyForAI()) {
      confirmCopied();
      announce("Copied");
    }
  };
  const frame: CSSProperties = phone
    ? { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }
    : inline
      ? { display: "inline-flex", flexShrink: 0 }
      : { position: "absolute", right: 16, top: 12, display: "inline-flex" };
  const height = inline ? 30 : 28;
  return (
    <div
      data-testid="build-action-dock"
      role="group"
      aria-label="Take this build"
      style={{ ...frame, ...CONTROL, borderRadius: 6, overflow: "hidden", boxSizing: "border-box" }}
    >
      <DockItem label="Copy for AI" first phone={phone} height={height} onClick={() => void copy()} testId="build-copy-for-ai" />
      {actions.onDownloadSetup ? (
        <DownloadMenu phone={phone} height={height} onBuild={actions.onDownload} onSetup={actions.onDownloadSetup} />
      ) : (
        <DockItem label="Download" first={false} phone={phone} height={height} onClick={actions.onDownload} testId="build-download" />
      )}
      <DockItem label="Rebuild" first={false} phone={phone} height={height} onClick={actions.onRebuild} testId="build-rebuild" />
      <DockItem label="Lineage" first={false} phone={phone} height={height} to={actions.lineageTo} testId="build-lineage" />
      {actions.compareTo ? <DockItem label="Compare with the original" first={false} phone={phone} height={height} to={actions.compareTo} testId="build-compare" /> : null}
    </div>
  );
}

/** The credit under the title: "made by @maya", or the rebuild's source first. No italics under the refined look. */
function Credit({ credit }: { credit: BuildCreditView }) {
  const madeBy = credit.madeBy ? (
    <>
      made by <span style={{ color: t.text2 }}>{credit.madeBy}</span>
    </>
  ) : null;
  if (credit.rebuiltFrom) {
    const by = credit.rebuiltFrom.handle ? ` by @${credit.rebuiltFrom.handle}` : "";
    return (
      <>
        Rebuilt from <span style={{ color: t.text2 }}>{credit.rebuiltFrom.title}</span>
        {by}
        {madeBy ? <> · {madeBy}</> : null}
      </>
    );
  }
  return madeBy;
}

function Hero({
  hero,
  actions,
  proof,
  phone,
  now,
  announce,
}: {
  hero: BuildHeroView;
  actions: BuildActionsView;
  proof: BuildProofView;
  phone: boolean;
  now?: number;
  announce: (text: string) => void;
}) {
  const stacked = !useMinWidth(BETWEEN.stack);
  const tag = `${hero.shape}${hero.viaConnector ? " · via connector" : ""}`;
  const lamp = plaqueState(proof.build, now);
  const credit = <Credit credit={hero.credit} />;
  return (
    <section
      data-testid="build-hero"
      aria-label="The build"
      style={{ ...moduleStyle, ...(phone ? null : wide(stacked)), padding: 0, overflow: "hidden" }}
    >
      <div
        style={{
          position: "relative",
          height: 280,
          background: t.well,
          backgroundImage: `radial-gradient(${t.dotGrid} 1px, transparent 1px)`,
          backgroundSize: "16px 16px",
          borderBottom: `1px solid ${t.moduleBorder}`,
        }}
      >
        {lamp === "unreproduced" ? null : <PictureLight dim={lamp === "stale"} />}
        <ResultWindow label={`${hero.title} · Result`} style={{ position: "absolute", left: "calc(50% - 152px)", top: 64 }}>
          {hero.cover}
        </ResultWindow>
        {hero.shape ? (
          <span
            data-testid="build-shape-tag"
            style={{
              position: "absolute",
              left: 16,
              top: 16,
              display: "inline-flex",
              alignItems: "center",
              height: 20,
              padding: "0 6px",
              boxSizing: "border-box",
              borderRadius: 4,
              background: t.tagFill,
              ...text(11.5, 400, t.onTag),
              whiteSpace: "nowrap",
            }}
          >
            {tag}
          </span>
        ) : null}
        {phone ? null : <ActionDock actions={actions} phone={false} announce={announce} />}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: 16 }}>
        <span
          aria-hidden="true"
          style={{
            ...CONTROL,
            width: 44,
            height: 44,
            flexShrink: 0,
            boxSizing: "border-box",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 8,
            color: t.text,
          }}
        >
          <Mark size={24} />
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <h1 style={{ ...text(20, 500, t.text), margin: 0, letterSpacing: "-0.015em", overflowWrap: "anywhere" }}>{hero.title}</h1>
          <SummaryLine summary={hero.summary} />
          {hero.outcome ? (
            <p style={{ ...text(13, 400, t.text2), margin: 0, maxWidth: 680, lineHeight: "20px" }}>{hero.outcome}</p>
          ) : null}
          {hero.credit.madeBy || hero.credit.rebuiltFrom ? <p style={{ ...text(12, 400, t.label), margin: 0 }}>{credit}</p> : null}
          {hero.delta ? <p style={{ ...text(12, 400, t.label), margin: 0 }}>{hero.delta}</p> : null}
        </div>
      </div>
    </section>
  );
}

/* ── the hero with the maker's thread (PT-08) ── */

/** The thread's content column is no wider than this. */
const THREAD_COLUMN = 700;
/** The author column, and the space between it and the content. */
const AUTHOR_COLUMN = 40;
const AUTHOR_GAP = 12;

const ellipsis: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

/**
 * A build that has a thread opens with it: the title block and its line, then the maker's posts the way a thread reads,
 * every one open, then the engagement row. No well and no result window; the posts carry the pictures.
 */
function ThreadHero({
  hero,
  thread,
  actions,
  phone,
  announce,
}: {
  hero: BuildHeroView;
  thread: BuildThreadView;
  actions: BuildActionsView;
  phone: boolean;
  announce: (text: string) => void;
}) {
  const { maker } = hero;
  const { follow } = thread;
  const rebuilt = Boolean(hero.credit.rebuiltFrom);
  const handle = (maker?.handle ?? "").trim();
  const name = (maker?.name ?? "").trim() || handle || "Maker";
  const profileHref = handle ? `/profile/${encodeURIComponent(handle)}` : null;
  const tag = `${hero.shape}${hero.viaConnector ? " · via connector" : ""}`;
  const columns: CSSProperties = { display: "grid", gridTemplateColumns: `${AUTHOR_COLUMN}px minmax(0, 1fr)`, columnGap: AUTHOR_GAP };

  const nameNode = profileHref ? (
    <Link
      to={profileHref}
      data-testid="build-author-name"
      style={{ color: t.text, textDecoration: "none", ...(phone ? { display: "inline-flex", alignItems: "center", minHeight: 44 } : null) }}
    >
      {name}
    </Link>
  ) : (
    <span data-testid="build-author-name">{name}</span>
  );

  return (
    <section data-testid="build-hero" data-hero="thread" aria-label="The build" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div
        data-testid="build-title-block"
        style={{
          display: "flex",
          flexDirection: phone ? "column" : "row",
          flexWrap: phone ? "nowrap" : "wrap",
          alignItems: phone ? "stretch" : "flex-start",
          justifyContent: "space-between",
          gap: 16,
          paddingBottom: 20,
          borderBottom: `1px solid ${t.hairline}`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 320px", minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 8, rowGap: 4 }}>
            <h1 style={{ ...text(20, 500, t.text), margin: 0, letterSpacing: "-0.015em", overflowWrap: "anywhere" }}>{hero.title}</h1>
            {hero.shape ? (
              <span
                data-testid="build-shape-tag"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: 20,
                  padding: "0 6px",
                  boxSizing: "border-box",
                  borderRadius: 4,
                  background: t.tagFill,
                  ...text(11.5, 400, t.onTag),
                  whiteSpace: "nowrap",
                }}
              >
                {tag}
              </span>
            ) : null}
          </div>
          <SummaryLine summary={hero.summary} />
          {hero.outcome ? <p style={{ ...text(13, 400, t.text2), margin: 0, maxWidth: 680, lineHeight: "20px" }}>{hero.outcome}</p> : null}
          {/* An original build's author row carries the credit; a rebuild keeps its source line. */}
          {rebuilt ? <p style={{ ...text(12, 400, t.label), margin: 0 }}><Credit credit={hero.credit} /></p> : null}
          {hero.delta ? <p style={{ ...text(12, 400, t.label), margin: 0 }}>{hero.delta}</p> : null}
        </div>
        <ActionDock actions={actions} phone={phone} announce={announce} inline />
      </div>

      <div data-testid="build-thread" style={{ ...columns, marginTop: 32 }}>
        <div data-testid="build-author-column" style={{ gridColumn: 1, gridRow: "1 / 3", position: "relative", width: AUTHOR_COLUMN }}>
          {maker ? <Avatar size={40} userId={maker.userId} name={name} src={maker.avatarUrl} /> : null}
          <span
            aria-hidden="true"
            data-testid="build-thread-line"
            style={{ position: "absolute", top: 46, bottom: 0, left: 19, width: 2, background: t.hairline }}
          />
        </div>

        <div
          data-testid="build-author-row"
          style={{ gridColumn: 2, gridRow: 1, display: "flex", alignItems: "center", gap: 6, minHeight: phone ? 44 : 30, marginBottom: 4, minWidth: 0, maxWidth: THREAD_COLUMN, whiteSpace: "nowrap" }}
        >
          <span style={{ ...text(15, 500, t.text), fontWeight: 600, flex: "0 100 auto", minWidth: 0, ...ellipsis }}>{nameNode}</span>
          <span style={{ ...text(14, 400, t.label), display: "flex", flex: "0 1 auto", minWidth: 0 }}>
            {handle ? <span style={{ minWidth: 0, ...ellipsis }}>{`@${handle}`}</span> : null}
            {thread.published ? <span style={{ flex: "none", whiteSpace: "pre" }}>{handle ? ` · ${thread.published}` : thread.published}</span> : null}
          </span>
          <span style={{ marginLeft: 2, display: "inline-flex", flex: "none" }}>
            <MadeWithMarks madeWith={hero.madeWith} modelsUsed={hero.modelsUsed} phone={phone} />
          </span>
          {follow ? (
            <Button
              data-testid="build-follow"
              variant="secondary"
              size={30}
              fontSize={13}
              disabled={follow.busy}
              onClick={follow.onToggle}
              style={{ marginLeft: "auto", height: phone ? 44 : 30 }}
            >
              {follow.following ? "Following" : "Follow"}
            </Button>
          ) : null}
        </div>

        <div data-testid="build-posts" style={{ gridColumn: 2, gridRow: 2, minWidth: 0, maxWidth: THREAD_COLUMN }}>
          {/* CA-07: a picture in the post opens full screen. */}
          <MediaViewerProvider>
            {thread.refs ? (
              <PostRefsProvider value={thread.refs}>
                <PostThread posts={thread.posts} mediaById={thread.mediaById} srcByPath={thread.srcByPath} mode="page" phone={phone} resetKey={thread.build.id} />
              </PostRefsProvider>
            ) : (
              <PostThread posts={thread.posts} mediaById={thread.mediaById} srcByPath={thread.srcByPath} mode="page" phone={phone} resetKey={thread.build.id} />
            )}
          </MediaViewerProvider>
        </div>
      </div>

      <div style={{ ...columns, marginTop: 12 }}>
        <div style={{ gridColumn: 2, minWidth: 0 }}>
          <EngagementRow
            build={thread.build}
            counts={thread.engagement.counts}
            liked={thread.engagement.liked}
            saved={thread.engagement.saved}
            variant="page"
            withRebuild
            style={{ maxWidth: 560 }}
          />
        </div>
      </div>
    </section>
  );
}

/* ── the reproduction column ── */

function CompletenessModule({ completeness }: { completeness: CompletenessView }) {
  const { score, publishAt, galleryAt, next } = completeness;
  const ticks: StripedBarTick[] =
    publishAt === galleryAt
      ? [{ at: galleryAt, colour: t.label, label: `Gallery ${galleryAt}` }]
      : [
          { at: publishAt, colour: t.label, label: `Publish ${publishAt}` },
          { at: galleryAt, colour: t.label, label: `Gallery ${galleryAt}` },
        ];
  return (
    <div data-testid="build-completeness" style={{ ...moduleStyle, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <span style={{ ...text(13, 500, t.text), flexGrow: 1 }}>Completeness</span>
        <span style={text(13, 500, t.text, tnum)}>
          {score} <span style={{ color: t.label, fontWeight: 400 }}>/ 100</span>
        </span>
      </div>
      <StripedBar
        value={score}
        colour={t.evidence}
        height={11}
        ticks={ticks}
        label="Completeness"
        valueText={`${score} of 100. Publishing needs ${publishAt}, the gallery ${galleryAt}.`}
      />
      {next ? (
        <p style={{ ...text(12, 400, t.text2), margin: 0, paddingTop: 12, borderTop: `1px solid ${t.hairlineModule}` }}>Next: {next}.</p>
      ) : null}
    </div>
  );
}

function Proof({ proof, phone, now, inColumn = false }: { proof: BuildProofView; phone: boolean; now?: number; inColumn?: boolean }) {
  const count = proof.build.reproduction_count ?? 0;
  const { action } = proof;
  const stacked = !useMinWidth(BETWEEN.stack);
  return (
    <section data-testid="build-proof" aria-label="Reproduction" style={{ ...(phone || inColumn ? null : mainStyle(stacked, side)), display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Eyebrow>Reproduction</Eyebrow>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ ...figure, fontSize: 32, lineHeight: "normal", letterSpacing: "-0.03em", color: t.text }}>
            {count.toLocaleString("en-GB")}
          </span>
          <span style={text(13, 400, t.text2)}>ran it</span>
          <span style={{ flexGrow: 1 }} />
          {proof.lastRun ? <span style={text(12, 400, t.label)}>last {proof.lastRun}</span> : null}
        </div>
        <Plaque build={proof.build} size="proof" wording={phone ? "short" : undefined} now={now} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Button
          data-testid="build-proof-action"
          data-action={action.kind}
          variant="primary"
          size={phone ? 48 : 36}
          fontSize={13}
          fullWidth
          disabled={action.pending}
          onClick={action.onPress}
        >
          {action.pending ? "Recording…" : ACTION_LABEL[action.kind]}
        </Button>
        <p style={{ ...text(12, 400, t.text2), margin: 0, lineHeight: "18px" }}>{NOTE}</p>
      </div>
      {proof.writeError ? <RunFailed failure={proof.writeError} /> : null}
      {proof.details.length > 0 ? (
        <div style={{ ...moduleStyle, padding: "4px 16px" }}>
          {proof.details.map((detail, index) => (
            <Row
              key={detail.label}
              label={detail.label}
              value={detail.value}
              inModule
              style={index === proof.details.length - 1 ? { borderBottom: 0 } : undefined}
            />
          ))}
        </div>
      ) : null}
      {proof.completeness ? <CompletenessModule completeness={proof.completeness} /> : null}
    </section>
  );
}

/* ── The build and What you need ── */

const BUILD_PANEL = "build-tabpanel";

/** The tabs and The build. Exported for the dev page's Map board (UI-P91), which draws it on a bare surface. */
export function BuildPanel({
  viewer,
  steps,
  phone,
  announce,
  inColumn = false,
}: {
  viewer: BuildViewerView;
  steps: BuildStepsView;
  phone: boolean;
  announce: (text: string) => void;
  /** Inside the thread layout's left column, which sizes it: no flex basis of its own. */
  inColumn?: boolean;
}) {
  const onSteps = viewer.tab === "anatomy";
  const stacked = !useMinWidth(BETWEEN.stack);
  return (
    <div data-testid="build-steps-panel" style={{ ...(phone || inColumn ? null : wide(stacked)), display: "flex", flexDirection: "column", gap: 16 }}>
      {phone ? null : (
        <UnderlineTabs
          label="Sections of this build"
          fontSize={13}
          tabs={viewer.tabs.map((tab) => ({ ...tab, id: `build-tab-${tab.value}`, controls: BUILD_PANEL }))}
          value={viewer.tab}
          onChange={viewer.onTabChange}
        />
      )}
      <div role="tabpanel" id={BUILD_PANEL} aria-labelledby={`build-tab-${viewer.tab}`} style={{ minWidth: 0 }}>
        {onSteps ? <StepsList view={steps} phone={phone} announce={announce} /> : viewer.content}
      </div>
    </div>
  );
}

/** What you need, with the dialog an "Other parts" row opens its own body in. */
function StepsNeed({ steps, phone, inColumn = false }: { steps: BuildStepsView; phone: boolean; inColumn?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const stacked = !useMinWidth(BETWEEN.stack);
  const row = open ? steps.need.flatMap((group) => group.rows).find((candidate) => candidate.id === open) : undefined;
  return (
    <div
      style={
        phone
          ? { minWidth: 0 }
          : inColumn
            ? /* Under the reproduction in the right column: full width of it, with a hairline on top. */
              asideStyle(true, side)
            : /* Content-box, as the board: 340 of column, then its 32 of padding and the hairline; under 1024 it drops under The build. */
            asideStyle(stacked, { ...side, boxSizing: "content-box", paddingLeft: 32, borderLeft: `1px solid ${t.hairline}` })
      }
    >
      <NeedPanel view={steps} onOpenOther={setOpen} />
      <AnatomyDialog open={Boolean(open)} onOpenChange={(next) => !next && setOpen(null)} title={row?.title ?? "Part"}>
        {open ? steps.otherBody(open) : null}
      </AnatomyDialog>
    </div>
  );
}

/* ── desktop ── */

function DesktopBuild(props: BuildViewProps) {
  const { now, hero, actions, proof, anatomy, viewer, timeline, steps } = props;
  const tier = useWidthTier();
  const stacked = tier === "stacked";
  const { announce, region } = useAnnouncer();

  /* PT-08: with a thread the left column is the title block, the thread, the actions and, 32 under them, The build; the
     right column is the reproduction and What you need. The two sit at the row's two edges. Stacked, the order is the
     page's own: hero, reproduction, The build, What you need. */
  return (
    <div data-testid="build-view" data-viewport="desktop" style={{ display: "flex", flexDirection: "column", gap: 32, marginTop: 8, lineHeight: "normal" }}>
      {hero.thread ? (
        <div data-testid="build-thread-row" style={{ ...pair(stacked), justifyContent: "space-between" }}>
          {stacked ? (
            <>
              <ThreadHero hero={hero} thread={hero.thread} actions={actions} phone={false} announce={announce} />
              <Proof proof={proof} phone={false} now={now} />
              {steps ? <BuildPanel viewer={viewer} steps={steps} phone={false} announce={announce} /> : null}
              {steps ? <StepsNeed steps={steps} phone={false} /> : null}
            </>
          ) : (
            <>
              <div style={{ ...wide(false), display: "flex", flexDirection: "column", gap: 32 }}>
                <ThreadHero hero={hero} thread={hero.thread} actions={actions} phone={false} announce={announce} />
                {steps ? <BuildPanel viewer={viewer} steps={steps} phone={false} announce={announce} inColumn /> : null}
              </div>
              <div style={{ ...side, display: "flex", flexDirection: "column", gap: 32 }}>
                <Proof proof={proof} phone={false} now={now} inColumn />
                {steps ? <StepsNeed steps={steps} phone={false} inColumn /> : null}
              </div>
            </>
          )}
        </div>
      ) : (
        <div style={pair(stacked)}>
          <Hero hero={hero} actions={actions} proof={proof} phone={false} now={now} announce={announce} />
          <Proof proof={proof} phone={false} now={now} />
        </div>
      )}
      {steps ? (
        hero.thread ? null : (
          <div data-testid="build-second-row" style={pair(stacked)}>
            <BuildPanel viewer={viewer} steps={steps} phone={false} announce={announce} />
            <StepsNeed steps={steps} phone={false} />
          </div>
        )
      ) : (
        <div style={{ ...bottomRow(tier), gap: 16 }}>
          <div style={{ minHeight: 0 }}>
            <AnatomyPanel anatomy={anatomy} phone={false} onSelect={anatomy.onSelect} />
          </div>
          <div style={{ minHeight: 0, minWidth: 0 }}>
            <Viewer viewer={viewer} part={selectedPart(anatomy)} phone={false} announce={announce} />
          </div>
          <div style={{ minHeight: 0, ...dropped(tier) }}>
            <TimelinePanel timeline={timeline} phone={false} onPlay={timeline.onPlay} />
          </div>
        </div>
      )}
      {region}
    </div>
  );
}

/* ── phone ── */

function PhoneBuild(props: BuildViewProps) {
  const { now, hero, actions, proof, anatomy, viewer, timeline, steps } = props;
  const { announce, region } = useAnnouncer();
  const viewerRef = useRef<HTMLDivElement>(null);

  /* The viewer is below the tabs and the anatomy: whatever changes it brings it into view. */
  const reveal = () => viewerRef.current?.scrollIntoView?.({ behavior: scrollBehavior(), block: "nearest" });

  let lower: ReactNode;
  if (steps) {
    lower = (
      <>
        <BuildPanel viewer={viewer} steps={steps} phone announce={announce} />
        <StepsNeed steps={steps} phone />
      </>
    );
  } else {
    lower = (
      <>
        <AnatomyPanel
          anatomy={anatomy}
          phone
          onSelect={(id) => {
            anatomy.onSelect(id);
            reveal();
          }}
        />
        <div ref={viewerRef} role="tabpanel" id="build-tabpanel" aria-labelledby={`build-tab-${viewer.tab}`} style={{ scrollMarginTop: 72 }}>
          <Viewer viewer={viewer} part={selectedPart(anatomy)} phone announce={announce} />
        </div>
        <TimelinePanel
          timeline={timeline}
          phone
          onPlay={() => {
            timeline.onPlay();
            viewerRef.current?.scrollIntoView?.({ behavior: scrollBehavior(), block: "start" });
          }}
        />
      </>
    );
  }

  return (
    <div data-testid="build-view" data-viewport="mobile" style={{ display: "flex", flexDirection: "column", gap: 16, lineHeight: "normal", minWidth: 0 }}>
      {hero.thread ? (
        <ThreadHero hero={hero} thread={hero.thread} actions={actions} phone announce={announce} />
      ) : (
        <>
          <Hero hero={hero} actions={actions} proof={proof} phone now={now} announce={announce} />
          <ActionDock actions={actions} phone announce={announce} />
        </>
      )}
      <Proof proof={proof} phone now={now} />
      <ScrollRow gap={6} label="Sections of this build" tablist>
        {viewer.tabs.map((tab) => (
          <FilterChip
            key={tab.value}
            label={tab.label}
            on={tab.value === viewer.tab}
            tab={{ id: `build-tab-${tab.value}`, controls: "build-tabpanel" }}
            onClick={() => {
              viewer.onTabChange(tab.value);
              if (!steps) reveal();
            }}
          />
        ))}
      </ScrollRow>
      {lower}
      {region}
    </div>
  );
}

export function BuildView(props: BuildViewProps) {
  const phone = useIsPhone();
  // CA-03 P8: the line under the title, from what the build holds.
  const summary = props.hero.summary ?? (props.steps ? buildSummary(props.steps.steps.map((entry) => entry.step)) : "");
  const view = { ...props, hero: { ...props.hero, summary } };
  return phone ? <PhoneBuild {...view} /> : <DesktopBuild {...view} />;
}

/**
 * CA-03 P8: what kind of build it is, directly under the title: 12.5 `--text2`, one line, cut with an ellipsis at the
 * column's width and said in full in its `title`. Nothing when the build holds nothing but a title.
 */
function SummaryLine({ summary }: { summary: string | undefined }) {
  if (!summary) return null;
  return (
    <p data-testid="build-summary" title={summary} style={{ ...text(12.5, 400, t.text2), margin: 0, minWidth: 0, maxWidth: "100%", ...ellipsis }}>
      {summary}
    </p>
  );
}

export default BuildView;
