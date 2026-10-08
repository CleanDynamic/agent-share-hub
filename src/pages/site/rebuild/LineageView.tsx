/* UI-P31 — /b2/:slug/lineage, from the rebuild page's own pieces.

   PURE. The same Family panel in the left track, and on the right what changed
   for the build the reader picks — its change set against the build it was
   rebuilt from — in place of the rebuild page's readiness. Before a pick, the
   panel says how to make one. Every node is a choice here rather than a way
   out; the chosen build is one link away from the panel's head.

   DESKTOP: the rebuild page's grid, `minmax(0, 1fr) 470px`, filling, with no
   visible heading (the breadcrumb names the build). PHONE: a heading, the family
   as an indented list, then what changed. */

import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import type { PanelFailure } from "@/components/brand/ErrorState";
import { PageHeading } from "@/components/brand/PageHeading";
import { boardHeight, type PageFit } from "@/components/shell/siteFrameFit";
import { sideTrack, useIsPhone, useTierFit, useWidthTier } from "@/components/shell/useMinWidth";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { ChangesPanel } from "./ChangesPanel";
import { FamilyPanel } from "./FamilyPanel";
import { VISUALLY_HIDDEN, type ChangeGroupView, type FamilyNodeView } from "./rebuildModel";

/** What the right column shows for the build the reader picked. */
export interface LineageSelection {
  title: string;
  /** The build's own page. */
  to: string;
  /** The build it was rebuilt from; null for the family's root. */
  parentTitle: string | null;
  groups: ChangeGroupView[] | null;
  loading: boolean;
  failed: boolean;
  /** Asks for the two records again. */
  onRetry?: () => void;
  error?: unknown;
}

export interface LineageViewProps {
  fit?: PageFit;
  /** The build in the address. */
  title: string;
  family: FamilyNodeView | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  selection: LineageSelection | null;
  /** What to say when the family is this build alone (nobody has rebuilt it), in place of the prompt to pick. */
  alone?: ReactNode;
  /** The family is being read. */
  familyLoading?: boolean;
  /** The family could not be read. */
  familyFailure?: PanelFailure;
}

export const PICK_PROMPT = "Pick a build in the family to see what changed.";
export const ROOT_NOTE = "This is where the family starts: it was not rebuilt from anything, so there is nothing to compare it with.";

function OpenLink({ to, title, phone }: { to: string; title: string; phone: boolean }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to={to}
      data-testid="lineage-open-selected"
      {...handlers}
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: phone ? 44 : 36,
        fontFamily: FIGTREE,
        fontSize: 12,
        color: t.action,
        textDecoration: "underline",
        textUnderlineOffset: 3,
        borderRadius: r.chip,
        ...ring(state.focusVisible),
      }}
    >
      Open {title}
    </Link>
  );
}

function SelectionPanel({
  selection,
  phone,
  fill,
  alone,
}: {
  selection: LineageSelection | null;
  phone: boolean;
  fill: boolean;
  alone?: ReactNode;
}) {
  /* A family of one has nothing to compare: the list says nothing has changed. Otherwise the panel asks for a pick. */
  if (!selection) {
    return alone ? (
      <ChangesPanel groups={[]} phone={phone} fill={fill} />
    ) : (
      <ChangesPanel groups={null} phone={phone} fill={fill} placeholder={PICK_PROMPT} />
    );
  }

  const about = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 9, flexWrap: "wrap", marginTop: 4 }}>
      <span style={{ fontFamily: FIGTREE, fontSize: 12, color: t.text }}>
        {selection.parentTitle ? (
          <>
            <i>{selection.title}</i> against <i>{selection.parentTitle}</i>
          </>
        ) : (
          <i>{selection.title}</i>
        )}
      </span>
      <OpenLink to={selection.to} title={selection.title} phone={phone} />
    </div>
  );

  const placeholder = !selection.parentTitle ? ROOT_NOTE : undefined;
  const working = Boolean(selection.parentTitle) && selection.loading;
  const failure =
    selection.parentTitle && selection.failed && !selection.loading
      ? { onRetry: selection.onRetry ?? (() => undefined), error: selection.error }
      : undefined;

  return (
    <ChangesPanel
      groups={selection.parentTitle && !selection.loading && !selection.failed ? selection.groups : null}
      phone={phone}
      fill={fill}
      about={about}
      placeholder={placeholder}
      loading={working}
      failure={failure}
    />
  );
}

export function LineageView({ fit: givenFit = "content", title, family, selectedId, onSelect, selection, alone, familyLoading, familyFailure }: LineageViewProps) {
  const phone = useIsPhone();
  const fit = useTierFit(givenFit);
  /* UI-P39: below 1024 the selection stacks under the family, as on the phone. */
  const stacked = useWidthTier() === "stacked";

  if (phone) {
    return (
      <div data-testid="lineage-view" data-viewport="mobile" style={{ display: "flex", flexDirection: "column", gap: 9, lineHeight: "normal" }}>
        <PageHeading eyebrow="Lineage" title={title} sub="Every published rebuild in this family. Pick one to see what it changed." size={32} />
        <FamilyPanel root={family} phone selectedId={selectedId} onSelect={onSelect} loading={familyLoading} failure={familyFailure} />
        <SelectionPanel selection={selection} phone fill={false} alone={alone} />
      </div>
    );
  }

  return (
    <div data-testid="lineage-view" data-viewport="desktop" style={{ display: "flex", flexDirection: "column", gap: 9, lineHeight: "normal", ...boardHeight(fit) }}>
      <h1 style={VISUALLY_HIDDEN}>{`The family of ${title}`}</h1>
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
          <FamilyPanel root={family} fit={fit} fill={!stacked} selectedId={selectedId} onSelect={onSelect} loading={familyLoading} failure={familyFailure} />
        </div>
        <div style={{ minHeight: 0, minWidth: 0 }}>
          <SelectionPanel selection={selection} phone={false} fill={!stacked} alone={alone} />
        </div>
      </div>
    </div>
  );
}

export default LineageView;
