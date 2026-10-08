/* UI-P31 — /rebuild/:slug, as the reference draws it
   (design/reference/{desktop,mobile}/{noon,dusk}/rebuild.html).

   PURE. Props in, markup out: no fetching, no `useAuth()`, no router hooks but
   `Link`. `RebuildPage` supplies live data; the dev compare page the sample.
   The viewport is read here (the 768px breakpoint) so both agree.

   DESKTOP: a grid `minmax(0, 1fr) 470px` filling the page — the family, full
   height, on the left; on the right a column 9 apart (UI-P58), what changed (filling)
   over readiness (290). The board draws no heading, so the page's h1 is for
   assistive technology alone.

   PHONE: the decision first. The heading ("Rebuild · draft", the draft's title,
   "Rebuilding {source} by @{maker}."), then readiness with the credit and
   Publish, then what changed, then the family as an indented list (a tree does
   not fit 390). */

import type { ReactNode } from "react";

import { ErrorState } from "@/components/brand/ErrorState";
import { PageHeading } from "@/components/brand/PageHeading";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { VISUALLY_HIDDEN as HIDDEN } from "@/components/brand/VisuallyHidden";
import { Panel } from "@/components/brand/Panel";
import { boardHeight, type PageFit } from "@/components/shell/siteFrameFit";
import { sideTrack, useIsPhone, useTierFit, useWidthTier } from "@/components/shell/useMinWidth";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, display } from "@/lib/theme/type";

import { ChangesPanel } from "./ChangesPanel";
import { FamilyPanel } from "./FamilyPanel";
import { ReadinessPanel } from "./ReadinessPanel";
import {
  VISUALLY_HIDDEN,
  rebuildingLine,
  type ChangeGroupView,
  type FamilyNodeView,
  type ReadinessView,
  type RebuildCreditView,
} from "./rebuildModel";

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

/** The readiness panel's height on the desktop board. */
const READINESS_HEIGHT = 290;

export function RebuildView(props: RebuildViewProps) {
  const { draftTitle, source, family, changes, readiness, credit, onPublish, onKeepDraft, workspaceTo, publishing, publishFailure } = props;
  const phone = useIsPhone();
  const fit = useTierFit(props.fit ?? "content");
  /* UI-P39: below 1024 the right track stacks under the family, readiness first as on the phone. */
  const stacked = useWidthTier() === "stacked";
  const board = fit === "board";

  const readinessPanel = (
    <ReadinessPanel
      readiness={readiness}
      credit={credit}
      onPublish={onPublish}
      onKeepDraft={onKeepDraft}
      workspaceTo={workspaceTo}
      publishing={publishing}
      failure={publishFailure}
      phone={phone}
      fill={!phone && !stacked}
    />
  );

  if (phone) {
    return (
      <div data-testid="rebuild-view" data-viewport="mobile" style={{ display: "flex", flexDirection: "column", gap: 9, lineHeight: "normal" }}>
        <PageHeading eyebrow="Rebuild · draft" title={draftTitle} sub={rebuildingLine(source)} size={32} />
        {readinessPanel}
        <ChangesPanel groups={changes} phone loading={changes === null} />
        <FamilyPanel root={family} phone />
      </div>
    );
  }

  return (
    <div data-testid="rebuild-view" data-viewport="desktop" style={{ display: "flex", flexDirection: "column", gap: 9, lineHeight: "normal", ...boardHeight(fit) }}>
      <h1 style={VISUALLY_HIDDEN}>{`${draftTitle}: ${rebuildingLine(source)}`}</h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: stacked ? "minmax(0, 1fr)" : `minmax(0, 1fr) ${sideTrack(470)}`,
          gap: 9,
          flexGrow: 1,
          minHeight: 0,
        }}
      >
        <div style={{ minHeight: 0 }}>
          <FamilyPanel root={family} fit={fit} fill={!stacked} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9, minHeight: 0, minWidth: 0 }}>
          {stacked ? <div style={{ minHeight: READINESS_HEIGHT }}>{readinessPanel}</div> : null}
          <div style={{ flexGrow: 1, minHeight: 0 }}>
            <ChangesPanel groups={changes} fill={!stacked} loading={changes === null} />
          </div>
          {stacked ? null : (
            <div style={{ flexShrink: 0, ...(board ? { height: READINESS_HEIGHT } : { minHeight: READINESS_HEIGHT }) }}>{readinessPanel}</div>
          )}
        </div>
      </div>
    </div>
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
export function RebuildViewSkeleton({ fit = "content", label = "Loading the rebuild" }: { fit?: PageFit; label?: string }) {
  const phone = useIsPhone();
  const tierFit = useTierFit(fit);
  const stacked = useWidthTier() === "stacked";
  const what = label.replace(/^Loading /, "");
  if (phone) {
    return (
      <LoadingRegion what={what} announce data-testid="rebuild-loading" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <Skeleton height={78} radius={r.control} />
        <ReadinessSkeleton phone />
        <ChangesPanel groups={null} phone loading />
        <FamilyPanel root={null} phone loading />
      </LoadingRegion>
    );
  }
  return (
    <LoadingRegion
      what={what}
      announce
      data-testid="rebuild-loading"
      style={{
        display: "grid",
        gridTemplateColumns: stacked ? "minmax(0, 1fr)" : `minmax(0, 1fr) ${sideTrack(470)}`,
        gap: 9,
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
  );
}

/** A page-level read that failed: the page's own panel says so, inside the frame, with a retry. The h1 is for assistive technology. */
export function RebuildViewFailed({ panel, onRetry, error }: { panel: string; onRetry: () => void; error?: unknown }) {
  return (
    <Panel padding="24px 24px">
      <h1 style={HIDDEN}>{panel}</h1>
      <ErrorState panel={panel} onRetry={onRetry} error={error} data-testid="rebuild-error" />
    </Panel>
  );
}

/** A rebuild that cannot be shown or started: one Sentient line, a sentence, and one action. */
export function RebuildViewNotice({ line, detail, action }: { line: string; detail?: string; action: ReactNode }) {
  return (
    <Panel padding="24px 24px">
      <div data-testid="rebuild-notice" role="status" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 9 }}>
        <h1 style={{ ...display(30), margin: 0, color: t.text }}>{line}</h1>
        {detail ? <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, lineHeight: 1.55, color: t.text2, maxWidth: "68ch" }}>{detail}</p> : null}
        {action}
      </div>
    </Panel>
  );
}

export default RebuildView;
