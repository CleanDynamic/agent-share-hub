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

import { mappedHarnesses } from "@/lib/build/harnessMap";
import { useRef, useState, type CSSProperties, type ReactNode, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import * as Menu from "@radix-ui/react-dropdown-menu";

import { Avatar } from "@/components/brand/Avatar";
import { Button } from "@/components/brand/Button";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { FilterChip } from "@/components/brand/FilterChip";
import { ResultWindow } from "@/components/brand/FramedWork";
import { Row } from "@/components/brand/Row";
import { SectionHead } from "@/components/vision/SectionHead";
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
} from "@/components/shell/useMinWidth";
import { EngagementRow } from "@/components/social/EngagementRow";
import { ring, touchArea } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { scrollBehavior } from "@/lib/theme/motion";
import { PRIMARY, controlPaint } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, DM_MONO } from "@/lib/theme/type";

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
import { BeforeYouSendPanel } from "./BeforeYouSend";
import { DetailsGroup, NeedPanel, StepsList, stepDomId, toolLookup } from "./BuildSteps";
import { menuItem, menuSurface } from "../compose/refinedStyles";
import { buildSummary } from "@/lib/build/buildSummary";
import { buildPatterns, patternsLine } from "@/lib/build/patterns";
import * as Dialog from "@radix-ui/react-dialog";
import { Maximize2, Play, X } from "lucide-react";
import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";
import { PageEmpty, PageState } from "@/components/pagestate/PageState";
import type { ReadLike } from "@/components/pagestate/pageStateModel";
import { WAY_OUT, DONE } from "@/lib/copy/copy";
import { IconButton } from "@/components/brand/IconButton";
import { Panel, PanelHead } from "@/components/brand/Panel";
import { PartViewer } from "@/components/brand/PartViewer";
import { Timeline } from "@/components/brand/Timeline";
import { type PageFit } from "@/components/shell/siteFrameFit";
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
  /** CA-16 P7: the Classification section, drawn under the hero. Absent: nothing, and the page is exactly as it was. */
  classification?: ReactNode;
  /** UX-07 P2: Discussed in OpenBuilds, drawn after the classification. Absent: nothing. */
  discussed?: ReactNode;
}

export { BOTTOM_ROW, BuildViewSkeleton, dropped, HERO_ROW, heroRow, bottomRow, MOCK_ROWS, ProofSkeleton } from "./BuildViewSkeleton";
import { creditLine } from "@/lib/build/contributors";
import { dropped, bottomRow, wide } from "./BuildViewSkeleton";
import { PAGE_TITLE, WORK_TITLE } from "@/components/shell/PageHeader";
import { PANEL_GUTTER, PANEL_RADIUS } from "@/components/shell/chromeSize";
import { useColumnPanels } from "@/components/shell/frameChrome";
import { pageColumns, panelColumns } from "@/components/shell/pageGrid";

/** The phone shows this many parts before "Show n more parts". */
export const PHONE_PARTS = 6;

/** UX-03 P2: under the reader's action, what `recordReproduction` writes. */
/** UX-03 P2: under the maker's Re-confirm, what `recordSelfConfirmation` writes. */

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
  const meta = part.gap ? "left open" : part.meta;

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
        /* A part is a control: 46 drawn on a phone, held at the 44px touch floor; a one-line row's 32 above it. */
        ...(part.gap ? (phone ? { minHeight: 44 } : { height: 32 }) : phone ? { minHeight: 42 } : { height: 30 }),
        padding: part.gap ? "0 8px" : "0 7px",
        borderRadius: r.control,
        /* Longhands: a shorthand holding a var() is one declaration some engines drop whole. */
        borderWidth: part.gap ? 1.5 : 1,
        borderStyle: part.gap ? "dashed" : "solid",
        borderColor: selected ? t.selectedEdge : part.gap ? t.catBreakage : "transparent",
        background: "transparent",
        color: t.text,
        textAlign: "left",
        cursor: "pointer",
        ...ring(state.focusVisible),
      }}
    >
      <span style={{ fontFamily: FIGTREE, fontSize: 15, fontWeight: 500, lineHeight: 1.05, letterSpacing: "-0.02em", color: t.label }}>{String(part.number).padStart(2, "0")}</span>
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
            fontSize: phone ? 13 : 13,
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
        <span style={{ fontFamily: DM_MONO, fontSize: 13, color: part.gap ? t.catBreakage : t.text2 }}>{meta}</span>
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
        <Dialog.Overlay data-motion="scrim" style={{ position: "fixed", inset: 0, background: t.sheetDim, zIndex: 40 }} />
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
            background: t.window,
            border: `1px solid ${t.windowBorder}`,
            boxShadow: t.shadowSheet,
            color: t.text,
            fontFamily: FIGTREE,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Dialog.Title style={{ margin: 0, fontFamily: FIGTREE, fontSize: 15, fontWeight: 500, color: t.text }}>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton icon={X} label="Close" size={32} />
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
              <IconButton icon={Maximize2} label="Show the full anatomy" size={32} onClick={() => setOpen(true)} disabled={parts.length === 0} />
            )
          }
        />
        {parts.length === 0 ? (
          <PageEmpty line="This build has no parts yet." testId="build-anatomy-empty" />
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
              fontSize: 13,
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
    if (await viewer.onCopy()) announce(DONE.copied);
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
          right={<IconButton icon={Play} label="Play the build" size={phone ? 38 : 32} onClick={onPlay} disabled={events.length === 0} style={touchArea(phone, true)} />}
        />
        <div style={{ marginTop: 8 }}>
          {events.length > 0 ? (
            <Timeline events={events} size={phone ? "phone" : "desktop"} label="Kept steps" />
          ) : (
            <PageEmpty line="No events were kept for this build." testId="build-timeline-empty" style={{ padding: "12px 0" }} />
          )}
        </div>
      </div>
    </Panel>
  );
}

export const selectedPart = (anatomy: BuildAnatomyView): PartRowView | null =>
  anatomy.parts.find((part) => part.id === anatomy.selectedId) ?? anatomy.parts[0] ?? null;

/**
 * G4, G7, G8: the record did not load, or there is no build at this address. Inside the page's panel, under the page's kind
 * as its title ("Build": the build's own title is what did not load), PageState says which: "Couldn't load this build. Try
 * again." or "Nothing at this address." with Browse builds.
 */
export function BuildViewState({ read }: { read: ReadLike }) {
  return (
    <Panel padding="24px 24px">
      <h1 style={{ ...PAGE_TITLE, marginBottom: 16 }}>Build</h1>
      <PageState read={read} thing="this build" region="The build" skeleton={null} notFound={{ when: ([record]) => record === null, kind: "build", way: WAY_OUT.browseBuilds }}>
        {() => null}
      </PageState>
    </Panel>
  );
}

/* ── type and recipes ── */

const text = (px: number, weight: 400 | 500 | 600, color: string, extra: CSSProperties = {}): CSSProperties => ({
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

/* The rows of a wide column and a side column (`pair`, `wide`, `side`) are in BuildViewSkeleton.tsx, so the skeleton draws the same boxes. */

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
  primary = false,
}: {
  label: string;
  first: boolean;
  phone: boolean;
  /** Rebuild: the main button. */
  primary?: boolean;
  /** The item's height on a desktop: 28 on the hero's well, 30 in the thread's title block. A phone's is 44. */
  height: number;
  onClick?: () => void;
  to?: string;
  testId: string;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement & HTMLAnchorElement>();
  const style = dockItemStyle(first, phone, height, state, primary);
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

/** Synth 08: an action is a pill, 32 high (44 on a phone), `0 14px`, 13/600: Rebuild is the main button, the rest are secondary. */
function dockItemStyle(_first: boolean, phone: boolean, height: number, state: { hovered?: boolean; focusVisible?: boolean }, primary = false): CSSProperties {
  return {
    appearance: "none",
    boxSizing: "border-box",
    height: phone ? 44 : height,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 14px",
    margin: 0,
    borderRadius: 16,
    ...(primary ? { ...PRIMARY, ...(state.hovered ? { filter: "brightness(1.08)" } : null) } : { ...controlPaint({ hovered: state.hovered }), color: t.text }),
    ...text(13, 600, primary ? t.onBrandAccent : t.text),
    whiteSpace: "nowrap",
    textDecoration: "none",
    cursor: "pointer",
    minWidth: 0,
    flexShrink: 0,
    ...ring(state.focusVisible),
  };
}

export const DOWNLOAD_COPY = {
  build: "The build",
  setup: "The setup, as a folder",
  /** SV-28 P8: the same folder in another harness's layout. */
  rebuildIn: "Rebuild in",
  setupFor: (name: string) => `The setup for ${name}`,
} as const;

/** CA-04 P4: Download as a menu once the build has a session setup: the build as before, or the setup as a folder. */
function DownloadMenu({ phone, height, onBuild, onSetup }: { phone: boolean; height: number; onBuild: () => void; onSetup: (harness?: string) => void }) {
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
          <Menu.Item onSelect={() => onSetup()} style={menuItem(true, phone)}>
            {DOWNLOAD_COPY.setup}
          </Menu.Item>
          <Menu.Label style={{ ...menuItem(false, phone), cursor: "default" }}>{DOWNLOAD_COPY.rebuildIn}</Menu.Label>
          {mappedHarnesses()
            .filter((entry) => entry.harness !== "claude-code")
            .map((entry) => (
              <Menu.Item key={entry.harness} onSelect={() => onSetup(entry.harness)} style={menuItem(true, phone)}>
                {DOWNLOAD_COPY.setupFor(entry.name)}
              </Menu.Item>
            ))}
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
  /** Kept so callers compile; the group is always in the flow now. */
  inline?: boolean;
}) {
  const [, confirmCopied] = useConfirmed();
  const copy = async () => {
    if (await actions.onCopyForAI()) {
      confirmCopied();
      announce(DONE.copied);
    }
  };
  const frame: CSSProperties = phone ? { display: "flex", flexWrap: "wrap", gap: 8 } : { display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" };
  const height = 32;
  return (
    <div
      data-testid="build-action-dock"
      role="group"
      aria-label="Take this build"
      style={{ ...frame, boxSizing: "border-box" }}
    >
      <DockItem label="Rebuild" first phone={phone} height={height} onClick={actions.onRebuild} testId="build-rebuild" primary />
      <DockItem label="Copy for AI" first={false} phone={phone} height={height} onClick={() => void copy()} testId="build-copy-for-ai" />
      {actions.onDownloadSetup ? (
        <DownloadMenu phone={phone} height={height} onBuild={actions.onDownload} onSetup={actions.onDownloadSetup} />
      ) : (
        <DockItem label="Download" first={false} phone={phone} height={height} onClick={actions.onDownload} testId="build-download" />
      )}
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
  phone,
  announce,
}: {
  hero: BuildHeroView;
  actions: BuildActionsView;
  phone: boolean;
  announce: (text: string) => void;
}) {
  // UX-03 P2: no cover media, no picture area: the title block alone.
  const pictured = hero.hasCover !== false;
  return (
    <section data-testid="build-hero" data-pictured={pictured ? "true" : "false"} aria-label="The build" style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
      <TitleBlock hero={hero} actions={actions} phone={phone} announce={announce} />
      {pictured ? (
        <div
          data-testid="build-hero-picture"
          style={{
            position: "relative",
            height: 280,
            borderRadius: 12,
            background: t.well,
            backgroundImage: `radial-gradient(${t.dotGrid} 1px, transparent 1px)`,
            backgroundSize: "16px 16px",
            overflow: "hidden",
          }}
        >
          <ResultWindow label={`${hero.title} · Result`} style={{ position: "absolute", left: "calc(50% - 152px)", top: 64 }}>
            {hero.cover}
          </ResultWindow>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Synth 08: the head of the main panel. The build's title is the page's h1, Geist Serif 31/36; under it the maker ("Sun Tzu"
 * 15/600, then "@suntzu · published 19 Nov" 15 Text 3) and, for a rebuild, its source; at the right the actions, which wrap
 * under the title below 1101 and run full width on a phone, Rebuild first.
 */
function TitleBlock({ hero, thread, actions, phone, announce }: { hero: BuildHeroView; thread?: BuildThreadView; actions: BuildActionsView; phone: boolean; announce: (text: string) => void }) {
  const { maker } = hero;
  const follow = thread?.follow;
  const rebuilt = Boolean(hero.credit.rebuiltFrom);
  const handle = (maker?.handle ?? "").trim();
  const name = (maker?.name ?? "").trim() || handle || "";
  const profileHref = handle ? `/profile/${encodeURIComponent(handle)}` : null;
  /* SV-16: "with @kit and @dax", the part of the credit line after the maker. */
  const withLine = (maker?.contributors?.length ?? 0) > 0 ? creditLine("", maker?.contributors ?? []).trim() : "";
  const published = thread?.published;
  const nameNode = profileHref ? (
    <Link to={profileHref} data-testid="build-author-name" style={{ color: t.text, textDecoration: "none", ...(phone ? { display: "inline-flex", alignItems: "center", minHeight: 44 } : null) }}>
      {name}
    </Link>
  ) : (
    <span data-testid="build-author-name">{name}</span>
  );
  return (
    <div data-testid="build-title-block" style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      <div style={{ display: "flex", flexDirection: phone ? "column" : "row", flexWrap: phone ? "nowrap" : "wrap", alignItems: phone ? "stretch" : "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 320px", minWidth: 0 }}>
          <h1 style={{ ...WORK_TITLE, overflowWrap: "anywhere" }}>{hero.title}</h1>
          <SummaryLine summary={hero.summary} />
          {hero.outcome ? <p style={{ ...text(15, 400, t.text2), margin: 0, maxWidth: 680, lineHeight: "20px" }}>{hero.outcome}</p> : null}
          {/* An original build's byline carries the credit; a rebuild keeps its source line. */}
          {rebuilt ? <p style={{ ...text(13, 400, t.label), margin: 0 }}><Credit credit={hero.credit} /></p> : null}
          {hero.delta ? <p style={{ ...text(13, 400, t.label), margin: 0 }}>{hero.delta}</p> : null}
          {name || handle || published ? (
            <div data-testid="build-author-row" style={{ display: "flex", alignItems: "center", gap: 8, minHeight: phone ? 44 : 28, marginTop: 8, minWidth: 0, maxWidth: 680, whiteSpace: "nowrap" }}>
              {maker ? <Avatar size={20} userId={maker.userId} name={name || "Maker"} src={maker.avatarUrl} /> : null}
              {name ? <span style={{ ...text(15, 600, t.text), flex: "0 100 auto", minWidth: 0, ...ellipsis }}>{nameNode}</span> : null}
              <span style={{ ...text(15, 400, t.label), display: "flex", flex: "0 1 auto", minWidth: 0 }}>
                {handle ? <span style={{ minWidth: 0, ...ellipsis }}>{`@${handle}`}</span> : null}
                {published ? <span style={{ flex: "none", whiteSpace: "pre" }}>{handle ? ` · published ${published}` : `published ${published}`}</span> : null}
                {withLine ? <span data-testid="build-contributors" style={{ minWidth: 0, whiteSpace: "pre", ...ellipsis }}>{` · ${withLine}`}</span> : null}
              </span>
              {follow ? (
                <Button data-testid="build-follow" variant="secondary" size={phone ? 44 : 32} fontSize={13} disabled={follow.busy} onClick={follow.onToggle} style={{ marginLeft: "auto" }}>
                  {follow.following ? "Following" : "Follow"}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        <ActionDock actions={actions} phone={phone} announce={announce} inline />
      </div>
    </div>
  );
}

/* ── the hero with the maker's thread (PT-08) ── */

const ellipsis: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

/**
 * A build that has a thread opens with it, as three things on the surface and no boxes (grammar 2): the title block
 * (figure, meta, one byline, one action group), then the Post section (its head, the first post open, the rest behind
 * the feed's own toggle, the engagement icons at the end of that row).
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
  const engagement = (
    <EngagementRow
      build={thread.build}
      counts={thread.engagement.counts}
      liked={thread.engagement.liked}
      saved={thread.engagement.saved}
      variant="page"
      compact
    />
  );

  return (
    <section data-testid="build-hero" data-hero="thread" aria-label="The build" style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
      <TitleBlock hero={hero} thread={thread} actions={actions} phone={phone} announce={announce} />

      {/* Synth 08: the post is the feed post, with no heading over it; the thread's "1 of 3 posts · Show more" is its own toggle. */}
      <section data-testid="build-thread" aria-label="Post" style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
        <div data-testid="build-posts" style={{ minWidth: 0, maxWidth: 680 }}>
          {/* CA-07: a picture in the post opens full screen. */}
          <MediaViewerProvider>
            {thread.refs ? (
              <PostRefsProvider value={thread.refs}>
                <PostThread posts={thread.posts} mediaById={thread.mediaById} srcByPath={thread.srcByPath} mode="page" phone={phone} resetKey={thread.build.id} footer={engagement} />
              </PostRefsProvider>
            ) : (
              <PostThread posts={thread.posts} mediaById={thread.mediaById} srcByPath={thread.srcByPath} mode="page" phone={phone} resetKey={thread.build.id} footer={engagement} />
            )}
          </MediaViewerProvider>
        </div>
      </section>
    </section>
  );
}

/* ── the reproduction column ── */

/**
 * UX-03 follow-up P18: Completeness for the maker. The head (`Completeness`, `Visible to you only`), then one module of
 * padding 14, 10 apart: the score and the Gallery line, the bar with no tick, and the next step.
 */
function CompletenessModule({ completeness }: { completeness: CompletenessView }) {
  /* UX-01 P3: publishing is not gated on completeness; it decides Gallery placement only. */
  const { score, galleryAt, next } = completeness;
  return (
    <section data-testid="build-completeness" aria-label="Completeness" style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      <SectionHead headingLevel={2} title="Completeness" meta={<span data-testid="build-completeness-private">Visible to you only</span>} />
      <div style={{ ...moduleStyle, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, ...text(13, 400, t.label, tnum) }}>
          <span style={text(13, 500, t.text, tnum)}>{score}</span>
          <span>{`of 100 · Gallery lists from ${galleryAt}`}</span>
        </div>
        <StripedBar value={score} colour={t.evidence} height={11} label="Completeness" valueText={`${score} of 100. The gallery lists builds at ${galleryAt} or above.`} />
        {next ? <p style={{ ...text(12, 400, t.text2), margin: 0 }}>Next: {next}.</p> : null}
      </div>
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
  /* UX-03 follow-up P14: with Steps the only tab there is no tab bar; the section draws its own head. */
  const manyTabs = viewer.tabs.length > 1;
  return (
    <div data-testid="build-steps-panel" style={{ ...(phone || inColumn ? null : wide(stacked)), display: "flex", flexDirection: "column", gap: 16 }}>
      {phone || !manyTabs ? null : (
        <UnderlineTabs
          label="Sections of this build"
          fontSize={13}
          tabs={viewer.tabs.map((tab) => ({ ...tab, id: `build-tab-${tab.value}`, controls: BUILD_PANEL }))}
          value={viewer.tab}
          onChange={viewer.onTabChange}
        />
      )}
      <div role="tabpanel" id={BUILD_PANEL} aria-labelledby={`build-tab-${viewer.tab}`} style={{ minWidth: 0 }}>
        {onSteps ? <StepsList view={steps} phone={phone} announce={announce} titled={!manyTabs} /> : viewer.content}
      </div>
    </div>
  );
}

/** The side panel's steps part: What you need, with the dialog an "Other parts" row opens its own body in, then Before you send it. */
function StepsNeed({ steps, details }: { steps: BuildStepsView; details?: readonly { label: string; value: string }[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const row = open ? steps.need.flatMap((group) => group.rows).find((candidate) => candidate.id === open) : undefined;
  const toolOf = toolLookup(steps.steps);
  return (
    <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 32 }}>
      <NeedPanel view={steps} onOpenOther={setOpen} details={details} />
      <BeforeYouSendPanel
        steps={steps.steps}
        toolOf={toolOf}
        onSelect={(id) => document.getElementById(stepDomId(id))?.scrollIntoView?.({ behavior: scrollBehavior(), block: "start" })}
      />
      <AnatomyDialog open={Boolean(open)} onOpenChange={(next) => !next && setOpen(null)} title={row?.title ?? "Part"}>
        {open ? steps.otherBody(open) : null}
      </AnatomyDialog>
    </div>
  );
}

/* ── desktop ── */

/** Synth 08: a panel on the page shade: 12 radius, 20 of padding. */
const PANEL: CSSProperties = { background: t.surface, borderRadius: PANEL_RADIUS, minWidth: 0, boxSizing: "border-box", padding: 20 };

/** The side panel's parts, in order: What you need and Before you send it (or the details), then the owner's Completeness. */
function SideParts({ proof, steps }: { proof: BuildProofView; steps?: BuildStepsView }) {
  return (
    <>
      {steps ? <StepsNeed steps={steps} details={proof.details} /> : <DetailsGroup details={proof.details} />}
      {proof.completeness ? <CompletenessModule completeness={proof.completeness} /> : null}
    </>
  );
}

function DesktopBuild(props: BuildViewProps) {
  const { hero, actions, proof, anatomy, viewer, timeline, steps } = props;
  const tier = useWidthTier();
  const { announce, region } = useAnnouncer();
  useColumnPanels(true);
  /* From 1101 the side panel is 340; from 761 to 1100 it is 300 (`panelColumns`). */
  const wideSide = useMinWidth(1101);

  /* One layout, with a thread or without: the main panel holds the title block, the post when there is one, The build and the
     classification; the side panel holds What you need, Before you send it and, for the maker, Completeness. */
  const title = hero.thread ? <ThreadHero hero={hero} thread={hero.thread} actions={actions} phone={false} announce={announce} /> : <Hero hero={hero} actions={actions} phone={false} announce={announce} />;
  return (
    <>
    <div data-testid="build-view" data-viewport="desktop" style={{ display: "flex", flexDirection: "column", gap: PANEL_GUTTER, lineHeight: "normal" }}>
      <div data-testid="build-main-row" style={panelColumns("two", { between: !wideSide })}>
        <div data-testid="build-wide-column" style={{ ...PANEL, display: "flex", flexDirection: "column", gap: 40 }}>
          {title}
          {steps ? <BuildPanel viewer={viewer} steps={steps} phone={false} announce={announce} inColumn /> : null}
          {props.classification}
          {props.discussed}
        </div>
        <aside data-testid="build-side-column" aria-label="What you need" style={{ ...PANEL, display: "flex", flexDirection: "column", gap: 32 }}>
          <SideParts proof={proof} steps={steps} />
        </aside>
      </div>
      {steps ? null : (
        /* From 1280 up the page grid's feed template (3 / 6 / 3), so the right column keeps the upper row's 1072 edge. */
        <div style={tier === "full" ? { ...pageColumns("feed"), rowGap: 16, flexGrow: 1, minHeight: 0 } : { ...bottomRow(tier), gap: 16 }}>
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
    </>
  );
}

/* ── phone ── */

function PhoneBuild(props: BuildViewProps) {
  const { hero, actions, proof, anatomy, viewer, timeline, steps } = props;
  const { announce, region } = useAnnouncer();
  const viewerRef = useRef<HTMLDivElement>(null);
  useColumnPanels(true);

  /* The viewer is below the tabs and the anatomy: whatever changes it brings it into view. */
  const reveal = () => viewerRef.current?.scrollIntoView?.({ behavior: scrollBehavior(), block: "nearest" });

  let lower: ReactNode;
  if (steps) {
    lower = <BuildPanel viewer={viewer} steps={steps} phone announce={announce} />;
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

  /* One column: the head, the post and The build in the main panel, then What you need and Before you send it, then the lower panels. */
  return (
    <div data-testid="build-view" data-viewport="mobile" style={{ display: "flex", flexDirection: "column", gap: PANEL_GUTTER, lineHeight: "normal", minWidth: 0 }}>
      <div style={{ ...PANEL, display: "flex", flexDirection: "column", gap: 24 }}>
        {hero.thread ? <ThreadHero hero={hero} thread={hero.thread} actions={actions} phone announce={announce} /> : <Hero hero={hero} actions={actions} phone announce={announce} />}
        {viewer.tabs.length < 2 && steps ? null : (
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
        )}
        {lower}
        {props.classification}
        {props.discussed}
      </div>
      <aside aria-label="What you need" style={{ ...PANEL, display: "flex", flexDirection: "column", gap: 32 }}>
        <SideParts proof={proof} steps={steps} />
      </aside>
      {region}
    </div>
  );
}

export function BuildView(props: BuildViewProps) {
  const phone = useIsPhone();
  // CA-03 P8: the line under the title, from what the build holds.
  const kind = props.hero.summary ?? (props.steps ? buildSummary(props.steps.steps.map((entry) => entry.step)) : "");
  // CA-13 P12: the patterns it uses, worked out from the build, join the facts line: "Uses a router · Long-running agent".
  const patterns = props.steps ? patternsLine(buildPatterns(props.steps.steps.map((entry) => entry.step), props.steps.groups ?? [])) : "";
  const summary = [kind, patterns].filter(Boolean).join(" · ");
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
    <p data-testid="build-summary" title={summary} style={{ ...text(13, 400, t.text2), margin: 0, minWidth: 0, maxWidth: "100%", ...ellipsis }}>
      {summary}
    </p>
  );
}

export default BuildView;
