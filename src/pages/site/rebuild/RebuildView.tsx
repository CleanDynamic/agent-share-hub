/* UI-P31 — /rebuild/:slug, as the reference draws it
   (design/reference/{desktop,mobile}/{noon,dusk}/rebuild.html).

   PURE. Props in, markup out: no fetching, no `useAuth()`, no router hooks but
   `Link`. `RebuildPage` supplies live data; the dev compare page the sample.
   The viewport is read here (the 768px breakpoint) so both agree.

   DESKTOP: a grid `minmax(0, 1fr) 470px` filling the page — the family, full
   height, on the left; on the right a column 12 apart, what changed (filling)
   over readiness (290). The board draws no heading, so the page's h1 is for
   assistive technology alone.

   PHONE: the decision first. The heading ("Rebuild · draft", the draft's title,
   "Rebuilding {source} by @{maker}."), then readiness with the credit and
   Publish, then what changed, then the family as an indented list (a tree does
   not fit 390). */

import type { ReactNode } from "react";

import { PageHeading } from "@/components/brand/PageHeading";
import { Panel } from "@/components/brand/Panel";
import { boardHeight, type PageFit } from "@/components/shell/siteFrameFit";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { skeletonStyle } from "@/lib/theme/controls";
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
  publishError?: string | null;
}

/** The readiness panel's height on the desktop board. */
const READINESS_HEIGHT = 290;

export function RebuildView(props: RebuildViewProps) {
  const { fit = "content", draftTitle, source, family, changes, readiness, credit, onPublish, onKeepDraft, workspaceTo, publishing, publishError } = props;
  const phone = useIsPhone();
  const board = fit === "board";

  const readinessPanel = (
    <ReadinessPanel
      readiness={readiness}
      credit={credit}
      onPublish={onPublish}
      onKeepDraft={onKeepDraft}
      workspaceTo={workspaceTo}
      publishing={publishing}
      error={publishError}
      phone={phone}
      fill={!phone}
    />
  );

  if (phone) {
    return (
      <div data-testid="rebuild-view" data-viewport="mobile" style={{ display: "flex", flexDirection: "column", gap: 12, lineHeight: "normal" }}>
        <PageHeading eyebrow="Rebuild · draft" title={draftTitle} sub={rebuildingLine(source)} size={32} />
        {readinessPanel}
        <ChangesPanel groups={changes} phone placeholder={changes ? undefined : "Working out what changed…"} />
        <FamilyPanel root={family} phone />
      </div>
    );
  }

  return (
    <div data-testid="rebuild-view" data-viewport="desktop" style={{ display: "flex", flexDirection: "column", gap: 12, lineHeight: "normal", ...boardHeight(fit) }}>
      <h1 style={VISUALLY_HIDDEN}>{`${draftTitle}: ${rebuildingLine(source)}`}</h1>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 470px", gap: 12, flexGrow: 1, minHeight: 0 }}>
        <div style={{ minHeight: 0 }}>
          <FamilyPanel root={family} fit={fit} fill />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0, minWidth: 0 }}>
          <div style={{ flexGrow: 1, minHeight: 0 }}>
            <ChangesPanel groups={changes} fill placeholder={changes ? undefined : "Working out what changed…"} />
          </div>
          <div style={{ flexShrink: 0, ...(board ? { height: READINESS_HEIGHT } : { minHeight: READINESS_HEIGHT }) }}>{readinessPanel}</div>
        </div>
      </div>
    </div>
  );
}

/* ── loading, missing, failed ── */

function Bone({ height, radius = r.panel }: { height: number | string; radius?: string | number }) {
  return <div aria-hidden="true" style={{ ...skeletonStyle(), height, borderRadius: radius }} />;
}

/** The page's shape in `--recess`, while the source, the draft and the family arrive. */
export function RebuildViewSkeleton({ fit = "content", label = "Loading the rebuild" }: { fit?: PageFit; label?: string }) {
  const phone = useIsPhone();
  if (phone) {
    return (
      <div data-testid="rebuild-loading" role="status" aria-busy="true" aria-label={label} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Bone height={96} radius={r.control} />
        <Bone height={300} />
        <Bone height={260} />
      </div>
    );
  }
  return (
    <div
      data-testid="rebuild-loading"
      role="status"
      aria-busy="true"
      aria-label={label}
      style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 470px", gap: 12, ...boardHeight(fit) }}
    >
      <Bone height="100%" />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ flexGrow: 1 }}>
          <Bone height="100%" />
        </div>
        <Bone height={READINESS_HEIGHT} />
      </div>
    </div>
  );
}

/** A rebuild that cannot be shown or started: one Sentient line, a sentence, and one action. */
export function RebuildViewNotice({ line, detail, action }: { line: string; detail?: string; action: ReactNode }) {
  return (
    <Panel padding="24px 24px">
      <div data-testid="rebuild-notice" role="status" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
        <h1 style={{ ...display(30), margin: 0, color: t.text }}>{line}</h1>
        {detail ? <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 14, lineHeight: 1.55, color: t.text2, maxWidth: "68ch" }}>{detail}</p> : null}
        {action}
      </div>
    </Panel>
  );
}

export default RebuildView;
