/* UI-P33 / UI-P37 — Bounties, as a pure view: the header, the vacant frames, the solve panel and the top solvers.

   PURE. Props in, markup out: no fetching, no `useAuth()`, no router hooks but `Link`. `Bounties` (the page) supplies
   live data; the dev compare page supplies the sample. Every colour is a token and every face a role from `type`.

   DESKTOP: a column, 12 apart — the header panel, then `minmax(0, 1fr) 420px`: the frames in three columns and, on the
   right, the chosen ask in a solve panel over the top solvers. PHONE: the heading, the Bounties · Solvers switch, the
   frames one to a row, then the top solvers.

   EVERY PANEL HAS ITS FOUR STATES (UI-P37). The frames: bones the frame's size, "No open asks right now." and a way to
   the gallery, or "That didn't load." with a retry. The top solvers: bones, "Nobody has solved a bounty yet.", or the
   same failure line. Me too is optimistic: it shows its new state at once and, if the write fails, rolls back with a
   line in the solve panel. */

import type { ReactNode } from "react";
import { ArrowRight, Heart } from "lucide-react";
import { Link } from "react-router-dom";

import { Avatar } from "@/components/brand/Avatar";
import { Button } from "@/components/brand/Button";
import { Detail } from "@/components/brand/Detail";
import { EmptyState } from "@/components/brand/EmptyState";
import { ErrorState, type PanelFailure } from "@/components/brand/ErrorState";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { PageHeading } from "@/components/brand/PageHeading";
import { Panel, PanelHead } from "@/components/brand/Panel";
import { RankRung, type RankTier } from "@/components/brand/RankRung";
import { Segmented } from "@/components/brand/Segmented";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { VacantFrame } from "@/components/brand/VacantFrame";
import { WallLabel } from "@/components/brand/WallLabel";
import { boardHeight, type PageFit } from "@/components/shell/siteFrameFit";
import { sideTrack, useIsPhone, useTierFit, useWidthTier } from "@/components/shell/useMinWidth";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, display, mono } from "@/lib/theme/type";

/* ── the view's props ── */

export type BountySort = "newest" | "reward" | "closing";

export const SORTS: readonly { value: BountySort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "reward", label: "Reward" },
  { value: "closing", label: "Closing soon" },
];

export interface FrameView {
  id: string;
  /** The build's title. */
  title: string;
  /** The missing part. */
  part: string;
  /** "£400", or null for an unpriced ask. */
  reward: string | null;
  solutions: number;
  meToo: number;
  /** The solve address. */
  to: string;
  cover: ReactNode;
  /** "9 days", or null. */
  closesIn: string | null;
  /** "12 Oct", or null. */
  closes: string | null;
  /** What the problem is, in a sentence, where the data has one. */
  problem: string | null;
}

export interface SolverView {
  id: string;
  handle: string;
  solved: number;
  avatarUrl: string | null;
}

export type Load<T> =
  | { status: "loading" }
  | ({ status: "error"; refused?: boolean } & PanelFailure)
  | { status: "ready"; data: T };

export interface MeTooView {
  pressed: boolean;
  count: number;
  onToggle: () => void;
  /** The write failed: the count has gone back, and the solve panel says so. */
  failure?: PanelFailure;
}

export interface BountiesViewProps {
  fit?: PageFit;
  frames: Load<readonly FrameView[]> & { hasMore?: boolean; loadingMore?: boolean; onMore?: () => void };
  solvers: Load<readonly SolverView[]>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  sort: BountySort;
  onSortChange: (sort: BountySort) => void;
  /** The chosen ask's Me too; absent when it is not known yet. */
  meToo?: MeTooView;
  onNavigate: (to: string) => void;
}

const GALLERY = "/gallery";
const SOLVERS = "/bounties/solvers";
const SENTENCE_DESKTOP = "The build works. One part is left open on purpose, with a reward for whoever solves it.";
const SENTENCE_PHONE = "The build works. One part is left open on purpose, with a reward.";

/** The frame's height under its lamp on the board: padding, the 104px cover, the title row and the chips row. */
const FRAME_BONE_HEIGHT = 177;
/** On a phone the frames stack and each runs about 4px shorter. */
const FRAME_BONE_HEIGHT_PHONE = 173;

/* ── the header's two switches ── */

function SwitchRow({ sort, onSortChange, phone }: Pick<BountiesViewProps, "sort" | "onSortChange"> & { phone: boolean }) {
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

function FrameSkeleton({ phone }: { phone: boolean }) {
  return (
    <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ height: 18 }} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 7,
          background: t.glass,
          borderRadius: r.card,
          border: `1.5px dashed ${t.line}`,
          boxShadow: t.shadowCard,
          boxSizing: "border-box",
          height: phone ? FRAME_BONE_HEIGHT_PHONE : FRAME_BONE_HEIGHT,
        }}
      >
        <Skeleton height={104} radius={r.media} />
        <div style={{ padding: "0 5px", display: "flex", flexDirection: "column", gap: 7 }}>
          <Skeleton width="70%" height={18} />
          <Skeleton width="55%" height={12} />
        </div>
      </div>
    </div>
  );
}

function FramesBody({
  frames,
  selectedId,
  onSelect,
  phone,
  columns = 3,
  onNavigate,
}: Pick<BountiesViewProps, "frames" | "selectedId" | "onSelect" | "onNavigate"> & { phone: boolean; columns?: 2 | 3 }) {
  const grid = {
    display: "grid",
    gridTemplateColumns: phone ? "minmax(0, 1fr)" : `repeat(${columns}, minmax(0, 1fr))`,
    gap: phone ? "4px 0" : "6px 14px",
    alignContent: "start",
  } as const;

  if (frames.status === "loading") {
    return (
      <LoadingRegion what="the open asks" data-testid="bounties-loading" style={grid}>
        {Array.from({ length: 6 }, (_, i) => (
          <FrameSkeleton key={i} phone={phone} />
        ))}
      </LoadingRegion>
    );
  }
  if (frames.status === "error") {
    return (
      <Panel padding="16px 18px">
        <ErrorState
          line={frames.refused ? "You don't have access to this." : undefined}
          panel="Open asks"
          onRetry={frames.onRetry}
          error={frames.error}
          data-testid="bounties-error"
        />
      </Panel>
    );
  }
  if (frames.data.length === 0) {
    return (
      <Panel padding="0 18px">
        <EmptyState
          line="No open asks right now."
          action={{ label: "Enter the gallery", onClick: () => onNavigate(GALLERY) }}
          data-testid="bounties-empty"
        />
      </Panel>
    );
  }
  return (
    <>
      <div data-testid="bounties-frames" style={grid}>
        {frames.data.map((frame) => (
          <div key={frame.id} data-testid="bounty-row" style={{ minWidth: 0 }}>
            <VacantFrame
              title={frame.title}
              cover={frame.cover}
              part={frame.part}
              reward={frame.reward}
              closesIn={frame.closesIn}
              solutions={frame.solutions}
              meToo={frame.meToo}
              {...(phone ? { to: frame.to } : { onSelect: () => onSelect(frame.id), selected: frame.id === selectedId })}
            />
          </div>
        ))}
      </div>
      {frames.hasMore ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
          <Button variant="secondary" size={phone ? 44 : 34} fontSize={phone ? 13 : 12} disabled={frames.loadingMore} onClick={frames.onMore}>
            {frames.loadingMore ? "Loading…" : "Show more"}
          </Button>
        </div>
      ) : null}
    </>
  );
}

/* ── the solve panel ── */

function SolvePanel({
  frame,
  meToo,
  loading,
  failed,
  onNavigate,
}: {
  frame: FrameView | null;
  meToo?: MeTooView;
  loading: boolean;
  failed: boolean;
  onNavigate: (to: string) => void;
}) {
  return (
    <Panel surface="glass" padding="14px 16px" style={{ flex: 1 }}>
      <PanelHead title="The ask" subtitle="One part, left open on purpose" headingLevel={2} />
      {loading ? (
        <LoadingRegion what="the ask" data-testid="bounties-solve-loading" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton height={177} radius={r.card} />
          <Skeleton height={76} radius={r.control} />
        </LoadingRegion>
      ) : failed || !frame ? null : (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              border: `1.5px dashed ${t.catBreakage}`,
              borderRadius: r.card,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <span style={{ ...mono(10, { caps: true }), color: t.catBreakage }}>Open</span>
            <div style={{ ...display(24), letterSpacing: "-0.02em", lineHeight: 1.05, color: t.text }}>
              {frame.part} for {frame.title}
            </div>
            {frame.problem ? (
              <div style={{ fontFamily: FIGTREE, fontSize: 12, lineHeight: 1.5, color: t.text2 }}>{frame.problem}</div>
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button size={36} fontSize={13} icon={ArrowRight} onClick={() => onNavigate(frame.to)}>
                Submit a solution
              </Button>
              {meToo ? (
                <Button
                  variant="secondary"
                  size={36}
                  fontSize={13}
                  icon={Heart}
                  aria-pressed={meToo.pressed}
                  onClick={meToo.onToggle}
                >
                  Me too
                </Button>
              ) : null}
            </div>
            {meToo?.failure ? (
              <ErrorState
                line="That didn't save."
                panel="Me too"
                onRetry={meToo.failure.onRetry}
                error={meToo.failure.error}
                data-testid="bounties-metoo-error"
              />
            ) : null}
          </div>
          <WallLabel
            columns={3}
            cells={[
              <Detail key="r" label="Reward" value={frame.reward ?? "None named"} color={t.litInk} />,
              <Detail key="c" label="Closes" value={frame.closes ?? "Open"} />,
              <Detail key="m" label="Me too" value={String(meToo?.count ?? frame.meToo)} />,
            ]}
          />
        </div>
      )}
    </Panel>
  );
}

/* ── the top solvers ── */

const TIER: readonly RankTier[] = ["highest", "rare", "common"];

function SolversBody({ solvers, phone }: { solvers: BountiesViewProps["solvers"]; phone: boolean }) {
  if (solvers.status === "loading") {
    return (
      <LoadingRegion what="the top solvers" data-testid="bounties-solvers-loading" style={{ marginTop: 12 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{ display: "flex", alignItems: "center", gap: 10, minHeight: phone ? 48 : 38, borderBottom: i < 2 ? `1px solid ${t.hairline}` : undefined }}
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
  if (solvers.status === "error") {
    return <ErrorState panel="Top solvers" onRetry={solvers.onRetry} error={solvers.error} style={{ paddingTop: 12 }} data-testid="bounties-solvers-error" />;
  }
  if (solvers.data.length === 0) {
    return <EmptyState line="Nobody has solved a bounty yet." data-testid="bounties-solvers-empty" />;
  }
  return (
    <ol data-testid="bounties-solvers" aria-label="Top solvers, most solved first" style={{ listStyle: "none", margin: "12px 0 0", padding: 0 }}>
      {solvers.data.slice(0, 3).map((solver, i) => (
        <li
          key={solver.id}
          style={{ display: "flex", alignItems: "center", gap: 10, minHeight: phone ? 48 : 38, borderBottom: i < 2 ? `1px solid ${t.hairline}` : undefined }}
        >
          <RankRung rank={i + 1} tier={TIER[i]} size={phone ? 32 : 28} />
          <Avatar size={phone ? 32 : 24} userId={solver.id} name={solver.handle} src={solver.avatarUrl} />
          <span style={{ flex: 1, fontFamily: FIGTREE, fontSize: phone ? 14 : 12, color: t.text, minWidth: 0 }}>@{solver.handle}</span>
          <span style={{ fontFamily: DM_MONO, fontSize: phone ? 12 : 11, color: t.text2 }}>{solver.solved} solved</span>
        </li>
      ))}
    </ol>
  );
}

function SolversPanel({ solvers, phone }: { solvers: BountiesViewProps["solvers"]; phone: boolean }) {
  return (
    <Panel padding={phone ? "14px 16px" : "12px 16px"}>
      <PanelHead title="Top solvers" subtitle="Solutions accepted" titleSize={14} headingLevel={2} />
      <SolversBody solvers={solvers} phone={phone} />
      <Link
        to={SOLVERS}
        style={{
          display: "inline-flex",
          alignItems: "center",
          minHeight: phone ? 44 : 32,
          marginTop: 6,
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

function DesktopBounties(props: BountiesViewProps) {
  const { fit = "content", frames, solvers, selectedId, onSelect, sort, onSortChange, meToo, onNavigate } = props;
  const list = frames.status === "ready" ? frames.data : [];
  const chosen = list.find((frame) => frame.id === selectedId) ?? list[0] ?? null;
  /* UI-P39: below 1024 the frames go to two columns and the right track stacks under them. */
  const stacked = useWidthTier() === "stacked";

  return (
    <div data-testid="bounties-view" data-viewport="desktop" style={{ display: "flex", flexDirection: "column", gap: 12, lineHeight: "normal" }}>
      <Panel surface="glass" padding="16px 20px">
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <Eyebrow>Bounties</Eyebrow>
            <h1 style={{ ...display(44), margin: 0, color: t.text }}>Open asks on real builds</h1>
            <div style={{ fontFamily: FIGTREE, fontSize: 13, color: t.text2 }}>{SENTENCE_DESKTOP}</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <SwitchRow sort={sort} onSortChange={onSortChange} phone={false} />
          </div>
        </div>
      </Panel>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: stacked ? "minmax(0, 1fr)" : `minmax(0, 1fr) ${sideTrack(420)}`,
          gap: 12,
          ...boardHeight(fit, 0),
        }}
      >
        <div style={{ minWidth: 0 }}>
          <FramesBody frames={frames} selectedId={chosen?.id ?? null} onSelect={onSelect} phone={false} columns={stacked ? 2 : 3} onNavigate={onNavigate} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {frames.status === "error" || (frames.status === "ready" && !chosen) ? null : (
            <SolvePanel frame={chosen} meToo={meToo} loading={frames.status === "loading"} failed={false} onNavigate={onNavigate} />
          )}
          <SolversPanel solvers={solvers} phone={false} />
        </div>
      </div>
    </div>
  );
}

function PhoneBounties(props: BountiesViewProps) {
  const { frames, solvers, sort, onSortChange, selectedId, onSelect, onNavigate } = props;
  return (
    <div data-testid="bounties-view" data-viewport="mobile" style={{ display: "flex", flexDirection: "column", gap: 12, lineHeight: "normal" }}>
      <PageHeading eyebrow="Bounties" title="Open asks on real builds" sub={SENTENCE_PHONE} size={34} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <SwitchRow sort={sort} onSortChange={onSortChange} phone />
      </div>
      <FramesBody frames={frames} selectedId={selectedId} onSelect={onSelect} phone onNavigate={onNavigate} />
      <SolversPanel solvers={solvers} phone />
    </div>
  );
}

export function BountiesView(props: BountiesViewProps) {
  const phone = useIsPhone();
  const fit = useTierFit(props.fit);
  return phone ? <PhoneBounties {...props} /> : <DesktopBounties {...props} fit={fit} />;
}

export default BountiesView;
