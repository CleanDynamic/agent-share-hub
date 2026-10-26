/* UI-P33 / UI-P37 — Bounties, as a pure view: the header, the vacant frames, the solve panel and the top solvers.

   PURE. Props in, markup out: no fetching, no `useAuth()`, no router hooks but `Link`. `Bounties` (the page) supplies
   live data; the dev compare page supplies the sample. Every colour is a token and every face a role from `type`.

   DESKTOP: a column, 9 apart — the header panel, then `minmax(0, 1fr) 420px`: the frames in three columns and, on the
   right, the chosen ask in a solve panel over the top solvers. PHONE: the heading, the Bounties · Solvers switch, the
   frames one to a row, then the top solvers.

   EVERY PANEL HAS ITS FOUR STATES (UI-P37). The frames: bones the frame's size, "No open asks right now." and a way to
   the gallery, or "That didn't load." with a retry. The top solvers: bones, "Nobody has solved a bounty yet.", or the
   same failure line. Me too is optimistic: it shows its new state at once and, if the write fails, rolls back with a
   line in the solve panel.

   DENSER SINCE UI-P57: every size this file sets itself is its old value through the density table
   (`design/prompts/README-density.md`): the page 9 apart, the frames 4px 10px, the ask 10 in, solver rows 31 (39 on a
   phone, where a row is not a control). The "All solvers" link keeps a 44px target on a phone. The brand pieces map
   their own drawn sizes. */

import type { ReactNode } from "react";
import { ArrowRight, Heart } from "lucide-react";
import { Link } from "react-router-dom";

import { Avatar } from "@/components/brand/Avatar";
import { Button } from "@/components/brand/Button";
import { Detail } from "@/components/brand/Detail";
import { EmptyState } from "@/components/brand/EmptyState";
import { ErrorState, type PanelFailure } from "@/components/brand/ErrorState";
import { Panel } from "@/components/brand/Panel";
import { RankRung, type RankTier } from "@/components/brand/RankRung";
import { VacantFrame } from "@/components/brand/VacantFrame";
import { WallLabel } from "@/components/brand/WallLabel";
import { type PageFit } from "@/components/shell/siteFrameFit";
import { useIsPhone, useTierFit } from "@/components/shell/useMinWidth";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, display, mono } from "@/lib/theme/type";

import {
  DesktopBountiesLayout,
  FramesLoading,
  framesGrid,
  GALLERY,
  PhoneBountiesLayout,
  SolveLoading,
  SolvePanelShell,
  SolversLoading,
  SolversPanelShell,
  SwitchRow,
  type BountySort,
} from "./BountiesFrame";

/* ── the view's props ── */

export { SORTS, type BountySort } from "./BountiesFrame";

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

/* ── the frames ── */

function FramesBody({
  frames,
  selectedId,
  onSelect,
  phone,
  columns = 3,
  onNavigate,
}: Pick<BountiesViewProps, "frames" | "selectedId" | "onSelect" | "onNavigate"> & { phone: boolean; columns?: 2 | 3 }) {
  const grid = framesGrid(phone, columns);

  if (frames.status === "loading") return <FramesLoading phone={phone} columns={columns} />;
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
        <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
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
    <SolvePanelShell>
      {loading ? (
        <SolveLoading />
      ) : failed || !frame ? null : (
        <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 7 }}>
          <div
            style={{
              border: `1.5px dashed ${t.catBreakage}`,
              borderRadius: r.card,
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 7,
            }}
          >
            <span style={{ ...mono(10, { caps: true }), color: t.catBreakage }}>Open</span>
            <div style={{ ...display(24), letterSpacing: "-0.02em", lineHeight: 1.05, color: t.text }}>
              {frame.part} for {frame.title}
            </div>
            {frame.problem ? (
              <div style={{ fontFamily: FIGTREE, fontSize: 12, lineHeight: 1.5, color: t.text2 }}>{frame.problem}</div>
            ) : null}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
    </SolvePanelShell>
  );
}

/* ── the top solvers ── */

const TIER: readonly RankTier[] = ["highest", "rare", "common"];

function SolversBody({ solvers, phone }: { solvers: BountiesViewProps["solvers"]; phone: boolean }) {
  if (solvers.status === "loading") return <SolversLoading phone={phone} />;
  if (solvers.status === "error") {
    return <ErrorState panel="Top solvers" onRetry={solvers.onRetry} error={solvers.error} style={{ paddingTop: 9 }} data-testid="bounties-solvers-error" />;
  }
  if (solvers.data.length === 0) {
    return <EmptyState line="Nobody has solved a bounty yet." data-testid="bounties-solvers-empty" />;
  }
  return (
    <ol data-testid="bounties-solvers" aria-label="Top solvers, most solved first" style={{ listStyle: "none", margin: "9px 0 0", padding: 0 }}>
      {solvers.data.slice(0, 3).map((solver, i) => (
        <li
          key={solver.id}
          style={{ display: "flex", alignItems: "center", gap: 7, minHeight: phone ? 39 : 31, borderBottom: i < 2 ? `1px solid ${t.hairline}` : undefined }}
        >
          <RankRung rank={i + 1} tier={TIER[i]} size={phone ? 32 : 28} />
          <Avatar size={phone ? 32 : 24} userId={solver.id} name={solver.handle} src={solver.avatarUrl} />
          <span style={{ flex: 1, fontFamily: FIGTREE, fontSize: phone ? 13 : 12, color: t.text, minWidth: 0 }}>@{solver.handle}</span>
          <span style={{ fontFamily: DM_MONO, fontSize: phone ? 12 : 11, color: t.text2 }}>{solver.solved} solved</span>
        </li>
      ))}
    </ol>
  );
}

function SolversPanel({ solvers, phone }: { solvers: BountiesViewProps["solvers"]; phone: boolean }) {
  return (
    <SolversPanelShell phone={phone}>
      <SolversBody solvers={solvers} phone={phone} />
    </SolversPanelShell>
  );
}

/* ── the page ── */

function DesktopBounties(props: BountiesViewProps) {
  const { fit = "content", frames, solvers, selectedId, onSelect, sort, onSortChange, meToo, onNavigate } = props;
  const list = frames.status === "ready" ? frames.data : [];
  const chosen = list.find((frame) => frame.id === selectedId) ?? list[0] ?? null;
  return (
    <DesktopBountiesLayout
      fit={fit}
      switches={<SwitchRow sort={sort} onSortChange={onSortChange} phone={false} />}
      frames={(columns) => <FramesBody frames={frames} selectedId={chosen?.id ?? null} onSelect={onSelect} phone={false} columns={columns} onNavigate={onNavigate} />}
      solve={
        frames.status === "error" || (frames.status === "ready" && !chosen) ? null : (
          <SolvePanel frame={chosen} meToo={meToo} loading={frames.status === "loading"} failed={false} onNavigate={onNavigate} />
        )
      }
      solvers={<SolversPanel solvers={solvers} phone={false} />}
    />
  );
}

function PhoneBounties(props: BountiesViewProps) {
  const { frames, solvers, sort, onSortChange, selectedId, onSelect, onNavigate } = props;
  return (
    <PhoneBountiesLayout
      switches={<SwitchRow sort={sort} onSortChange={onSortChange} phone />}
      frames={<FramesBody frames={frames} selectedId={selectedId} onSelect={onSelect} phone onNavigate={onNavigate} />}
      solvers={<SolversPanel solvers={solvers} phone />}
    />
  );
}

export function BountiesView(props: BountiesViewProps) {
  const phone = useIsPhone();
  const fit = useTierFit(props.fit);
  return phone ? <PhoneBounties {...props} /> : <DesktopBounties {...props} fit={fit} />;
}

export default BountiesView;
