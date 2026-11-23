// Analytics on builds: NEEDS YOU, then the builds table (RC-P23).
//
// Synth 15 Part E. NEEDS YOU comes first and only when something is waiting on the maker: one row each, the build's name as
// a 15/600 link and why at 13 in Text 3. Only the open topics are reasons on the interface now; the run-based reasons (a
// failing run, a stale claim) are not drawn.
//
// THE BUILDS TABLE is headed by its fact ("12 builds"): Build (15/600 link), then Rebuilds, Likes and Saved in mono 15,
// right-aligned. Heads 13 in Text 3, rows 48 tall with no lines, the hovered row on the Card fill. The reproduction figures
// (the maker's figures, Got working, Last confirmed) are not drawn. The table scrolls sideways inside its own region, so on
// a phone the page never widens.
//
// STATES: loading is the final layout in blocks; a refusal is its sentence and a secondary "Try again"; no published build
// is one sentence and a secondary "New build".

import type { CSSProperties, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getMyBuildStats, type BuildStatRow, type MyBuildStats } from "@/lib/analytics/buildStats";
import { needsYou, orderForTable, reasonText, type NeedsYouLine } from "@/lib/analytics/needsYou";
import { isPermissionError } from "@/lib/errors/permission";
import { FOCUS_RING_CLASS, ring, skeletonStyle } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, tabular, textStep } from "@/lib/theme/type";

/** The cache key of the page's build numbers. */
export const MY_BUILD_STATS_KEY = "my-build-stats";

/** The table's columns, in order. */
export const BUILD_TABLE_COLUMNS = ["Build", "Rebuilds", "Likes", "Saved"] as const;

const ROW = 48;

/** The signed-in maker's build numbers: three requests, together. */
export function useMyBuildStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [MY_BUILD_STATS_KEY, user?.id ?? null],
    enabled: Boolean(user?.id),
    queryFn: getMyBuildStats,
    refetchOnWindowFocus: false,
  });
}

/** A section's head on the progress page: the fact, 20/600. */
export function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} style={{ margin: 0, fontFamily: FIGTREE, fontSize: textStep.headline, fontWeight: 600, lineHeight: "24px", color: t.text }}>
      {children}
    </h2>
  );
}

const plain = (size: number, color: string, extra: CSSProperties = {}): CSSProperties => ({ margin: 0, fontFamily: FIGTREE, fontSize: size, lineHeight: "20px", color, ...extra });

/* ── NEEDS YOU ───────────────────────────────────────────────────────────── */

function BuildLink({ build }: { build: BuildStatRow }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to={`/b2/${build.slug}`}
      {...handlers}
      style={{
        ...plain(textStep.body, t.text, { fontWeight: 600 }),
        textDecoration: state.hovered ? "underline" : "none",
        textUnderlineOffset: 3,
        overflowWrap: "anywhere",
        ...ring(state.focusVisible),
      }}
    >
      {build.title}
    </Link>
  );
}

/** The lines Needs you draws: the open-topic reasons only. */
export function shownNeedsYou(lines: readonly NeedsYouLine[]): NeedsYouLine[] {
  return lines.map((line) => ({ ...line, reasons: line.reasons.filter((reason) => reason.kind === "open") })).filter((line) => line.reasons.length > 0);
}

/** The builds waiting on their maker; renders nothing when there are none. */
export function NeedsYou({ lines }: { lines: NeedsYouLine[] }) {
  const shown = shownNeedsYou(lines);
  if (shown.length === 0) return null;
  return (
    <section data-testid="needs-you" aria-labelledby="needs-you-heading" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <SectionHeading id="needs-you-heading">Needs you</SectionHeading>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
        {shown.map(({ build, reasons }) => (
          <li key={build.id} data-testid="needs-you-line" style={{ minHeight: ROW, display: "flex", flexDirection: "column", justifyContent: "center", gap: 2, padding: "6px 0", boxSizing: "border-box" }}>
            <BuildLink build={build} />
            <span style={plain(textStep.meta, t.label)}>{reasons.map(reasonText).join(" · ")}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── THE BUILDS TABLE ────────────────────────────────────────────────────── */

const cellBase: CSSProperties = { height: ROW, padding: "0 12px", whiteSpace: "nowrap", verticalAlign: "middle", boxSizing: "border-box" };
const numberCell: CSSProperties = { fontFamily: DM_MONO, fontSize: textStep.body, lineHeight: "20px", color: t.text, textAlign: "end", ...tabular };

function BuildRow({ build }: { build: BuildStatRow }) {
  const { state, handlers } = useInteractive<HTMLTableRowElement>();
  const numbers = [build.rebuild_count, build.like_count, build.save_count];
  return (
    <tr data-testid="build-stats-row" {...handlers} style={{ background: state.hovered ? t.module : "transparent" }}>
      <th scope="row" style={{ ...cellBase, whiteSpace: "normal", minWidth: 160, textAlign: "start", fontWeight: 400, borderRadius: "12px 0 0 12px" }}>
        <BuildLink build={build} />
      </th>
      {numbers.map((value, index) => (
        <td key={index} style={{ ...cellBase, ...numberCell, color: value === 0 ? t.label : t.text, ...(index === numbers.length - 1 ? { borderRadius: "0 12px 12px 0" } : null) }}>
          {value.toLocaleString("en-GB")}
        </td>
      ))}
    </tr>
  );
}

function BuildTable({ builds }: { builds: BuildStatRow[] }) {
  const rows = orderForTable(builds);
  return (
    <div
      data-testid="build-stats-scroll"
      /* A scrollable region is reachable by keyboard, and shows the theme's one focus ring when it is. */
      className={FOCUS_RING_CLASS}
      style={{ overflowX: "auto", maxWidth: "100%", margin: "0 -12px" }}
      role="region"
      aria-label="Your builds, table"
      tabIndex={0}
    >
      <table data-testid="build-stats-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {BUILD_TABLE_COLUMNS.map((column, index) => (
              <th key={column} scope="col" style={{ ...cellBase, height: 32, ...plain(textStep.meta, t.label), fontWeight: 400, textAlign: index === 0 ? "start" : "end" }}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((build) => (
            <BuildRow key={build.id} build={build} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div data-testid="build-stats-loading" role="status" aria-label="Loading your builds" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {[0, 1, 2].map((index) => (
        <span key={index} aria-hidden style={{ ...skeletonStyle(), display: "block", height: ROW - 4, borderRadius: 12 }} />
      ))}
    </div>
  );
}

export interface YourBuildsProps {
  stats: MyBuildStats | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}

/** "12 builds", "1 build". */
export const buildsFact = (count: number): string => `${count.toLocaleString("en-GB")} ${count === 1 ? "build" : "builds"}`;

/** The table headed by its fact; or the empty or refused state. */
export function YourBuilds({ stats, loading, error, onRetry }: YourBuildsProps) {
  let content: ReactNode;
  if (loading) content = <TableSkeleton />;
  else if (error && !stats) {
    content = (
      <div data-testid="build-stats-error" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
        <p style={plain(textStep.body, t.text)}>{isPermissionError(error) ? "You don't have access to this." : "Something went wrong."}</p>
        <Button type="button" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  } else if (!stats || stats.builds.length === 0) {
    content = (
      <div data-testid="build-stats-empty" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
        <p style={plain(textStep.body, t.text2)}>Publish a build and its numbers show up here.</p>
        <Button asChild variant="secondary">
          <Link to="/compose/new">New build</Link>
        </Button>
      </div>
    );
  } else {
    content = <BuildTable builds={stats.builds} />;
  }

  const count = stats?.builds.length ?? 0;
  return (
    <section data-testid="your-builds" aria-labelledby="your-builds-heading" style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <SectionHeading id="your-builds-heading">{loading || (error && !stats) ? "Your builds" : buildsFact(count)}</SectionHeading>
      {content}
    </section>
  );
}

/** Both sections, from one query: Needs you (only when something does), then the builds. */
export function BuildAnalytics() {
  const query = useMyBuildStats();
  const lines = query.data ? needsYou(query.data.builds) : [];
  return (
    <>
      <NeedsYou lines={lines} />
      <YourBuilds stats={query.data} loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} />
    </>
  );
}
