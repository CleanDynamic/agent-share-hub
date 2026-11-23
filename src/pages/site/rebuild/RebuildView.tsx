/* Synth 14 Part A: /rebuild/:slug. PURE. Props in, markup out: `RebuildPage` supplies live data; the dev compare page the
   sample. Under the editor bar ("Back to <source build>"), two panels, `minmax(0, 1fr) 470px`: the family on the left, its
   h1 the fact ("6 builds in this family"); on the right "What changed", then the readiness section and the decision. From
   761 to 1100 the side is 380 and the tree scrolls sideways inside its panel; at 760 and below the sections follow the tree
   and "Publish rebuild" is pinned to the bottom of the screen. */

import { PageState } from "@/components/pagestate/PageState";
import type { ReadLike } from "@/components/pagestate/pageStateModel";
import { WAY_OUT, type Thing } from "@/lib/copy/copy";
import type { CSSProperties, ReactNode } from "react";

import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { Panel } from "@/components/brand/Panel";
import { boardHeight, type PageFit } from "@/components/shell/siteFrameFit";
import { useColumnPanels } from "@/components/shell/frameChrome";
import { useIsPhone, useMinWidth, useTierFit, useWidthTier } from "@/components/shell/useMinWidth";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { ChangesPanel } from "./ChangesPanel";
import { FamilyPanel } from "./FamilyPanel";
import { ReadinessPanel } from "./ReadinessPanel";
import { PAGE_TITLE } from "@/components/shell/PageHeader";
import { PANEL_GAP, pageColumns, panelColumns } from "@/components/shell/pageGrid";
import {
  rebuildingLine,
  type ChangeGroupView,
  type FamilyNodeView,
  type ReadinessView,
  type RebuildCreditView,
} from "./rebuildModel";
import { PlaceholderTitle } from "@/components/pagestate/PlaceholderTitle";


export interface RebuildViewProps {
  fit?: PageFit;
  /** The draft's own title. */
  draftTitle: string;
  /** The build being rebuilt: its title and its maker ("@maya"), as the draft froze them. */
  source: { title: string; maker: string | null };
  family: FamilyNodeView | null;
  /** serialiseChangeSet()'s lines, grouped; null while the records load. */
  changes: ChangeGroupView[] | null;
  readiness: ReadinessView;
  credit: RebuildCreditView;
  onPublish: () => void;
  onKeepDraft: () => void;
  /** The draft's workspace, where the missing things get done. */
  workspaceTo?: string;
  publishing?: boolean;
  /** The publish did not save: the readiness panel says so with a retry. */
  publishFailure?: { onRetry: () => void; error?: unknown } | null;
}

/** The readiness panel's height on the desktop board (kept for the skeleton). */
const READINESS_HEIGHT = 290;

const panel: CSSProperties = { background: t.surface, borderRadius: 12, padding: 16, boxSizing: "border-box", minWidth: 0 };

/** Synth 14: two panels, `minmax(0, 1fr) 470px` from 1101, the side 380 from 761 to 1100, one column at 760 and below. */
export function FamilyColumns({ left, right, testId, viewport }: { left: ReactNode; right: ReactNode; testId: string; viewport: string }) {
  useColumnPanels(true);
  const two = useMinWidth(761);
  const wide = useMinWidth(1101);
  return (
    <div
      data-testid={testId}
      data-viewport={viewport}
      style={{
        lineHeight: "normal",
        fontFamily: FIGTREE,
        ...(two ? panelColumns("two", { wideSide: true, between: !wide }) : { display: "flex", flexDirection: "column", gap: PANEL_GAP }),
      }}
    >
      <div style={{ ...panel, overflowX: "auto" }}>{left}</div>
      <div style={{ ...panel, display: "flex", flexDirection: "column", gap: 32 }}>{right}</div>
    </div>
  );
}

export function RebuildView(props: RebuildViewProps) {
  const { draftTitle, source, family, changes, readiness, credit, onPublish, onKeepDraft, workspaceTo, publishing, publishFailure } = props;
  const phone = useIsPhone();
  const fit = useTierFit(props.fit ?? "content");

  return (
    <FamilyColumns
      testId="rebuild-view"
      viewport={phone ? "mobile" : "desktop"}
      left={
        <>
          {/* The draft and its source, for assistive technology: the editor bar names them to the eye. */}
          <p className="sr-only">{`${draftTitle}: ${rebuildingLine(source)}`}</p>
          <FamilyPanel root={family} fit={fit} phone={phone} headingLevel={1} />
        </>
      }
      right={
        <>
          <ChangesPanel groups={changes} phone={phone} loading={changes === null} />
          <ReadinessPanel
            readiness={readiness}
            credit={credit}
            onPublish={onPublish}
            onKeepDraft={onKeepDraft}
            workspaceTo={workspaceTo}
            publishing={publishing}
            failure={publishFailure}
            phone={phone}
          />
        </>
      }
    />
  );
}

/* ── loading, missing, failed ── */

/** The readiness panel before the records arrive: the orb's circle, the headline, the credit box and the buttons, as bones. */
function ReadinessSkeleton({ phone }: { phone: boolean }) {
  return (
    <Panel padding={phone ? "16px" : "16px 18px"} style={phone ? undefined : { height: "100%" }}>
      <div style={{ display: "flex", gap: phone ? 10 : 12, alignItems: "center" }}>
        <Skeleton width={phone ? 112 : 120} height={phone ? 112 : 120} radius="50%" />
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexGrow: 1, minWidth: 0 }}>
          <Skeleton width={110} height={11} />
          <Skeleton width="80%" height={phone ? 18 : 20} />
          <Skeleton width="60%" height={14} />
        </div>
      </div>
      <Skeleton height={phone ? 69 : 68} radius={r.control} style={{ marginTop: 10 }} />
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <Skeleton width={phone ? "100%" : 140} height={phone ? 44 : 30} radius={r.control} />
        {phone ? null : <Skeleton width={110} height={30} radius={r.control} />}
      </div>
    </Panel>
  );
}

/** The page's shape while the source, the draft and the family arrive: the panels' own heads and padding, bones inside. */
/** G2: `title` is the page's kind ("Compare", "Lineage"), drawn as the hidden placeholder h1; a page that draws its own leaves it out. */
export function RebuildViewSkeleton({ fit = "content", label = "Loading the rebuild", title }: { fit?: PageFit; label?: string; title?: string }) {
  const phone = useIsPhone();
  const tierFit = useTierFit(fit);
  const stacked = useWidthTier() === "stacked";
  const what = label.replace(/^Loading /, "");
  if (phone) {
    return (
      <>
      {title ? <PlaceholderTitle>{title}</PlaceholderTitle> : null}
      <LoadingRegion what={what} announce data-testid="rebuild-loading" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <Skeleton height={78} radius={r.control} />
        <ReadinessSkeleton phone />
        <ChangesPanel groups={null} phone loading />
        <FamilyPanel root={null} phone loading />
      </LoadingRegion>
      </>
    );
  }
  return (
    <>
    {title ? <PlaceholderTitle>{title}</PlaceholderTitle> : null}
    <LoadingRegion
      what={what}
      announce
      data-testid="rebuild-loading"
      style={{
        /* As the page: the 8 / 4 template above 1024. */
        ...(stacked ? { display: "grid", gridTemplateColumns: "minmax(0, 1fr)" } : pageColumns("mainWideSide")),
        rowGap: 9,
        ...boardHeight(tierFit),
      }}
    >
      <FamilyPanel root={null} fit={tierFit} fill={!stacked} loading />
      <div style={{ display: "flex", flexDirection: "column", gap: 9, minHeight: 0 }}>
        <div style={{ flexGrow: 1, minHeight: 0 }}>
          <ChangesPanel groups={null} fill loading />
        </div>
        <div style={{ flexShrink: 0, ...(tierFit === "board" ? { height: READINESS_HEIGHT } : { minHeight: READINESS_HEIGHT }) }}>
          <ReadinessSkeleton phone={false} />
        </div>
      </div>
    </LoadingRegion>
    </>
  );
}

/**
 * G4, G7, G8: a page-level read that failed, or a build that is not at this address. Inside the page's panel, under the page's
 * kind as its title ("Rebuild", "Lineage", "Compare": what the title names is what did not load), PageState says which, with
 * "Browse builds" as the way out of a missing build.
 */
export function RebuildViewState({ title, read, thing, region, missing }: { title: string; read: ReadLike | readonly ReadLike[]; thing: Thing; region: string; missing?: (data: unknown[]) => boolean }) {
  return (
    <Panel padding="24px 24px">
      <h1 style={{ ...PAGE_TITLE, marginBottom: 16 }}>{title}</h1>
      <PageState read={read} thing={thing} region={region} skeleton={null} notFound={missing ? { when: missing, kind: "build", way: WAY_OUT.browseBuilds } : undefined}>
        {() => null}
      </PageState>
    </Panel>
  );
}

/** A loaded state that is none of the five (two builds of different things): one Sentient line, a sentence, and one action. */
export function RebuildViewNotice({ line, detail, action }: { line: string; detail?: string; action: ReactNode }) {
  return (
    <Panel padding="24px 24px">
      <div data-testid="rebuild-notice" role="status" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 9 }}>
        <h1 style={PAGE_TITLE}>{line}</h1>
        {detail ? <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, lineHeight: 1.55, color: t.text2, maxWidth: "68ch" }}>{detail}</p> : null}
        {action}
      </div>
    </Panel>
  );
}

export default RebuildView;
