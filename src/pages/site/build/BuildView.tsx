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
import { Detail } from "@/components/brand/Detail";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { FilterChip } from "@/components/brand/FilterChip";
import { HeroPlate } from "@/components/brand/HeroPlate";
import { IconButton } from "@/components/brand/IconButton";
import { OrbGlass } from "@/components/brand/OrbGlass";
import { Panel, PanelHead } from "@/components/brand/Panel";
import { PartViewer } from "@/components/brand/PartViewer";
import { Plaque } from "@/components/brand/Plaque";
import { StripedBar, type StripedBarTick } from "@/components/brand/StripedBar";
import { Timeline } from "@/components/brand/Timeline";
import { WallLabel } from "@/components/brand/WallLabel";
import { ScrollRow } from "@/components/shell/ScrollRow";
import { boardHeight, type PageFit } from "@/components/shell/siteFrameFit";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { categoryColour } from "@/lib/theme/category";
import { GLASS_BLUR, ring, skeletonStyle } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { scrollBehavior } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, display } from "@/lib/theme/type";

import {
  anatomySubtitle,
  ranIt,
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

const VISUALLY_HIDDEN: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

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
  height: phone ? 62 : 58,
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
    ? { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }
    : { position: "absolute", top: 12, right: 12, display: "flex", gap: 6 };

  return (
    <div
      data-testid="build-action-dock"
      role="group"
      aria-label="Take this build"
      style={{
        ...frame,
        padding: 6,
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
            padding: "3px 8px",
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
    <div data-testid="build-completeness" style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
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

function ProofPanel({ proof, phone, now }: { proof: BuildProofView; phone: boolean; now?: number }) {
  const count = proof.build.reproduction_count ?? 0;
  const orb = <OrbGlass size={phone ? 118 : 128} label={ranIt(count)} sub={proof.lastRun ? `last ${proof.lastRun}` : undefined} />;
  const cells = proof.details.map((detail) => <Detail key={detail.label} label={detail.label} value={detail.value} />);

  if (phone) {
    return (
      <Panel padding="16px">
        <div data-testid="build-proof">
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            {orb}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
              <Eyebrow>Reproduction</Eyebrow>
              <Plaque build={proof.build} size="proof" wording="short" now={now} />
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <ProofButton action={proof.action} phone />
          </div>
          <div style={{ fontFamily: FIGTREE, fontSize: 12, color: t.text2, textAlign: "center", marginTop: 8 }}>{NOTE}</div>
          <div style={{ marginTop: 14 }}>
            <WallLabel columns={2} cells={cells} />
          </div>
          {proof.completeness ? <CompletenessBlock completeness={proof.completeness} /> : null}
        </div>
      </Panel>
    );
  }

  return (
    <Panel padding="16px 18px" style={{ height: "100%" }}>
      <div data-testid="build-proof">
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {orb}
          <div style={{ display: "flex", flexDirection: "column", gap: 9, minWidth: 0 }}>
            <Eyebrow>Reproduction</Eyebrow>
            <Plaque build={proof.build} size="proof" now={now} />
            <ProofButton action={proof.action} phone={false} />
            <div style={{ fontFamily: FIGTREE, fontSize: 11, color: t.text2 }}>{NOTE}</div>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
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
        gap: 8,
        alignItems: "center",
        /* The reference sizes the row's content box, so a gap's dashed edge adds
           to it rather than eating into it. The row stretches across the list as
           a flex item, so no width is needed. */
        boxSizing: "content-box",
        ...(phone ? { minHeight: 46 } : { height: 40 }),
        padding: "0 10px",
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
      <span style={{ display: "flex", alignItems: "center", gap: phone ? 8 : 7, minWidth: 0 }}>
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
            fontSize: phone ? 14 : 13,
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
            padding: "16px 18px 20px",
            borderRadius: r.panel,
            background: t.solid,
            border: `1px solid ${t.glassBorder}`,
            boxShadow: t.shadowSheet,
            color: t.text,
            fontFamily: FIGTREE,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <Dialog.Title style={{ margin: 0, fontFamily: FIGTREE, fontSize: 16, fontWeight: 600, color: t.text }}>Anatomy</Dialog.Title>
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
    <Panel padding={phone ? "14px 10px" : "14px 12px"} style={phone ? undefined : { height: "100%" }}>
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
          <p style={{ margin: "8px 0 0", fontFamily: FIGTREE, fontSize: 12, color: t.text2 }}>Nothing has been placed in this build yet.</p>
        ) : (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
            {shown.map((part) => (
              <PartRow key={part.id} part={part} selected={part.id === selectedId} phone={phone} onSelect={onSelect} />
            ))}
          </div>
        )}
        {more > 0 ? (
          <button
            type="button"
            data-testid="build-anatomy-more"
            onClick={() => setExpanded(true)}
            style={{
              display: "block",
              /* A 45px target around a 13px line: the padding is the target, the
                 negative margins keep the line where the reference draws it. */
              margin: "-5px 0 -15px",
              padding: "15px 0 15px 10px",
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
    <Panel padding="14px 16px" style={phone ? undefined : { height: "100%" }}>
      <div data-testid="build-timeline">
        <PanelHead
          headingLevel={2}
          title="Watch it get built"
          subtitle={timelineSubtitle(duration, events.length)}
          right={<IconButton icon={Play} label="Play the build" size={phone ? 38 : 34} onClick={onPlay} disabled={events.length === 0} />}
        />
        <div style={{ marginTop: 12 }}>
          {events.length > 0 ? (
            <Timeline events={events} size={phone ? "phone" : "desktop"} label="Kept steps" />
          ) : (
            <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 12, color: t.text2 }}>No steps were kept for this build.</p>
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
  const board = fit === "board";
  const { announce, region } = useAnnouncer();

  return (
    <div
      data-testid="build-view"
      data-viewport="desktop"
      style={{ display: "flex", flexDirection: "column", gap: 12, lineHeight: "normal", ...boardHeight(fit) }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 420px",
          gap: 12,
          flexShrink: 0,
          ...(board ? { height: HERO_ROW } : { minHeight: HERO_ROW }),
        }}
      >
        <div style={{ minHeight: 0 }}>
          <Hero hero={hero} actions={actions} phone={false} announce={announce} />
        </div>
        <div style={{ minHeight: 0 }}>
          <ProofPanel proof={proof} phone={false} now={now} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "300px minmax(0, 1fr) 280px", gap: 12, flexGrow: 1, minHeight: 0 }}>
        <div style={{ minHeight: 0 }}>
          <AnatomyPanel anatomy={anatomy} phone={false} onSelect={anatomy.onSelect} />
        </div>
        <div style={{ minHeight: 0, minWidth: 0 }}>
          <Viewer viewer={viewer} part={selectedPart(anatomy)} phone={false} announce={announce} />
        </div>
        <div style={{ minHeight: 0 }}>
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
    <div data-testid="build-view" data-viewport="mobile" style={{ display: "flex", flexDirection: "column", gap: 12, lineHeight: "normal" }}>
      <Hero hero={hero} actions={actions} phone announce={announce} />
      <ActionDock actions={actions} phone announce={announce} />
      <ProofPanel proof={proof} phone now={now} />
      <ScrollRow gap={6} label="Sections of this build">
        {viewer.tabs.map((tab) => (
          <FilterChip
            key={tab.value}
            label={tab.label}
            on={tab.value === viewer.tab}
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
      <div ref={viewerRef} style={{ scrollMarginTop: 72 }}>
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
  return phone ? <PhoneBuild {...props} /> : <DesktopBuild {...props} />;
}

/* ── loading, missing, failed ── */

function Bone({ height, radius = r.panel, style }: { height: number | string; radius?: string | number; style?: CSSProperties }) {
  return <div aria-hidden="true" style={{ ...skeletonStyle(), height, borderRadius: radius, ...style }} />;
}

/** The first screen's shape in `--recess`, before the record arrives. */
export function BuildViewSkeleton({ fit = "content" }: { fit?: PageFit }) {
  const phone = useIsPhone();
  if (phone) {
    return (
      <div data-testid="build-loading" role="status" aria-busy="true" aria-label="Loading the build" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Bone height={382} radius={18} />
        <Bone height={76} radius={18} />
        <Bone height={438} />
      </div>
    );
  }
  return (
    <div
      data-testid="build-loading"
      role="status"
      aria-busy="true"
      aria-label="Loading the build"
      style={{ display: "flex", flexDirection: "column", gap: 12, ...boardHeight(fit) }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 420px", gap: 12, height: HERO_ROW, flexShrink: 0 }}>
        <Bone height="100%" />
        <Bone height="100%" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "300px minmax(0, 1fr) 280px", gap: 12, flexGrow: 1, minHeight: 406 }}>
        <Bone height="100%" />
        <Bone height="100%" />
        <Bone height="100%" />
      </div>
    </div>
  );
}

/** A record that is not there, or could not be read: one Sentient line and one action. */
export function BuildViewNotice({ line, detail, action }: { line: string; detail?: string; action: ReactNode }) {
  return (
    <Panel padding="24px 24px">
      <div data-testid="build-notice" role="status" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
        <h1 style={{ ...display(30), margin: 0, color: t.text }}>{line}</h1>
        {detail ? <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 14, lineHeight: 1.55, color: t.text2, maxWidth: "68ch" }}>{detail}</p> : null}
        {action}
      </div>
    </Panel>
  );
}

export default BuildView;
