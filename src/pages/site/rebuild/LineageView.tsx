/* Synth 14 Part B: /b2/:slug/lineage. PURE. Two panels, `minmax(0, 1fr) 470px`: on the left a 13 Text 3 link to the build
   above, the h1 "6 builds in this family" with the pills Tree and List ("Read the family as"), and the tree, every node a
   button (the chosen one Raised with a 2px Mint ring). On the right "What changed" for the chosen build, with "Open this
   build" as an underlined 13 link in the section head; before a choice, "Pick a build in the family to see what changed."
   At 760 and below the List replaces the tree. */

import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import type { PanelFailure } from "@/components/pagestate/PageState";
import { type PageFit } from "@/components/shell/siteFrameFit";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { ChangesPanel } from "./ChangesPanel";
import { FamilyPanel } from "./FamilyPanel";
import { FamilyColumns } from "./RebuildView";
import { type ChangeGroupView, type FamilyNodeView } from "./rebuildModel";

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
  /** Its page: the quiet link above the heading. */
  buildTo?: string;
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

function OpenLink({ to, phone }: { to: string; phone: boolean }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to={to}
      data-testid="lineage-open-selected"
      {...handlers}
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: phone ? 44 : 24,
        padding: "0 4px",
        fontFamily: FIGTREE,
        fontSize: 13,
        color: t.text,
        textDecoration: "underline",
        textUnderlineOffset: 3,
        borderRadius: r.chip,
        ...ring(state.focusVisible),
      }}
    >
      Open this build
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

  /* No italics under the refined look: the title stays upright in the line's own ink. */
  const upright = ({ fontStyle: "normal" } as const);
  const about = (
    <p style={{ margin: "4px 0 0", fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label }}>
      {selection.parentTitle ? (
        <>
          <i style={upright}>{selection.title}</i> against <i style={upright}>{selection.parentTitle}</i>
        </>
      ) : (
        <i style={upright}>{selection.title}</i>
      )}
    </p>
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
      action={<OpenLink to={selection.to} phone={phone} />}
      placeholder={placeholder}
      loading={working}
      failure={failure}
    />
  );
}

export function LineageView({ title, buildTo, family, selectedId, onSelect, selection, alone, familyLoading, familyFailure }: LineageViewProps) {
  const phone = useIsPhone();
  const above = (
    <Link to={buildTo ?? ".."} relative="path" data-testid="lineage-back" style={{ display: "inline-block", marginBottom: 8, fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label, textDecoration: "none" }}>
      {`Back to ${title}`}
    </Link>
  );
  return (
    <FamilyColumns
      testId="lineage-view"
      viewport={phone ? "mobile" : "desktop"}
      left={
        <FamilyPanel
          root={family}
          phone={phone}
          headingLevel={1}
          above={above}
          reading={phone ? "list" : undefined}
          selectedId={selectedId}
          onSelect={onSelect}
          loading={familyLoading}
          failure={familyFailure}
        />
      }
      right={<SelectionPanel selection={selection} phone={phone} fill={false} alone={alone} />}
    />
  );
}

export default LineageView;
