/* UI-P90 — the Build page's first screen and The build in the refined look, as
   `design/reference/refined/{dusk,noon}/build-list.html` draws them.

   A FORK, NOT AN EDIT. `BuildView` stays the current look; this takes its props (`BuildViewProps`, imported, not
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

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/brand/Button";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { FilterChip } from "@/components/brand/FilterChip";
import { PictureLight, ResultWindow } from "@/components/brand/FramedWork";
import { Mark } from "@/components/brand/Mark";
import { Plaque, plaqueState } from "@/components/brand/Plaque";
import { Row } from "@/components/brand/Row";
import { StripedBar, type StripedBarTick } from "@/components/brand/StripedBar";
import { UnderlineTabs } from "@/components/brand/UnderlineTabs";
import { ScrollRow } from "@/components/shell/ScrollRow";
import { useIsPhone, useWidthTier } from "@/components/shell/useMinWidth";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { scrollBehavior } from "@/lib/theme/motion";
import { CONTROL, CONTROL_HOVER } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, figure } from "@/lib/theme/type";

import {
  ACTION_LABEL,
  AnatomyDialog,
  AnatomyPanel,
  NOTE,
  RunFailed,
  TimelinePanel,
  Viewer,
  bottomRow,
  dropped,
  selectedPart,
  useAnnouncer,
  useConfirmed,
  type BuildViewProps,
} from "./BuildView";
import type { BuildActionsView, BuildCreditView, BuildHeroView, BuildProofView, BuildStepsView, BuildViewerView, CompletenessView } from "./buildModel";
import { RefinedNeedPanel, RefinedStepsList } from "./RefinedBuildSteps";

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

/** A wrapping row of a wide column and a side column, as the board lays both rows out. */
const pair: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 48, alignItems: "flex-start" };
const wide: CSSProperties = { flex: "999 1 640px", minWidth: 0 };
const side: CSSProperties = { flex: "1 1 300px", maxWidth: 340, minWidth: 0 };

/* ── the hero ── */

/** One item of the action dock: 28 high, `0 12px`, 12.5/500, text only. */
function DockItem({
  label,
  first,
  phone,
  onClick,
  to,
  testId,
}: {
  label: string;
  first: boolean;
  phone: boolean;
  onClick?: () => void;
  to?: string;
  testId: string;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement & HTMLAnchorElement>();
  const style: CSSProperties = {
    appearance: "none",
    boxSizing: "border-box",
    height: phone ? 44 : 28,
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

/** Copy for AI, Download, Rebuild, Lineage: one control-recipe group on the hero, or the row under it on a phone. */
function ActionDock({ actions, phone, announce }: { actions: BuildActionsView; phone: boolean; announce: (text: string) => void }) {
  const [, confirmCopied] = useConfirmed();
  const copy = async () => {
    if (await actions.onCopyForAI()) {
      confirmCopied();
      announce("Copied");
    }
  };
  const frame: CSSProperties = phone
    ? { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }
    : { position: "absolute", right: 16, top: 12, display: "inline-flex" };
  return (
    <div
      data-testid="build-action-dock"
      role="group"
      aria-label="Take this build"
      style={{ ...frame, ...CONTROL, borderRadius: 6, overflow: "hidden", boxSizing: "border-box" }}
    >
      <DockItem label="Copy for AI" first phone={phone} onClick={() => void copy()} testId="build-copy-for-ai" />
      <DockItem label="Download" first={false} phone={phone} onClick={actions.onDownload} testId="build-download" />
      <DockItem label="Rebuild" first={false} phone={phone} onClick={actions.onRebuild} testId="build-rebuild" />
      <DockItem label="Lineage" first={false} phone={phone} to={actions.lineageTo} testId="build-lineage" />
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
  const tag = `${hero.shape}${hero.viaConnector ? " · via connector" : ""}`;
  const lamp = plaqueState(proof.build, now);
  const credit = <Credit credit={hero.credit} />;
  return (
    <section
      data-testid="build-hero"
      aria-label="The build"
      style={{ ...moduleStyle, ...(phone ? null : wide), padding: 0, overflow: "hidden" }}
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

function Proof({ proof, phone, now }: { proof: BuildProofView; phone: boolean; now?: number }) {
  const count = proof.build.reproduction_count ?? 0;
  const { action } = proof;
  return (
    <section data-testid="build-proof" aria-label="Reproduction" style={{ ...(phone ? null : side), display: "flex", flexDirection: "column", gap: 20 }}>
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

function BuildPanel({ viewer, steps, phone, announce }: { viewer: BuildViewerView; steps: BuildStepsView; phone: boolean; announce: (text: string) => void }) {
  const onSteps = viewer.tab === "anatomy";
  return (
    <div data-testid="build-steps-panel" style={{ ...(phone ? null : wide), display: "flex", flexDirection: "column", gap: 16 }}>
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
        {onSteps ? <RefinedStepsList view={steps} phone={phone} announce={announce} /> : viewer.content}
      </div>
    </div>
  );
}

/** What you need, with the dialog an "Other parts" row opens its own body in. */
function StepsNeed({ steps, phone }: { steps: BuildStepsView; phone: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const row = open ? steps.need.flatMap((group) => group.rows).find((candidate) => candidate.id === open) : undefined;
  return (
    <div
      style={
        phone
          ? { minWidth: 0 }
          : /* Content-box, as the board: 340 of column, then its 32 of padding and the hairline. */
            { ...side, boxSizing: "content-box", paddingLeft: 32, borderLeft: `1px solid ${t.hairline}` }
      }
    >
      <RefinedNeedPanel view={steps} onOpenOther={setOpen} />
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
  const { announce, region } = useAnnouncer();

  return (
    <div data-testid="build-view" data-viewport="desktop" data-look="refined" style={{ display: "flex", flexDirection: "column", gap: 32, marginTop: 8, lineHeight: "normal" }}>
      <div style={pair}>
        <Hero hero={hero} actions={actions} proof={proof} phone={false} now={now} announce={announce} />
        <Proof proof={proof} phone={false} now={now} />
      </div>
      {steps ? (
        <div data-testid="build-second-row" style={pair}>
          <BuildPanel viewer={viewer} steps={steps} phone={false} announce={announce} />
          <StepsNeed steps={steps} phone={false} />
        </div>
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
    <div data-testid="build-view" data-viewport="mobile" data-look="refined" style={{ display: "flex", flexDirection: "column", gap: 16, lineHeight: "normal", minWidth: 0 }}>
      <Hero hero={hero} actions={actions} proof={proof} phone now={now} announce={announce} />
      <ActionDock actions={actions} phone announce={announce} />
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

export function RefinedBuildView(props: BuildViewProps) {
  const phone = useIsPhone();
  return phone ? <PhoneBuild {...props} /> : <DesktopBuild {...props} />;
}

export default RefinedBuildView;
