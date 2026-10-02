/* UI-P28 — Gallery, as the reference draws it (design/reference/{desktop,mobile}/{noon,dusk}/gallery.html).

   PURE. Props in, markup out: no fetching, no `useAuth()`, no router hooks but
   `Link`. `GalleryPage` supplies live data; the dev compare page supplies the
   sample. The viewport is read here (the 768px breakpoint) so both agree.

   DESKTOP: a column — the header panel (the title, the four lenses with their
   counts, the stats wall label) over a `230px minmax(0, 1fr)` grid that fills:
   the facet column and the wall. PHONE: the heading, the lens chips, search and
   Filters, the stats, the featured build stacked, the wall in two columns.

   THE ADDRESS IS THE STATE, and it is not held here: every control is a callback
   the page answers by writing the address (lens, facets, shapes, search). The one
   piece of state this file owns is whether the phone's Filters sheet is open.

   EVERY COLOUR IS A TOKEN, and `line-height: normal` is written wherever the
   reference sets none — the app's body leading is looser and these boxes are
   measured in pixels. */

import { Fragment, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Check, Search, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/brand/Button";
import { EmptyState } from "@/components/brand/EmptyState";
import { ErrorState, type PanelFailure } from "@/components/brand/ErrorState";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { FilterChip } from "@/components/brand/FilterChip";
import { HeroPlate } from "@/components/brand/HeroPlate";
import { PageHeading } from "@/components/brand/PageHeading";
import { Panel } from "@/components/brand/Panel";
import { PictureLamp } from "@/components/brand/PictureLamp";
import { Plaque, plaqueState } from "@/components/brand/Plaque";
import { Stat } from "@/components/brand/Stat";
import { WallLabel } from "@/components/brand/WallLabel";
import { Segmented } from "@/components/brand/Segmented";
import { CardSkeleton, LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { ScrollRow } from "@/components/shell/ScrollRow";
import { boardHeight, type PageFit } from "@/components/shell/siteFrameFit";
import { useIsPhone } from "@/components/shell/useMinWidth";
import type { GalleryLens } from "@/lib/build/gallery";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, display } from "@/lib/theme/type";

import {
  FACET_SKELETON_ROWS,
  LENS_ITEMS,
  formatCount,
  formatPounds,
  lensLabel,
  weekBar,
  type FacetGroupView,
  type FeaturedView,
  type GalleryStatsView,
  type GalleryWallState,
} from "./galleryModel";

/* ── the view's props ── */

export interface GalleryViewProps {
  fit?: PageFit;
  /** The clock the plaques read. The compare page freezes it. */
  now?: number;
  lens: GalleryLens;
  onLensChange: (lens: GalleryLens) => void;
  /** Builds under each lens; null until known. */
  lensCounts: Record<GalleryLens, number> | null;
  /** Null until known: the cells hold bones, never a made-up number. */
  stats: GalleryStatsView | null;
  /** The figures could not be read: the header's figures say so, in place of the cells. */
  statsError?: PanelFailure;
  facets: readonly FacetGroupView[];
  /** The tidied search, or null. */
  query: string | null;
  onSearch: (query: string | null) => void;
  /** Filters, shapes and the query that are on, for "Filters · n". */
  appliedCount: number;
  /** Everything narrowing the gallery: a lens, a facet, a shape or a search. */
  narrowed: boolean;
  /** Back to the whole gallery: lens, facets, shapes and search cleared. */
  onClearAll: () => void;
  /** Builds matching the filters, for the sheet's "Show n builds"; null if unknown. */
  total: number | null;
  /** The featured build: first page, nothing narrowing, and only when there is one. */
  featured: FeaturedView | null;
  /** Between the header and the wall: the makers a search names. */
  aboveWall?: ReactNode;
  wall: GalleryWallState;
  /** Navigation from a button (links are links). */
  onNavigate: (to: string) => void;
}

const ORDER_NOTE = "MOST REPRODUCED FIRST, THEN MOST RECENTLY CONFIRMED";

const INTRO_DESKTOP =
  "Written down completely enough to follow, ordered by how many people other than their maker have run them and said what happened.";
const INTRO_PHONE =
  "Written down completely enough to follow, ordered by how many people other than their maker have run them.";

const FEATURED_TAG = "MOST REPRODUCED THIS MONTH";

/** Wall card slots on the board: two rows of 250. */
const ROW = 250;

/** The featured build's stacked plate on a phone: the cover, the inverse panel and the rank square across both. */
const FEATURED_PHONE_HEIGHT = 390;

/* ── small shared pieces ── */

const mono = (px: number, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: DM_MONO,
  fontSize: px,
  lineHeight: "normal",
  ...extra,
});

/** The wall's grid: four columns of cards 14 apart, two rows of 250 on the board and rows that grow with their cards elsewhere. */
function wallGrid(columns: 2 | 4, board: boolean): CSSProperties {
  return columns === 4
    ? {
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gridTemplateRows: board ? `${ROW}px ${ROW}px` : undefined,
        gridAutoRows: board ? undefined : `minmax(${ROW}px, auto)`,
        gap: 14,
      }
    : { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "6px 10px" };
}

/* ── the header ── */

function LensControl({
  lens,
  counts,
  onChange,
}: {
  lens: GalleryLens;
  counts: GalleryViewProps["lensCounts"];
  onChange: (lens: GalleryLens) => void;
}) {
  return (
    <Segmented<GalleryLens>
      label="Lens"
      size={36}
      fontSize={12}
      value={lens}
      onChange={onChange}
      items={LENS_ITEMS.map((item) => ({ value: item.value, label: lensLabel(item.label, counts?.[item.value]) }))}
    />
  );
}

/** A figure before it has arrived: a bone as tall as the number's line (25px), so the cell is the height it will be. */
const figureBone = <Skeleton width={64} height={22} style={{ margin: "1px 0 2px" }} />;

/** The figures could not be read: the label's own box, as tall as the label, holding the failure. */
function StatsFailed({ failure, phone }: { failure: PanelFailure; phone: boolean }) {
  return (
    <div
      data-testid="gallery-stats-error"
      style={{
        minHeight: phone ? 169 : 84,
        boxSizing: "border-box",
        padding: "12px 14px",
        borderRadius: r.control,
        border: `1px solid ${t.line}`,
        display: "flex",
        alignItems: "center",
      }}
    >
      <ErrorState panel="Gallery figures" onRetry={failure.onRetry} error={failure.error} />
    </div>
  );
}

function StatsLabel({ stats, columns, failure }: { stats: GalleryStatsView | null; columns: 2 | 4; failure?: PanelFailure }) {
  const phone = columns === 2;
  if (failure && !stats) return <StatsFailed failure={failure} phone={phone} />;

  const loading = stats === null;
  const week = stats ? weekBar(stats) : null;
  const goal = stats?.weeklyGoal ?? null;

  const cells = [
    <Stat key="in" label="In the gallery" value={stats ? formatCount(stats.inGallery) : figureBone} />,
    <Stat
      key="week"
      label={phone ? "This week" : "Reproduced this week"}
      value={stats ? formatCount(stats.reproducedThisWeek) : figureBone}
      barLoading={loading}
      of={!phone && goal ? formatCount(goal) : undefined}
      bar={
        week
          ? {
              value: week.value,
              colour: t.lit,
              label: "Reproduced this week",
              valueText: week.of
                ? `${formatCount(stats!.reproducedThisWeek)} of ${formatCount(week.of)}`
                : `${formatCount(stats!.reproducedThisWeek)} against ${formatCount(stats!.reproducedLastWeek ?? 0)} last week`,
            }
          : undefined
      }
    />,
    <Stat
      key="fresh"
      label={phone ? "Fresh" : "Fresh · under 120 days"}
      value={stats ? `${stats.freshPct}%` : figureBone}
      barLoading={loading}
      bar={
        stats
          ? { value: stats.freshPct, colour: t.evidence, label: "Fresh, confirmed within 120 days", valueText: `${stats.freshPct}%` }
          : undefined
      }
    />,
    <Stat
      key="bounties"
      label={phone ? "Open asks" : "Open bounties"}
      value={stats ? formatPounds(stats.poolGbp) : figureBone}
      barLoading={loading}
      of={!phone && stats ? `${formatCount(stats.open)} ${stats.open === 1 ? "ask" : "asks"}` : undefined}
      bar={
        stats
          ? {
              value: stats.open > 0 ? Math.min(100, Math.round((stats.withSolutions / stats.open) * 100)) : 0,
              colour: t.action,
              label: "Open asks with a solution",
              valueText: `${stats.withSolutions} of ${stats.open}`,
            }
          : undefined
      }
    />,
  ];

  const label = <WallLabel columns={columns} cells={cells} />;
  return loading ? (
    <LoadingRegion what="the gallery’s figures" data-testid="gallery-stats-loading">
      {label}
    </LoadingRegion>
  ) : (
    label
  );
}

function QueryLine({ query, onSearch }: { query: string; onSearch: (query: string | null) => void }) {
  return (
    <div data-testid="gallery-query" style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontFamily: FIGTREE, fontSize: 13, lineHeight: "normal", color: t.text2 }}>
        Results for “{query}”
      </span>
      <Button variant="secondary" size={28} fontSize={11} onClick={() => onSearch(null)}>
        Clear search
      </Button>
    </div>
  );
}

/* ── the facets ── */

function FacetButton({ row, height, fontSize, countSize }: { row: FacetGroupView["rows"][number]; height: number; fontSize: number; countSize: number }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-pressed={row.selected}
      onClick={row.onToggle}
      {...handlers}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height,
        width: "100%",
        padding: 0,
        border: 0,
        background: "transparent",
        textAlign: "left",
        cursor: "pointer",
        borderRadius: r.chip,
        ...ring(state.focusVisible),
      }}
    >
      <span
        style={{
          fontFamily: FIGTREE,
          fontSize,
          lineHeight: "normal",
          fontWeight: row.selected ? 600 : 400,
          color: t.text,
          flexGrow: 1,
          minWidth: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {row.label}
      </span>
      {row.selected && height > 30 ? <Check size={16} strokeWidth={1.8} aria-hidden="true" style={{ flexShrink: 0 }} /> : null}
      <span style={mono(countSize, { color: t.label, width: 30, textAlign: "right", flexShrink: 0 })}>
        {formatCount(row.count)}
      </span>
    </button>
  );
}

/** The mini bar: 44×4, `--bar-base`, filled in `--label` at count / the group's largest. */
function MiniBar({ percent }: { percent: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: 44, height: 4, borderRadius: 2, background: t.barBase, display: "flex", overflow: "hidden", flexShrink: 0 }}
    >
      <span style={{ width: `${percent}%`, background: t.label }} />
    </span>
  );
}

/** A facet row before it has arrived: the row's own height (23 on the desktop column, 44 in the phone's sheet) with a name, a bar and a count. */
function FacetRowSkeleton({ phone }: { phone: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, height: phone ? 44 : 23 }}>
      <Skeleton width="auto" height={phone ? 14 : 12} style={{ flex: "0 1 110px", minWidth: 0 }} />
      <span style={{ flexGrow: 1 }} />
      {phone ? null : <Skeleton width={44} height={4} radius={2} />}
      <Skeleton width={30} height={phone ? 11 : 10} />
    </div>
  );
}

/** A facet group's rows: bones while it loads, its own failure if its counts could not be read, else the toggles. A group with no counts never gets here: it is left out. */
function FacetGroupBody({ group, phone }: { group: FacetGroupView; phone: boolean }) {
  if (group.failure) {
    return (
      <ErrorState
        panel={`${group.label} filters`}
        onRetry={group.failure.onRetry}
        error={group.failure.error}
        data-testid={`gallery-facets-${group.key}-error`}
      />
    );
  }

  if (group.loading) {
    return (
      <LoadingRegion
        what={`${group.label.toLowerCase()} filters`}
        data-testid={`gallery-facets-${group.key}-loading`}
        style={{ display: "flex", flexDirection: "column", gap: phone ? 0 : 6 }}
      >
        {Array.from({ length: FACET_SKELETON_ROWS[group.key] }, (_, i) => (
          <FacetRowSkeleton key={i} phone={phone} />
        ))}
      </LoadingRegion>
    );
  }

  const max = Math.max(1, ...group.rows.map((row) => row.count));
  return (
    <>
      {group.rows.map((row) =>
        phone ? (
          <FacetButton key={row.value} row={row} height={44} fontSize={14} countSize={11} />
        ) : (
          <DesktopFacetRow key={row.value} row={row} percent={Math.round((row.count / max) * 100)} />
        ),
      )}
    </>
  );
}

/** The groups worth drawing: those still loading, those that failed and those with a count to show. */
const drawn = (groups: readonly FacetGroupView[]) =>
  groups.filter((group) => group.loading || group.failure || group.rows.length > 0);

function FacetColumn({ groups }: { groups: readonly FacetGroupView[] }) {
  return (
    <Panel padding="4px 16px" style={{ height: "100%" }}>
      <nav aria-label="Filter the gallery">
        {drawn(groups).map((group) => (
          <div
            key={group.key}
            data-testid={`gallery-facets-${group.key}`}
            style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 0", borderBottom: `1px solid ${t.hairline}` }}
          >
            <Eyebrow size={10}>{group.label}</Eyebrow>
            <FacetGroupBody group={group} phone={false} />
          </div>
        ))}
      </nav>
    </Panel>
  );
}

/** One desktop facet row: name, mini bar, count — all one toggle button, 23px tall. */
function DesktopFacetRow({ row, percent }: { row: FacetGroupView["rows"][number]; percent: number }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-pressed={row.selected}
      onClick={row.onToggle}
      {...handlers}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 23,
        width: "100%",
        padding: 0,
        border: 0,
        background: "transparent",
        textAlign: "left",
        cursor: "pointer",
        borderRadius: r.chip,
        ...ring(state.focusVisible),
      }}
    >
      <span
        style={{
          fontFamily: FIGTREE,
          fontSize: 12,
          lineHeight: "normal",
          fontWeight: row.selected ? 600 : 400,
          color: t.text,
          flexGrow: 1,
          minWidth: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {row.label}
      </span>
      <MiniBar percent={percent} />
      <span style={mono(10, { color: t.label, width: 30, textAlign: "right", flexShrink: 0 })}>{formatCount(row.count)}</span>
    </button>
  );
}

/* ── the wall ── */

function MoreButton({ wall, phone }: { wall: GalleryWallState; phone: boolean }) {
  if (!wall.hasMore) return null;
  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: 14, gridColumn: "1 / -1" }}>
      <Button variant="secondary" size={phone ? 44 : 34} fontSize={phone ? 13 : 12} disabled={wall.loadingMore} onClick={wall.onMore}>
        {wall.loadingMore ? "Loading…" : "Show more"}
      </Button>
    </div>
  );
}

function WallStates({
  wall,
  narrowed,
  onClearAll,
  onNavigate,
}: Pick<GalleryViewProps, "wall" | "narrowed" | "onClearAll" | "onNavigate">) {
  if (wall.status === "error") {
    return (
      <div data-testid="gallery-notice">
        <Panel padding="16px 18px">
          {/* A refusal is its own sentence, never an empty gallery. */}
          <ErrorState
            line={wall.errorKind === "permission" ? "You don't have access to this." : undefined}
            panel="The gallery"
            onRetry={wall.onRetry}
            error={wall.error}
          />
        </Panel>
      </div>
    );
  }

  return (
    <div data-testid="gallery-notice">
      <Panel padding="0 18px">
        {narrowed ? (
          <EmptyState line="Nothing here yet." action={{ label: "See all builds", onClick: onClearAll }} />
        ) : (
          <EmptyState
            line="Nothing has been shown here yet."
            action={{ label: "Show what you built", onClick: () => onNavigate("/compose/new") }}
          />
        )}
      </Panel>
    </div>
  );
}

/** The wall before it has arrived: a plate and six cards where the featured build leads, eight cards where nothing does. */
function WallSkeleton({ board, phone, leadsWithFeatured }: { board: boolean; phone: boolean; leadsWithFeatured: boolean }) {
  if (phone) {
    return (
      <LoadingRegion what="the gallery" data-testid="gallery-loading" style={wallGrid(2, false)}>
        {Array.from({ length: 6 }, (_, i) => (
          <CardSkeleton key={i} cover={96} body={144} />
        ))}
      </LoadingRegion>
    );
  }
  return (
    <LoadingRegion what="the gallery" data-testid="gallery-loading" style={wallGrid(4, board)}>
      {leadsWithFeatured ? (
        <div style={{ gridColumn: "span 2", minHeight: ROW, minWidth: 0, display: "flex" }}>
          <Skeleton height="auto" radius={r.panel} style={{ flexGrow: 1 }} />
        </div>
      ) : null}
      {Array.from({ length: leadsWithFeatured ? 6 : 8 }, (_, i) => (
        <div key={i} style={{ minWidth: 0 }}>
          <CardSkeleton cover={92} />
        </div>
      ))}
    </LoadingRegion>
  );
}

/** The featured build as a link around the reference's plate (desktop). */
function FeaturedDesktop({ featured, now }: { featured: FeaturedView; now?: number }) {
  return (
    <div style={{ gridColumn: "span 2", minHeight: ROW, minWidth: 0 }}>
      <Link
        to={featured.to}
        data-testid="gallery-featured"
        aria-label={`Most reproduced this month: ${featured.title}`}
        style={{ display: "block", height: "100%", textDecoration: "none", color: "inherit" }}
      >
        <HeroPlate
          variant="featured"
          cover={featured.cover}
          title={featured.title}
          outcome={featured.outcome}
          build={featured.build}
          rank={1}
          now={now}
        />
      </Link>
    </div>
  );
}

/** The featured build, stacked (phone): the cover with its tag, the inverse panel, the rank square across both. */
function FeaturedPhone({ featured, now }: { featured: FeaturedView; now?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <PictureLamp state={plaqueState(featured.build, now)} />
      <Link
        to={featured.to}
        data-testid="gallery-featured"
        aria-label={`Most reproduced this month: ${featured.title}`}
        style={{
          position: "relative",
          display: "block",
          borderRadius: r.panel,
          overflow: "hidden",
          boxShadow: t.shadowCard,
          border: `1px solid ${t.glassBorder}`,
          textDecoration: "none",
          color: t.onInverse,
        }}
      >
        <div style={{ height: 190, position: "relative" }}>
          {featured.cover}
          <span
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              background: t.mediaTag,
              color: t.text,
              ...mono(10, { padding: "3px 8px", borderRadius: r.chip }),
            }}
          >
            {FEATURED_TAG}
          </span>
        </div>
        <div
          style={{
            background: t.inverse,
            color: t.onInverse,
            padding: "18px 18px 18px 104px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            minHeight: 120,
            boxSizing: "border-box",
          }}
        >
          <div style={{ ...display(26), textWrap: "wrap", color: "inherit" }}>{featured.title}</div>
          <div style={{ fontFamily: FIGTREE, fontSize: 13, lineHeight: 1.45, color: t.onInverse2 }}>{featured.outcome}</div>
          <Plaque build={featured.build} size="card" tone="inverse" now={now} />
        </div>
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 14,
            top: 160,
            width: 78,
            height: 78,
            borderRadius: 14,
            background: t.inverse,
            color: t.onInverse,
            border: `2px solid ${t.onInverse}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: t.shadowSquare,
          }}
        >
          <span style={mono(10, { letterSpacing: ".1em", opacity: 0.7 })}>NO.</span>
          <span style={{ ...display(36), letterSpacing: "-0.04em" }}>01</span>
        </div>
      </Link>
    </div>
  );
}

/* ── desktop ── */

function DesktopGallery(props: GalleryViewProps) {
  const { fit = "content", now, lens, onLensChange, lensCounts, stats, statsError, facets, query, onSearch, narrowed, onClearAll, featured, aboveWall, wall, onNavigate } =
    props;
  const board = fit === "board";
  /* No counts is no group, and no group at all is no column: the wall takes the width. */
  const showFacets = drawn(facets).length > 0;

  return (
    <div
      data-testid="gallery-view"
      data-viewport="desktop"
      style={{ display: "flex", flexDirection: "column", gap: 12, ...boardHeight(fit) }}
    >
      <div style={{ flexShrink: 0 }}>
        <Panel padding="18px 20px">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Eyebrow>Gallery</Eyebrow>
              <h1 style={{ ...display(50), margin: 0, color: t.text }}>Builds worth running</h1>
              <div style={{ fontFamily: FIGTREE, fontSize: 13, color: t.text2, maxWidth: 560, lineHeight: 1.5 }}>{INTRO_DESKTOP}</div>
              {query ? <QueryLine query={query} onSearch={onSearch} /> : null}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
              <LensControl lens={lens} counts={lensCounts} onChange={onLensChange} />
              <span style={mono(11, { color: t.label })}>{ORDER_NOTE}</span>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <StatsLabel stats={stats} columns={4} failure={statsError} />
          </div>
        </Panel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: showFacets ? "230px minmax(0, 1fr)" : "minmax(0, 1fr)", gap: 12, flexGrow: 1, minHeight: 0 }}>
        {showFacets ? (
          <div style={{ minHeight: 0 }}>
            <FacetColumn groups={facets} />
          </div>
        ) : null}
        <div style={{ minHeight: 0, minWidth: 0, overflow: board ? "hidden" : undefined, padding: "0 4px" }}>
          {aboveWall}
          {wall.status === "loading" ? (
            <WallSkeleton board={board} phone={false} leadsWithFeatured={!narrowed} />
          ) : wall.status === "error" || (wall.cards.length === 0 && !featured) ? (
            <WallStates wall={wall} narrowed={narrowed} onClearAll={onClearAll} onNavigate={onNavigate} />
          ) : (
            <div data-testid="gallery-wall" style={wallGrid(4, board)}>
              {featured ? <FeaturedDesktop featured={featured} now={now} /> : null}
              {wall.cards.map((card) => (
                <Fragment key={card.key}>{card.render("desktop")}</Fragment>
              ))}
              <MoreButton wall={wall} phone={false} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── phone ── */

function SearchField({ query, onSearch }: { query: string | null; onSearch: (query: string | null) => void }) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    onSearch(value === "" ? null : value);
  };
  return (
    <form
      role="search"
      onSubmit={submit}
      style={{
        flexGrow: 1,
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 44,
        padding: "0 12px",
        borderRadius: r.control,
        background: t.field,
        border: `1px solid ${t.line}`,
        color: t.text2,
        /* The reference's 44 is the field's content box: 46 with its 1px border, and the Filters button beside it is 44. */
        boxSizing: "content-box",
      }}
    >
      <Search size={16} strokeWidth={1.6} aria-hidden="true" style={{ flexShrink: 0 }} />
      <input
        // Re-keyed by the address's query, so a cleared or changed search shows what the page is showing.
        key={query ?? ""}
        type="search"
        name="q"
        aria-label="Search builds"
        placeholder="Search builds"
        defaultValue={query ?? ""}
        style={{
          background: "transparent",
          border: 0,
          outline: "none",
          /* A search input draws its own field unless told not to. */
          WebkitAppearance: "none",
          appearance: "none",
          flexGrow: 1,
          minWidth: 0,
          fontFamily: FIGTREE,
          /* 16px, the iOS minimum: the reference's 15px would zoom the page on focus. */
          fontSize: 16,
          color: t.text,
        }}
      />
    </form>
  );
}

function PhoneGallery(props: GalleryViewProps) {
  const { now, lens, onLensChange, lensCounts, stats, statsError, facets, query, onSearch, appliedCount, narrowed, onClearAll, total, featured, aboveWall, wall, onNavigate } =
    props;
  const [sheet, setSheet] = useState(false);
  /* Nothing to filter by is no Filters button: the search takes its place. */
  const showFacets = drawn(facets).length > 0;

  return (
    <div data-testid="gallery-view" data-viewport="mobile" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <PageHeading eyebrow="Gallery" title="Builds worth running" sub={INTRO_PHONE} size={36} />

      <ScrollRow gap={6} label="Lens">
        {LENS_ITEMS.map((item) => (
          <FilterChip
            key={item.value}
            label={item.label}
            count={lensCounts ? formatCount(lensCounts[item.value]) : undefined}
            on={lens === item.value}
            onClick={() => onLensChange(item.value)}
          />
        ))}
      </ScrollRow>

      <div style={{ display: "flex", gap: 8 }}>
        <SearchField query={query} onSearch={onSearch} />
        {showFacets ? (
          <Button variant="secondary" size={44} fontSize={13} icon={SlidersHorizontal} onClick={() => setSheet(true)}>
            {appliedCount > 0 ? `Filters · ${appliedCount}` : "Filters"}
          </Button>
        ) : null}
      </div>
      {query ? <QueryLine query={query} onSearch={onSearch} /> : null}

      <StatsLabel stats={stats} columns={2} failure={statsError} />

      {featured && wall.status === "ready" ? <FeaturedPhone featured={featured} now={now} /> : null}
      {wall.status === "loading" && !narrowed ? (
        <Skeleton height={FEATURED_PHONE_HEIGHT} radius={r.panel} />
      ) : null}

      <div style={mono(11, { color: t.label, padding: "0 2px" })}>{ORDER_NOTE}</div>

      {aboveWall}
      {wall.status === "loading" ? (
        <WallSkeleton board={false} phone leadsWithFeatured={false} />
      ) : wall.status === "error" || wall.cards.length === 0 ? (
        <WallStates wall={wall} narrowed={narrowed} onClearAll={onClearAll} onNavigate={onNavigate} />
      ) : (
        <div data-testid="gallery-wall" style={wallGrid(2, false)}>
          {wall.cards.map((card) => (
            <Fragment key={card.key}>{card.render("phone")}</Fragment>
          ))}
          <MoreButton wall={wall} phone />
        </div>
      )}

      <BottomSheet open={sheet} onOpenChange={setSheet} title="Filters">
        {drawn(facets).map((group) => (
          <div key={group.key} style={{ display: "flex", flexDirection: "column" }}>
            <Eyebrow size={10} style={{ marginBottom: 4 }}>
              {group.label}
            </Eyebrow>
            <FacetGroupBody group={group} phone />
          </div>
        ))}
        <Button size={48} fontSize={14} fullWidth onClick={() => setSheet(false)}>
          {total === null ? "Show builds" : `Show ${formatCount(total)} ${total === 1 ? "build" : "builds"}`}
        </Button>
      </BottomSheet>
    </div>
  );
}

export function GalleryView(props: GalleryViewProps) {
  const phone = useIsPhone();
  return phone ? <PhoneGallery {...props} /> : <DesktopGallery {...props} />;
}

export default GalleryView;
