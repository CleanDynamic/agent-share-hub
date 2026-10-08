/* UI-P29 — the Build page's first screen, as the reference draws it
   (design/reference/{desktop,mobile}/{noon,dusk}/build.html).

   PURE. Props in, markup out: no fetching, no `useAuth()`, no router hooks but
   `Link`. `BuildPage` supplies live data; the dev compare page supplies the
   sample. The viewport is read here (the 768px breakpoint) so both agree.

   DESKTOP: two grid rows, gap 12. `minmax(0, 1fr) 420px` at 402px — the hero
   (cover, arc, shape tag, action dock, title plate) and the proof panel — then
   `300px minmax(0, 1fr) 280px` filling the rest: the anatomy list, the part
   viewer and the timeline. PHONE: the hero, the action tiles, the proof, the
   page's tabs as a sideways row, the anatomy (six parts, then the rest on
   request), the viewer and the timeline.

   THE TABS ARE BUILDTABS' SIX KEYS. The reference shares one panel between Run
   and Understand; here both keys stay, each presets the switch to its layer, and
   moving the switch on either moves the tab with it (the page decides that).

   THREE SURFACES BLUR, and two of them are drawn here: the title plate and the
   action dock (on a phone, the tile row in its place). Panels never blur.

   EVERY COLOUR IS A TOKEN. `line-height: normal` is set once on the root, where
   the reference sets none: the app's body leading is looser and these boxes are
   measured in pixels. */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Copy, Download, Maximize2, Network, Play, RefreshCw, X, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { Arc, ARC_BUILD_HERO, ARC_BUILD_HERO_MOBILE } from "@/components/brand/Arc";
import { Button } from "@/components/brand/Button";
import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";
import { Detail } from "@/components/brand/Detail";
import { EmptyState } from "@/components/brand/EmptyState";
import { ErrorState } from "@/components/brand/ErrorState";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { FilterChip } from "@/components/brand/FilterChip";
import { HeroPlate } from "@/components/brand/HeroPlate";
import { IconButton } from "@/components/brand/IconButton";
import { OrbGlass } from "@/components/brand/OrbGlass";
import { Panel, PanelHead } from "@/components/brand/Panel";
import { PartViewer } from "@/components/brand/PartViewer";
import { Plaque } from "@/components/brand/Plaque";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { StripedBar, type StripedBarTick } from "@/components/brand/StripedBar";
import { Timeline } from "@/components/brand/Timeline";
import { WallLabel } from "@/components/brand/WallLabel";
import { ScrollRow } from "@/components/shell/ScrollRow";
import { BOARD_GRID_HEIGHT, boardHeight, type PageFit } from "@/components/shell/siteFrameFit";
import { sideTrack, useIsPhone, useTierFit, useWidthTier, type WidthTier } from "@/components/shell/useMinWidth";
import { categoryColour } from "@/lib/theme/category";
import { GLASS_BLUR, ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { scrollBehavior } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, display } from "@/lib/theme/type";

import {
  anatomySubtitle,
  ranIt,
  tabReadsPart,
  timelineSubtitle,
  type BuildActionsView,
  type BuildAnatomyView,
  type BuildCreditView,
  type BuildHeroView,
  type BuildProofView,
  type BuildTabKey,
  type BuildTimelineView,
  type BuildViewerView,
  type CompletenessView,
  type PartRowView,
  type ProofActionKind,
} from "./buildModel";

/* ── the view's props ── */

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
}

/** The first row's height on the desktop board. */
const HERO_ROW = 402;

/** The bottom row's height on the board: what the 820 leaves under the hero row. */
const BOTTOM_ROW = BOARD_GRID_HEIGHT - HERO_ROW - 12;

/* UI-P39 — the two rows between the boards. The hero row keeps both tracks to
   1024 (the proof narrowing to 340) and stacks below. The bottom row's narrowest
   panel, the timeline, drops below the anatomy and the viewer under 1280, full
   width at the row's height. */
function heroRow(tier: WidthTier): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: tier === "stacked" ? "minmax(0, 1fr)" : `minmax(0, 1fr) ${sideTrack(420)}`,
    gridAutoRows: tier === "stacked" ? `minmax(${HERO_ROW}px, auto)` : undefined,
    gap: 9,
    flexShrink: 0,
  };
}

function bottomRow(tier: WidthTier): CSSProperties {
  return tier === "full"
    ? { display: "grid", gridTemplateColumns: "300px minmax(0, 1fr) 280px", gap: 9, flexGrow: 1, minHeight: 0 }
    : { display: "grid", gridTemplateColumns: "300px minmax(0, 1fr)", gridAutoRows: `minmax(${BOTTOM_ROW}px, auto)`, gap: 9, flexGrow: 1 };
}

/** The timeline's cell: its own track at 1280 and up, the row's full width below. */
const dropped = (tier: WidthTier): CSSProperties => (tier === "full" ? {} : { gridColumn: "1 / -1" });
/** The phone shows this many parts before "Show n more parts". */
export const PHONE_PARTS = 6;

const NOTE = "Your run relights the lamp and records the model you used.";

const ACTION_LABEL: Record<ProofActionKind, string> = {
  reproduce: "I ran this and it worked",
  reconfirm: "Re-confirm it still works",
  "sign-in": "Sign in to confirm",
};

/** The viewer's body, which the tabs control. */
const VIEWER_PANEL = "build-viewer-panel";
const tabId = (tab: BuildTabKey) => `build-viewer-tab-${tab}`;

/** How long a tile or a button says it worked. */
const CONFIRMED_MS = 1500;


/* ── the polite "Copied" ── */

/** One live region for the page's two copy controls. Saying the same word twice re-announces it. */
function useAnnouncer() {
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
function useConfirmed(): [boolean, () => void] {
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

/* ── the hero ── */

/**
 * The plate's credit. Desktop puts each piece in the plate's flex row, as the
 * reference does; the phone's plate reads it as one line of text.
 */
function CreditText({ credit }: { credit: BuildCreditView }) {
  const madeBy = credit.madeBy ? `made by ${credit.madeBy}` : null;
  if (credit.rebuiltFrom) {
    const by = credit.rebuiltFrom.handle ? ` by @${credit.rebuiltFrom.handle}` : "";
    return (
      <>
        Rebuilt from <i style={{ color: t.text }}>{credit.rebuiltFrom.title}</i>
        {`${by}${madeBy ? ` · ${madeBy}` : ""}`}
      </>
    );
  }
  return madeBy ? <>{madeBy}</> : null;
}

const tileStyle = (phone: boolean): CSSProperties => ({
  width: phone ? undefined : 72,
  height: phone ? 51 : 48,
  borderRadius: 13,
  background: t.dockTile,
  border: `1px solid ${t.glassBorder}`,
  color: t.text,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  padding: 0,
  fontFamily: FIGTREE,
  fontSize: phone ? 11 : 10,
  fontWeight: 600,
  lineHeight: "normal",
  textDecoration: "none",
  cursor: "pointer",
  boxSizing: "border-box",
  minWidth: 0,
});

function DockTile({
  icon: Icon,
  label,
  phone,
  onClick,
  to,
  testId,
}: {
  icon: LucideIcon;
  label: string;
  phone: boolean;
  onClick?: () => void;
  to?: string;
  testId: string;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement & HTMLAnchorElement>();
  const style: CSSProperties = { ...tileStyle(phone), ...ring(state.focusVisible) };
  const icon = <Icon size={phone ? 19 : 18} strokeWidth={1.8} aria-hidden="true" style={{ flexShrink: 0 }} />;

  if (to) {
    return (
      <Link to={to} data-testid={testId} {...handlers} style={style}>
        {icon}
        {label}
      </Link>
    );
  }
  return (
    <button type="button" data-testid={testId} onClick={onClick} {...handlers} style={style}>
      {icon}
      {label}
    </button>
  );
}

/** Copy for AI, Download, Rebuild, Lineage: the dock on the hero, or the tile row under it on a phone. */
function ActionDock({ actions, phone, announce }: { actions: BuildActionsView; phone: boolean; announce: (text: string) => void }) {
  const [copied, confirmCopied] = useConfirmed();

  const copy = async () => {
    if (await actions.onCopyForAI()) {
      confirmCopied();
      announce("Copied");
    }
  };

  const frame: CSSProperties = phone
    ? { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 4 }
    : { position: "absolute", top: 12, right: 12, display: "flex", gap: 4 };

  return (
    <div
      data-testid="build-action-dock"
      role="group"
      aria-label="Take this build"
      style={{
        ...frame,
        padding: 4,
        borderRadius: 18,
        background: t.dock,
        border: `1px solid ${t.dockBorder}`,
        backdropFilter: GLASS_BLUR,
        WebkitBackdropFilter: GLASS_BLUR,
      }}
    >
      <DockTile icon={copied ? Check : Copy} label="Copy for AI" phone={phone} onClick={() => void copy()} testId="build-copy-for-ai" />
      <DockTile icon={Download} label="Download" phone={phone} onClick={actions.onDownload} testId="build-download" />
      <DockTile icon={RefreshCw} label="Rebuild" phone={phone} onClick={actions.onRebuild} testId="build-rebuild" />
      <DockTile icon={Network} label="Lineage" phone={phone} to={actions.lineageTo} testId="build-lineage" />
    </div>
  );
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
  const tag = `${hero.shape}${hero.viaConnector ? " · via connector" : ""}`;
  return (
    <section
      data-testid="build-hero"
      aria-label="The build"
      style={{
        position: "relative",
        height: phone ? 380 : "100%",
        borderRadius: phone ? 18 : r.panel,
        overflow: "hidden",
        border: `1px solid ${t.glassBorder}`,
        boxShadow: t.shadowCard,
        /* The reference's height is the content box: the hairline adds to it. */
        boxSizing: "content-box",
      }}
    >
      <div style={{ position: "absolute", inset: 0 }}>{hero.cover}</div>
      <Arc geometry={phone ? ARC_BUILD_HERO_MOBILE : ARC_BUILD_HERO} preserveAspectRatio="xMinYMin slice" />
      {hero.shape ? (
        <span
          data-testid="build-shape-tag"
          style={{
            position: "absolute",
            top: phone ? 12 : 14,
            left: phone ? 12 : 14,
            background: t.mediaTag,
            color: t.text,
            fontFamily: DM_MONO,
            fontSize: 10,
            lineHeight: "normal",
            padding: "3px 6px",
            borderRadius: r.chip,
          }}
        >
          {tag}
        </span>
      ) : null}
      {phone ? null : <ActionDock actions={actions} phone={false} announce={announce} />}
      <HeroPlate
        variant="build"
        size={phone ? "phone" : "desktop"}
        title={hero.title}
        outcome={hero.outcome}
        credit={<CreditText credit={hero.credit} />}
        delta={hero.delta ?? undefined}
      />
    </section>
  );
}

/* ── the proof ── */

function ProofButton({ action, phone }: { action: BuildProofView["action"]; phone: boolean }) {
  return (
    <Button
      data-testid="build-proof-action"
      data-action={action.kind}
      variant="primary"
      size={phone ? 48 : 38}
      fontSize={phone ? 15 : 13}
      icon={action.kind === "sign-in" ? undefined : Check}
      fullWidth={phone}
      disabled={action.pending}
      onClick={action.onPress}
    >
      {action.pending ? "Recording…" : ACTION_LABEL[action.kind]}
    </Button>
  );
}

function CompletenessBlock({ completeness }: { completeness: CompletenessView }) {
  const { score, publishAt, galleryAt, next } = completeness;
  const ticks: StripedBarTick[] =
    publishAt === galleryAt
      ? [{ at: galleryAt, colour: t.text }]
      : [
          { at: publishAt, colour: t.text2 },
          { at: galleryAt, colour: t.text },
        ];
  return (
    <div data-testid="build-completeness" style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Eyebrow>Completeness</Eyebrow>
        <span style={{ fontFamily: DM_MONO, fontSize: 12, color: t.text }}>{score} / 100</span>
      </div>
      <StripedBar
        value={score}
        colour={t.lit}
        height={11}
        ticks={ticks}
        label="Completeness"
        valueText={`${score} of 100. Publishing needs ${publishAt}, the gallery ${galleryAt}.`}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: DM_MONO, fontSize: 10, color: t.label }}>
        <span>PUBLISH {publishAt}</span>
        <span>GALLERY {galleryAt}</span>
      </div>
      {next ? <div style={{ fontFamily: FIGTREE, fontSize: 12, color: t.text2 }}>Next: {next}.</div> : null}
    </div>
  );
}

/** An optimistic run that the server refused: said once in the panel, with a retry. */
function RunFailed({ failure }: { failure: NonNullable<BuildProofView["writeError"]> }) {
  return (
    <ErrorState
      line="That didn't save."
      panel="Reproduction"
      onRetry={failure.onRetry}
      error={failure.error}
      style={{ marginTop: 9 }}
      data-testid="build-run-error"
    />
  );
}

function ProofPanel({ proof, phone, now }: { proof: BuildProofView; phone: boolean; now?: number }) {
  const count = proof.build.reproduction_count ?? 0;
  const orb = <OrbGlass size={phone ? 118 : 128} label={ranIt(count)} sub={proof.lastRun ? `last ${proof.lastRun}` : undefined} />;
  const cells = proof.details.map((detail) => <Detail key={detail.label} label={detail.label} value={detail.value} />);

  if (phone) {
    return (
      <Panel surface="glass" padding="16px">
        <div data-testid="build-proof">
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {orb}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
              <Eyebrow>Reproduction</Eyebrow>
              <Plaque build={proof.build} size="proof" wording="short" now={now} />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <ProofButton action={proof.action} phone />
          </div>
          {proof.writeError ? <RunFailed failure={proof.writeError} /> : null}
          <div style={{ fontFamily: FIGTREE, fontSize: 12, color: t.text2, textAlign: "center", marginTop: 6 }}>{NOTE}</div>
          <div style={{ marginTop: 10 }}>
            <WallLabel columns={2} cells={cells} />
          </div>
          {proof.completeness ? <CompletenessBlock completeness={proof.completeness} /> : null}
        </div>
      </Panel>
    );
  }

  return (
    <Panel surface="glass" padding="16px 18px" style={{ height: "100%" }}>
      <div data-testid="build-proof">
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {orb}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
            <Eyebrow>Reproduction</Eyebrow>
            <Plaque build={proof.build} size="proof" now={now} />
            <ProofButton action={proof.action} phone={false} />
            <div style={{ fontFamily: FIGTREE, fontSize: 11, color: t.text2 }}>{NOTE}</div>
          </div>
        </div>
        {proof.writeError ? <RunFailed failure={proof.writeError} /> : null}
        <div style={{ marginTop: 10 }}>
          <WallLabel columns={3} cells={cells} />
        </div>
        {proof.completeness ? <CompletenessBlock completeness={proof.completeness} /> : null}
      </div>
    </Panel>
  );
}

/* ── the anatomy ── */

function PartRow({
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
        padding: "0 7px",
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
      <span style={{ display: "flex", alignItems: "center", gap: phone ? 6 : 5, minWidth: 0 }}>
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

function AnatomyDialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
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
            padding: "12px 13px 14px",
            borderRadius: r.panel,
            background: t.solid,
            border: `1px solid ${t.glassBorder}`,
            boxShadow: t.shadowSheet,
            color: t.text,
            fontFamily: FIGTREE,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 9, marginBottom: 10 }}>
            <Dialog.Title style={{ margin: 0, fontFamily: FIGTREE, fontSize: 15, fontWeight: 600, color: t.text }}>Anatomy</Dialog.Title>
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

function AnatomyPanel({ anatomy, phone, onSelect }: { anatomy: BuildAnatomyView; phone: boolean; onSelect: (id: string) => void }) {
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
              /* A 45px target around a 13px line: the padding is the target, the
                 negative margins keep the line where the reference draws it. */
              margin: "-5px 0 -15px",
              padding: "11px 0 11px 7px",
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

/* ── the viewer ── */

function Viewer({
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

/* ── the timeline ── */

function TimelinePanel({ timeline, phone, onPlay }: { timeline: BuildTimelineView; phone: boolean; onPlay: () => void }) {
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
        <div style={{ marginTop: 9 }}>
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

/* ── desktop ── */

const selectedPart = (anatomy: BuildAnatomyView): PartRowView | null =>
  anatomy.parts.find((part) => part.id === anatomy.selectedId) ?? anatomy.parts[0] ?? null;

function DesktopBuild(props: BuildViewProps) {
  const { fit = "content", now, hero, actions, proof, anatomy, viewer, timeline } = props;
  const tier = useWidthTier();
  const board = fit === "board" && tier === "full";
  const { announce, region } = useAnnouncer();

  return (
    <div
      data-testid="build-view"
      data-viewport="desktop"
      style={{ display: "flex", flexDirection: "column", gap: 9, lineHeight: "normal", ...boardHeight(fit) }}
    >
      <div style={{ ...heroRow(tier), ...(board ? { height: HERO_ROW } : { minHeight: HERO_ROW }) }}>
        <div style={{ minHeight: 0 }}>
          <Hero hero={hero} actions={actions} phone={false} announce={announce} />
        </div>
        <div style={{ minHeight: 0 }}>
          <ProofPanel proof={proof} phone={false} now={now} />
        </div>
      </div>
      <div style={bottomRow(tier)}>
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
      {region}
    </div>
  );
}

/* ── phone ── */

function PhoneBuild(props: BuildViewProps) {
  const { now, hero, actions, proof, anatomy, viewer, timeline } = props;
  const { announce, region } = useAnnouncer();
  const viewerRef = useRef<HTMLDivElement>(null);

  /* The viewer is below the tabs and the anatomy: whatever changes it brings it into view. */
  const reveal = () => viewerRef.current?.scrollIntoView?.({ behavior: scrollBehavior(), block: "nearest" });

  return (
    <div data-testid="build-view" data-viewport="mobile" style={{ display: "flex", flexDirection: "column", gap: 9, lineHeight: "normal" }}>
      <Hero hero={hero} actions={actions} phone announce={announce} />
      <ActionDock actions={actions} phone announce={announce} />
      <ProofPanel proof={proof} phone now={now} />
      <ScrollRow gap={6} label="Sections of this build" tablist>
        {viewer.tabs.map((tab) => (
          <FilterChip
            key={tab.value}
            label={tab.label}
            on={tab.value === viewer.tab}
            tab={{ id: `build-tab-${tab.value}`, controls: "build-tabpanel" }}
            onClick={() => {
              viewer.onTabChange(tab.value);
              reveal();
            }}
          />
        ))}
      </ScrollRow>
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
      {region}
    </div>
  );
}

export function BuildView(props: BuildViewProps) {
  const phone = useIsPhone();
  const fit = useTierFit(props.fit);
  return phone ? <PhoneBuild {...props} /> : <DesktopBuild {...props} fit={fit} />;
}

/* ── loading, missing, failed ── */

const MOCK_ROWS = 6;

/** The proof panel before the record arrives: the orb's circle, the plaque, the button and the details, as bones. */
function ProofSkeleton({ phone }: { phone: boolean }) {
  const orb = phone ? 118 : 128;
  return (
    <Panel surface="glass" padding={phone ? "16px" : "16px 18px"} style={phone ? { minHeight: 440 } : { height: "100%" }}>
      <div style={{ display: "flex", gap: phone ? 10 : 12, alignItems: "center" }}>
        <Skeleton width={orb} height={orb} radius="50%" />
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexGrow: 1, minWidth: 0 }}>
          <Skeleton width={90} height={11} />
          <Skeleton height={phone ? 37 : 51} radius={r.chip} />
          {phone ? null : <Skeleton height={31} radius={r.control} />}
          {phone ? null : <Skeleton width="80%" height={11} />}
        </div>
      </div>
      {/* The phone's action: drawn 48, rendered 44 (the touch floor). */}
      {phone ? <Skeleton height={44} radius={r.control} style={{ marginTop: 10 }} /> : null}
      <Skeleton height={phone ? 161 : 107} radius={r.control} style={{ marginTop: 10 }} />
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
      <LoadingRegion what="the build" announce data-testid="build-loading" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <Skeleton height={382} radius={18} />
        <Skeleton height={76} radius={18} />
        <ProofSkeleton phone />
        <Skeleton height={30} radius={r.media} />
        <Panel surface="glass" padding="14px 10px">
          <PanelHead headingLevel={2} title="Anatomy" subtitle={"\u00a0"} />
          <div style={{ marginTop: 6 }}>{rows(46, MOCK_ROWS, 2)}</div>
          {/* "Show n more parts" */}
          <Skeleton width={120} height={13} style={{ margin: "10px 0 0 7px" }} />
        </Panel>
        <Skeleton height={317} radius={r.panel} />
        <Panel surface="glass" padding="14px 16px">
          <PanelHead headingLevel={2} title="Watch it get built" subtitle={"\u00a0"} />
          <div style={{ marginTop: 9 }}>{rows(43, 4, 0)}</div>
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
      style={{ display: "flex", flexDirection: "column", gap: 9, lineHeight: "normal", ...boardHeight(fit) }}
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
          <div style={{ marginTop: 9 }}>{rows(41, 5, 0)}</div>
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
      <div data-testid="build-notice" role="status" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 9 }}>
        <h1 style={{ ...display(30), margin: 0, color: t.text }}>{line}</h1>
        {detail ? <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, lineHeight: 1.55, color: t.text2, maxWidth: "68ch" }}>{detail}</p> : null}
        {action}
      </div>
    </Panel>
  );
}

export default BuildView;
