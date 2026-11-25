/* Synth 14 Part B: /b2/:slug/lineage. PURE. Two panels, `minmax(0, 1fr) 470px`: on the left a 13 Text 3 link to the build
   above, the h1 "6 builds in this family" with the pills Tree and List ("Read the family as"), and the tree, every node a
   button (the chosen one Raised with a 2px Mint ring). On the right "What changed" for the chosen build, with "Open this
   build" as an underlined 13 link in the section head; before a choice, "Pick a build in the family to see what changed."
   At 760 and below the List replaces the tree. */

import { useState, type ReactNode } from "react";

import { PhoneBottomSheet } from "@/components/phone/BottomSheet";
import { PHONE_MARGIN } from "@/components/shell/chromeSize";
import { PageLink } from "@/lib/routing/PageLink";
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

/** "/b2/a" and "/b2/b" make "/b2/a/compare/b"; null when either is not a build's page or they are the same build. */
export function compareTo(buildTo: string | undefined, otherTo: string | undefined): string | null {
  const slug = (to: string | undefined) => /^\/b2\/([^/?#]+)$/.exec(to ?? "")?.[1] ?? null;
  const a = slug(buildTo);
  const b = slug(otherTo);
  return a && b && a !== b ? `/b2/${a}/compare/${b}` : null;
}

/**
 * Mobile 28 B: the lineage on a phone. The top bar says "Lineage" and carries Back. The family's fact sits under it in 13 Text
 * 3 (the h1), then the indented tree. Tapping a build chooses it (the 2px Mint ring) and opens "What changed" for it as a
 * content sheet; "Compare two" at the foot compares the chosen build with the one in the address.
 */
function LineagePhone({ title, buildTo, family, selectedId, onSelect, selection, alone, familyLoading, familyFailure }: LineageViewProps) {
  const [open, setOpen] = useState(false);
  const choose = (id: string) => {
    if (id !== selectedId) onSelect(id);
    setOpen(true);
  };
  const compare = compareTo(buildTo, selection?.to);
  return (
    <div data-testid="lineage-view" data-viewport="mobile" style={{ fontFamily: FIGTREE, lineHeight: "normal", paddingBottom: 24 }}>
      <FamilyPanel
        root={family}
        phone
        quietHeading
        headingLevel={1}
        reading="list"
        selectedId={selectedId}
        onSelect={choose}
        loading={familyLoading}
        failure={familyFailure}
      />
      {compare ? (
        <div style={{ marginTop: 16 }}>
          <PageLink
            to={compare}
            data-testid="lineage-compare"
            style={{ display: "inline-flex", alignItems: "center", minHeight: 44, padding: "0 16px", borderRadius: 22, background: t.control, color: t.text, fontSize: 13, fontWeight: 600, lineHeight: "16px", textDecoration: "none" }}
          >
            Compare two
          </PageLink>
        </div>
      ) : null}
      <PhoneBottomSheet open={open && Boolean(selection)} onOpenChange={setOpen} title={selection?.title ?? title} height="content" data-testid="lineage-sheet">
        <div style={{ padding: `0 ${PHONE_MARGIN}px 16px` }}>
          <SelectionPanel selection={selection} phone fill={false} alone={alone} />
        </div>
      </PhoneBottomSheet>
    </div>
  );
}

export function LineageView(props: LineageViewProps) {
  const phone = useIsPhone();
  if (phone) return <LineagePhone {...props} />;
  return <LineageDesktop {...props} />;
}

function LineageDesktop({ title, buildTo, family, selectedId, onSelect, selection, alone, familyLoading, familyFailure }: LineageViewProps) {
  const phone = false;
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
