/* SV-04 P5: the OpenBuilds page's frame, in a small module of its own: the header, its two switches, the frame bones, the
   panels' shells, their loading states and the page's arrangement. BountiesView draws its page from these, and
   `BountiesLoadingView` draws the page as it stands while the board loads, from the same pieces, so the route table's
   Placeholder is the page's own loading state without the page's code (its frames, ranks and wall labels) in the first
   download. */

import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { Eyebrow } from "@/components/brand/Eyebrow";
import { PageHeading } from "@/components/brand/PageHeading";
import { Panel, PanelHead } from "@/components/brand/Panel";
import { Segmented } from "@/components/brand/Segmented";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { boardHeight, type PageFit } from "@/components/shell/siteFrameFit";
import { sideTrack, useIsPhone, useTierFit, useWidthTier } from "@/components/shell/useMinWidth";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, display } from "@/lib/theme/type";

export type BountySort = "newest" | "reward" | "closing";

export const SORTS: readonly { value: BountySort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "reward", label: "Reward" },
  { value: "closing", label: "Closing soon" },
];

export const GALLERY = "/gallery";
export const SOLVERS = "/bounties/solvers";
export const SENTENCE_DESKTOP = "The build works. One part is left open on purpose, with a reward for whoever solves it.";
export const SENTENCE_PHONE = "The build works. One part is left open on purpose, with a reward.";

/** The frame's height under its lamp on the board: padding, the 104px cover, the title row and the chips row. */
const FRAME_BONE_HEIGHT = 177;
/** On a phone the frames stack and each runs about 4px shorter. */
const FRAME_BONE_HEIGHT_PHONE = 173;

/* ── the header's two switches ── */

export function SwitchRow({ sort, onSortChange, phone }: { sort: BountySort; onSortChange: (sort: BountySort) => void; phone: boolean }) {
  const size = phone ? 36 : 34;
  const fontSize = phone ? 13 : 12;
  return (
    <>
      <Segmented<BountySort> label="Sort by" size={size} fontSize={fontSize} value={sort} onChange={onSortChange} items={SORTS} />
      <Segmented
        label="Board"
        size={size}
        fontSize={fontSize}
        value="bounties"
        items={[
          { value: "bounties", label: "Bounties", href: "/bounties" },
          { value: "solvers", label: "Solvers", href: SOLVERS },
        ]}
      />
    </>
  );
}

/* ── the frames ── */

export function FrameSkeleton({ phone }: { phone: boolean }) {
  return (
    <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ height: 18 }} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: 5,
          background: t.glass,
          borderRadius: r.card,
          border: `1.5px dashed ${t.line}`,
          boxShadow: t.shadowCard,
          boxSizing: "border-box",
          height: phone ? FRAME_BONE_HEIGHT_PHONE : FRAME_BONE_HEIGHT,
        }}
      >
        <Skeleton height={104} radius={r.media} />
        <div style={{ padding: "0 5px", display: "flex", flexDirection: "column", gap: 5 }}>
          <Skeleton width="70%" height={18} />
          <Skeleton width="55%" height={12} />
        </div>
      </div>
    </div>
  );
}

export function framesGrid(phone: boolean, columns: 2 | 3) {
  return {
    display: "grid",
    gridTemplateColumns: phone ? "minmax(0, 1fr)" : `repeat(${columns}, minmax(0, 1fr))`,
    gap: phone ? "4px 0" : "4px 10px",
    alignContent: "start",
  } as const;
}

export function FramesLoading({ phone, columns = 3 }: { phone: boolean; columns?: 2 | 3 }) {
  return (
    <LoadingRegion what="the open asks" data-testid="bounties-loading" style={framesGrid(phone, columns)}>
      {Array.from({ length: 6 }, (_, i) => (
        <FrameSkeleton key={i} phone={phone} />
      ))}
    </LoadingRegion>
  );
}

/* ── the solve panel ── */

export function SolvePanelShell({ children }: { children: ReactNode }) {
  return (
    <Panel surface="glass" padding="14px 16px" style={{ flex: 1 }}>
      <PanelHead title="The ask" subtitle="One part, left open on purpose" headingLevel={2} />
      {children}
    </Panel>
  );
}

export function SolveLoading() {
  return (
    <LoadingRegion what="the ask" data-testid="bounties-solve-loading" style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 7 }}>
      <Skeleton height={177} radius={r.card} />
      <Skeleton height={76} radius={r.control} />
    </LoadingRegion>
  );
}

/* ── the top solvers ── */

export function SolversLoading({ phone }: { phone: boolean }) {
  return (
    <LoadingRegion what="the top solvers" data-testid="bounties-solvers-loading" style={{ marginTop: 9 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{ display: "flex", alignItems: "center", gap: 7, minHeight: phone ? 39 : 31, borderBottom: i < 2 ? `1px solid ${t.hairline}` : undefined }}
        >
          <Skeleton width={phone ? 32 : 28} height={phone ? 32 : 28} radius={r.chip} />
          <Skeleton width={phone ? 32 : 24} height={phone ? 32 : 24} radius="50%" />
          <Skeleton width="42%" height={12} />
          <span style={{ flexGrow: 1 }} />
          <Skeleton width={56} height={11} />
        </div>
      ))}
    </LoadingRegion>
  );
}

export function SolversPanelShell({ phone, children }: { phone: boolean; children: ReactNode }) {
  return (
    <Panel padding={phone ? "14px 16px" : "12px 16px"}>
      <PanelHead title="Top solvers" subtitle="Solutions accepted" titleSize={14} headingLevel={2} />
      {children}
      <Link
        to={SOLVERS}
        style={{
          display: "inline-flex",
          alignItems: "center",
          /* A link: 44 on a phone (the touch target), 32 → 26 above it. */
          minHeight: phone ? 44 : 26,
          marginTop: 4,
          fontFamily: FIGTREE,
          fontSize: 12,
          color: t.text,
          textDecoration: "underline",
          textUnderlineOffset: 4,
        }}
      >
        All solvers
      </Link>
    </Panel>
  );
}

/* ── the page ── */

export function DesktopBountiesLayout({
  fit = "content",
  switches,
  frames,
  solve,
  solvers,
}: {
  fit?: PageFit;
  switches: ReactNode;
  /** The frames, at the column count the width allows. */
  frames: (columns: 2 | 3) => ReactNode;
  solve: ReactNode;
  solvers: ReactNode;
}) {
  /* UI-P39: below 1024 the frames go to two columns and the right track stacks under them. */
  const stacked = useWidthTier() === "stacked";
  return (
    <div data-testid="bounties-view" data-viewport="desktop" style={{ display: "flex", flexDirection: "column", gap: 9, lineHeight: "normal" }}>
      <Panel surface="glass" padding="16px 20px">
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
            <Eyebrow>Bounties</Eyebrow>
            <h1 style={{ ...display(44), margin: 0, color: t.text }}>Open asks on real builds</h1>
            <div style={{ fontFamily: FIGTREE, fontSize: 12, color: t.text2 }}>{SENTENCE_DESKTOP}</div>
          </div>
          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>{switches}</div>
        </div>
      </Panel>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: stacked ? "minmax(0, 1fr)" : `minmax(0, 1fr) ${sideTrack(420)}`,
          gap: 9,
          ...boardHeight(fit, 0),
        }}
      >
        <div style={{ minWidth: 0 }}>{frames(stacked ? 2 : 3)}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9, minWidth: 0 }}>
          {solve}
          {solvers}
        </div>
      </div>
    </div>
  );
}

export function PhoneBountiesLayout({ switches, frames, solvers }: { switches: ReactNode; frames: ReactNode; solvers: ReactNode }) {
  return (
    <div data-testid="bounties-view" data-viewport="mobile" style={{ display: "flex", flexDirection: "column", gap: 9, lineHeight: "normal" }}>
      <PageHeading eyebrow="Bounties" title="Open asks on real builds" sub={SENTENCE_PHONE} size={34} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{switches}</div>
      {frames}
      {solvers}
    </div>
  );
}

const asSort = (value: string | null): BountySort => (value === "reward" || value === "closing" ? value : "newest");

/** The page while the board loads: the route table's Placeholder for /openbuilds. The sort it shows is the address's;
    choosing another one changes the address, which the page reads when it arrives. */
export function BountiesLoadingView() {
  const phone = useIsPhone();
  const fit = useTierFit(undefined);
  const [params, setParams] = useSearchParams();
  const sort = asSort(params.get("sort"));
  const onSortChange = (next: BountySort) => {
    const nextParams = new URLSearchParams(params);
    if (next === "newest") nextParams.delete("sort");
    else nextParams.set("sort", next);
    setParams(nextParams, { replace: true });
  };
  if (phone) {
    return (
      <PhoneBountiesLayout
        switches={<SwitchRow sort={sort} onSortChange={onSortChange} phone />}
        frames={<FramesLoading phone />}
        solvers={
          <SolversPanelShell phone>
            <SolversLoading phone />
          </SolversPanelShell>
        }
      />
    );
  }
  return (
    <DesktopBountiesLayout
      fit={fit}
      switches={<SwitchRow sort={sort} onSortChange={onSortChange} phone={false} />}
      frames={(columns) => <FramesLoading phone={false} columns={columns} />}
      solve={
        <SolvePanelShell>
          <SolveLoading />
        </SolvePanelShell>
      }
      solvers={
        <SolversPanelShell phone={false}>
          <SolversLoading phone={false} />
        </SolversPanelShell>
      }
    />
  );
}
