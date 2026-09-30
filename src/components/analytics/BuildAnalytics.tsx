// Analytics on builds: NEEDS YOU, then YOUR BUILDS (RC-P23).
//
// NEEDS YOU COMES FIRST ⟦better-layout › Order by importance⟧
// ⟦critique-information-density › Content Prioritisation⟧: the builds waiting
// on their maker, one line each, the build's title linking to it and the
// reason beside it in --text2. When nothing is waiting the section is not
// drawn at all: an empty "all clear" box would be a fifth thing to read.
//
// YOUR BUILDS is the maker's four figures, as on the profile, then one table
// of eight columns: Build, Got working, Last confirmed, Rebuilds, Likes,
// Comments, Saves, Open bounties. Numbers are DM Mono with tabular digits,
// aligned to the trailing edge ⟦layout-grid⟧ ⟦buildgallery-theme › Type⟧;
// Last confirmed is the Plaque's freshness wording, and a stale claim stays in
// --text2 with the word "stale" written out, never a warning colour
// ⟦buildgallery-theme › Plaque⟧. The order is stated in one sentence above the
// table and offered as no control ⟦hicks-law⟧. The table scrolls sideways
// inside its own new wrapper, so on a phone the page never widens
// ⟦better-layout⟧ (CONTRACT §2.2).
//
// STATES (STATES.md): loading is the final layout in --recess blocks (row 20);
// a refusal is its sentence and a secondary "Try again" (row 21); no published
// build is one sentence and a secondary "New build" (row 19), secondary
// because the page can already hold a filled button.

import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { NEVER_CONFIRMED } from "@/components/brand/Plaque";
import { MakerFigures } from "@/components/profile/MakerFigures";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getMyBuildStats, type BuildStatRow, type MyBuildStats } from "@/lib/analytics/buildStats";
import {
  BUILD_TABLE_ORDER,
  lastConfirmedText,
  needsYou,
  orderForTable,
  reasonText,
  type NeedsYouLine,
} from "@/lib/analytics/needsYou";
import { isPermissionError } from "@/lib/errors/permission";
import { FOCUS_RING_CLASS, ring, skeletonStyle } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, body, eyebrow, label as labelType, tabular } from "@/lib/theme/type";

/** The cache key of the page's build numbers. */
export const MY_BUILD_STATS_KEY = "my-build-stats";

/** The table's eight columns, in order. */
export const BUILD_TABLE_COLUMNS = [
  "Build",
  "Got working",
  "Last confirmed",
  "Rebuilds",
  "Likes",
  "Comments",
  "Saves",
  "Open bounties",
] as const;

/** The columns that hold numbers, aligned to the trailing edge. */
const NUMERIC = new Set<string>(["Got working", "Rebuilds", "Likes", "Comments", "Saves", "Open bounties"]);

const SECONDARY: CSSProperties = { background: "transparent", minHeight: 44 };

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

/** A section's heading on the progress page: the eyebrow, in --text2. RC-P27's sections spend it too. */
export function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} style={{ ...eyebrow, color: t.text2, margin: 0 }}>
      {children}
    </h2>
  );
}

/* ── NEEDS YOU ───────────────────────────────────────────────────────────── */

function BuildLink({ build }: { build: BuildStatRow }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to={`/b2/${build.slug}`}
      {...handlers}
      style={{
        ...body,
        color: t.text,
        textDecoration: "underline",
        textUnderlineOffset: "3px",
        textDecorationThickness: state.hovered ? "2px" : "1px",
        overflowWrap: "anywhere",
        ...ring(state.focusVisible),
      }}
    >
      {build.title}
    </Link>
  );
}

/** The builds waiting on their maker; renders nothing when there are none. */
export function NeedsYou({ lines }: { lines: NeedsYouLine[] }) {
  if (lines.length === 0) return null;
  return (
    <section
      data-testid="needs-you"
      aria-labelledby="needs-you-heading"
      style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}
    >
      <SectionHeading id="needs-you-heading">Needs you</SectionHeading>
      {/* 8 between builds and nothing inside one ⟦law-of-proximity⟧: on a
          phone a line wraps, title over reason, and the reason must read as
          its own title's, not the next one's. */}
      <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: SPACE.xs }}>
        {lines.map(({ build, reasons }) => (
          <li
            key={build.id}
            data-testid="needs-you-line"
            style={{
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              columnGap: SPACE.xs,
            }}
          >
            <BuildLink build={build} />
            <span style={{ ...body, color: t.text2 }}>{reasons.map(reasonText).join(" · ")}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── YOUR BUILDS ─────────────────────────────────────────────────────────── */

const cellBase: CSSProperties = {
  height: 44,
  paddingBlock: 0,
  paddingInline: SPACE.sm,
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};

function BuildTable({ builds }: { builds: BuildStatRow[] }) {
  const now = Date.now();
  const rows = orderForTable(builds);
  return (
    <div
      data-testid="build-stats-scroll"
      /* A scrollable region is reachable by keyboard, and shows the theme's
         one focus ring when it is (the kit's utilities, for an element that
         tracks no other state). */
      className={FOCUS_RING_CLASS}
      style={{ overflowX: "auto", maxWidth: "100%" }}
      role="region"
      aria-label="Your builds, table"
      tabIndex={0}
    >
      <table data-testid="build-stats-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {BUILD_TABLE_COLUMNS.map((column, index) => (
              <th
                key={column}
                scope="col"
                style={{
                  ...cellBase,
                  ...labelType,
                  color: t.text2,
                  textAlign: NUMERIC.has(column) ? "end" : "start",
                  paddingInlineStart: index === 0 ? 0 : SPACE.sm,
                }}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((build) => {
            const confirmed = lastConfirmedText(build, now);
            const numbers = [
              build.worked,
              build.rebuild_count,
              build.like_count,
              build.comment_count,
              build.save_count,
              build.open_bounties,
            ];
            return (
              <tr key={build.id} data-testid="build-stats-row" style={{ borderTop: `1px solid ${t.line}` }}>
                <th
                  scope="row"
                  /* The one column that wraps: a long title grows its row
                     rather than the table. */
                  style={{ ...cellBase, whiteSpace: "normal", minWidth: 160, paddingInlineStart: 0, textAlign: "start", fontWeight: 400 }}
                >
                  <BuildLink build={build} />
                </th>
                <td style={{ ...cellBase, ...numberCell }}>{build.worked.toLocaleString("en-GB")}</td>
                <td
                  data-testid="build-stats-confirmed"
                  data-stale={confirmed.stale ? "true" : undefined}
                  /* body first, then the cell: body's text-wrap would
                     otherwise undo the cell's nowrap. */
                  style={{ ...body, ...cellBase, fontSize: 14, color: confirmed.stale ? t.text2 : t.text }}
                >
                  {confirmed.text ?? NEVER_CONFIRMED}
                  {confirmed.stale ? " · stale" : ""}
                </td>
                {numbers.slice(1).map((value, index) => (
                  <td key={index} style={{ ...cellBase, ...numberCell }}>
                    {value.toLocaleString("en-GB")}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const numberCell: CSSProperties = {
  fontFamily: DM_MONO,
  fontSize: 14,
  color: t.text,
  textAlign: "end",
  ...tabular,
};

function TableSkeleton() {
  return (
    <div data-testid="build-stats-loading" role="status" aria-label="Loading your builds" style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
      {[0, 1, 2].map((index) => (
        <span key={index} aria-hidden style={{ ...skeletonStyle(), display: "block", height: 44 }} />
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

/** The four figures, then the table; or the empty or refused state. */
export function YourBuilds({ stats, loading, error, onRetry }: YourBuildsProps) {
  let content: ReactNode;
  if (loading) content = <TableSkeleton />;
  else if (error && !stats) {
    content = (
      <div data-testid="build-stats-error" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: SPACE.xs }}>
        <p style={{ ...body, color: t.text, margin: 0 }}>
          {isPermissionError(error) ? "You don't have access to this." : "Something went wrong."}
        </p>
        <Button type="button" variant="outline" onClick={onRetry} style={SECONDARY}>
          Try again
        </Button>
      </div>
    );
  } else if (!stats || stats.builds.length === 0) {
    content = (
      <div data-testid="build-stats-empty" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: SPACE.sm }}>
        <p style={{ ...body, color: t.text2, margin: 0 }}>Publish a build and its numbers show up here.</p>
        <Button asChild variant="outline" style={SECONDARY}>
          <Link to="/compose/new">New build</Link>
        </Button>
      </div>
    );
  } else {
    content = (
      <>
        <p data-testid="build-stats-order" style={{ ...body, color: t.text2, margin: 0 }}>
          {BUILD_TABLE_ORDER}
        </p>
        <BuildTable builds={stats.builds} />
      </>
    );
  }

  return (
    <section
      data-testid="your-builds"
      aria-labelledby="your-builds-heading"
      style={{ display: "flex", flexDirection: "column", gap: SPACE.sm, minWidth: 0 }}
    >
      <SectionHeading id="your-builds-heading">Your builds</SectionHeading>
      {error && !stats ? null : (
        <MakerFigures stats={stats?.figures} loading={loading} error={null} onRetry={onRetry} />
      )}
      {content}
    </section>
  );
}

/** Both sections, from one query: Needs you (only when something does), then Your builds. */
export function BuildAnalytics() {
  const query = useMyBuildStats();
  const lines = query.data ? needsYou(query.data.builds) : [];
  return (
    <>
      <NeedsYou lines={lines} />
      <YourBuilds
        stats={query.data}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    </>
  );
}
