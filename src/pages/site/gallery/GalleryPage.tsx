/* UI-P28 — `/gallery` in the site frame: the container.

   Loads the Gallery's data through `src/lib/` functions only, maps it to
   `GalleryView`'s props and renders it. No Supabase call in this file.

   THE ADDRESS IS THE STATE, EXACTLY AS BEFORE. Lens, Made for, Made with, the
   query — and, new, Shape — are read from the URL with `parseGalleryParams` and
   every change writes it with `galleryHref`; an address the gallery cannot read
   in full is replaced by the one it can. Nothing about what the reader is
   looking at lives only here.

   THE WALL PAGES THE WAY THE LISTING DOES (24 an offset), but appends: "Show
   more" fetches the next 24 and adds them below, instead of replacing the page.
   A new view starts again at the first page, because the filters are in the key.

   EACH PANEL LOADS ON ITS OWN. A slow stats row never holds the wall back, and
   a facet request that fails costs the facet column, never the wall. */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { SeoHead } from "@/components/SeoHead";
import { CoverFallback } from "@/components/brand/CoverFallback";
import { GalleryCard } from "@/components/gallery/GalleryCard";
import { coverMedia, mediaAlt, cardMedia, stillFor, useSignedMedia } from "@/components/gallery/cardMedia";
import { useAuth } from "@/contexts/AuthContext";
import { engagementFor, useEngagement } from "@/hooks/useEngagement";
import { getOpenBountyPool } from "@/lib/bounty/bounties";
import {
  GALLERY_PAGE_SIZE,
  galleryHref,
  getGalleryFacets,
  listGallery,
  parseGalleryParams,
  type GalleryBuild,
  type GalleryPage as GalleryPageData,
  type GalleryParams,
} from "@/lib/build";
import {
  countGalleryLenses,
  getFeaturedBuild,
  getGalleryShapeFacets,
  getGalleryStats,
} from "@/lib/build/gallery";
import { countRunsLastWeek } from "@/lib/build/signals";
import { isPermissionError } from "@/lib/errors/permission";
import { searchMakers } from "@/lib/profile/searchMakers";
import { useReveal } from "@/lib/theme/useReveal";

import { MakersRow, Shortfall } from "./GalleryExtras";
import { GalleryView } from "./GalleryView";
import {
  topOptions,
  type FacetGroupView,
  type FeaturedView,
  type GalleryStatsView,
  type WallCard,
} from "./galleryModel";

/** Facets change far more slowly than the builds they describe. */
const FACETS_STALE_MS = 5 * 60 * 1000;
/** The headline counts are estimates; a minute is as fresh as they mean to be. */
const COUNTS_STALE_MS = 60 * 1000;

/** How many options each facet group offers before the rest. */
const TOP_ROLES = 4;
const TOP_TOOLS = 4;
const TOP_SHAPES = 6;

/** Between one card and the next in the entrance stagger, and how many steps it takes. */
const REVEAL_STEP = 50;
const REVEAL_MAX_STEPS = 8;

const EMPTY_BUILDS: GalleryBuild[] = [];

const toggled = (current: readonly string[], value: string) =>
  current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];

/** A wall cell, revealed once as it first nears the viewport (the existing stagger). */
function Reveal({ index, animate, children }: { index: number; animate: boolean; children: ReactNode }) {
  const { ref, style, shown } = useReveal({ enabled: animate, delayMs: Math.min(index, REVEAL_MAX_STEPS) * REVEAL_STEP });
  return (
    <div ref={ref} data-visual-slot="gallery-grid-cell" data-revealed={shown ? "" : undefined} style={{ ...style, minWidth: 0 }}>
      {children}
    </div>
  );
}

export function GalleryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();

  const params = useMemo(() => parseGalleryParams(searchParams), [searchParams]);
  const { lens, madeFor, madeWith, query } = params;
  const shapes = params.shapes ?? [];

  /** Every filter change writes the address; the query keys follow it. */
  const go = (next: Partial<GalleryParams>) => navigate(galleryHref({ ...params, ...next }));

  /* An address the gallery cannot read in full (an unknown lens, a one-letter
     query, focus=search) is replaced by the one it can, so the address always
     says exactly what the page is showing. */
  const written = searchParams.toString();
  useEffect(() => {
    const canonical = galleryHref(params);
    const current = written ? `${pathname}?${written}` : pathname;
    if (current !== canonical) navigate(canonical, { replace: true });
  }, [written, pathname, params, navigate]);

  /* ── the wall ── */

  const wallQuery = useInfiniteQuery<GalleryPageData, Error, { pages: GalleryPageData[] }, unknown[], number>({
    queryKey: ["gallery", "wall", { lens, madeFor, madeWith, shapes, query }],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listGallery({ lens, madeFor, madeWith, shapes, query: query ?? undefined, offset: pageParam, limit: GALLERY_PAGE_SIZE }),
    getNextPageParam: (last, all) => {
      const loaded = all.length * GALLERY_PAGE_SIZE;
      const more = last.total === null ? last.builds.length === GALLERY_PAGE_SIZE : loaded < last.total;
      return more ? loaded : undefined;
    },
    // The previous wall stays up while the next view loads, so a filter change does not blank the page.
    placeholderData: keepPreviousData,
  });

  const builds = useMemo(() => {
    const seen = new Set<string>();
    const out: GalleryBuild[] = [];
    for (const page of wallQuery.data?.pages ?? []) {
      for (const build of page.builds) {
        if (seen.has(build.id)) continue;
        seen.add(build.id);
        out.push(build);
      }
    }
    return out.length > 0 ? out : EMPTY_BUILDS;
  }, [wallQuery.data]);

  const pages = wallQuery.data?.pages ?? [];
  const total = pages.length > 0 ? pages[pages.length - 1].total : null;

  const narrowed = lens !== "all" || madeFor.length > 0 || madeWith.length > 0 || shapes.length > 0 || query !== null;

  /* ── the panels ── */

  const facets = useQuery({ queryKey: ["gallery-facets"], queryFn: getGalleryFacets, staleTime: FACETS_STALE_MS });
  const shapeFacets = useQuery({
    queryKey: ["gallery", "getGalleryShapeFacets"],
    queryFn: getGalleryShapeFacets,
    staleTime: FACETS_STALE_MS,
  });
  const lensCounts = useQuery({ queryKey: ["gallery", "countGalleryLenses"], queryFn: countGalleryLenses, staleTime: COUNTS_STALE_MS });
  const statsQuery = useQuery({ queryKey: ["gallery", "getGalleryStats"], queryFn: getGalleryStats, staleTime: COUNTS_STALE_MS });
  const poolQuery = useQuery({ queryKey: ["bounty", "getOpenBountyPool"], queryFn: getOpenBountyPool, staleTime: COUNTS_STALE_MS });
  const lastWeek = useQuery({ queryKey: ["build", "countRunsLastWeek"], queryFn: () => countRunsLastWeek(), staleTime: COUNTS_STALE_MS });
  const featuredQuery = useQuery({
    queryKey: ["gallery", "getFeaturedBuild"],
    queryFn: () => getFeaturedBuild(),
    staleTime: COUNTS_STALE_MS,
  });

  /* Up to three makers whose names match the query: the one extra request, and only with a query. */
  const makers = useQuery({
    queryKey: ["gallery-makers", query],
    queryFn: () => searchMakers(query as string),
    enabled: query !== null,
    staleTime: FACETS_STALE_MS,
  });

  const stats: GalleryStatsView | null =
    statsQuery.data && poolQuery.data
      ? {
          inGallery: statsQuery.data.inGallery,
          reproducedThisWeek: statsQuery.data.reproducedThisWeek,
          weeklyGoal: statsQuery.data.weeklyGoal,
          reproducedLastWeek: lastWeek.data ?? null,
          freshPct: statsQuery.data.freshPct,
          poolGbp: poolQuery.data.poolGbp,
          open: poolQuery.data.open,
          withSolutions: poolQuery.data.withSolutions,
        }
      : null;

  /* The featured build leads the first page of the whole gallery. Under a lens, a facet or a search it would
     be a build the reader just filtered out, so it steps aside. */
  const featuredBuild = !narrowed ? (featuredQuery.data ?? null) : null;

  /* ── covers: one signing pass for everything on the wall and the featured plate ── */

  const mediaRows = useMemo(
    () => [...builds, ...(featuredBuild ? [featuredBuild.build] : [])].flatMap(cardMedia),
    [builds, featuredBuild],
  );
  const srcByPath = useSignedMedia(mediaRows);

  const engagement = useEngagement(builds.map((build) => build.id));

  /* ── mapped for the view ── */

  /* A facet read that failed costs its groups and nothing else: each says so in its own place. */
  const factsFailure = facets.isError && !facets.data ? { onRetry: () => void facets.refetch(), error: facets.error } : undefined;
  const shapesFailure =
    shapeFacets.isError && !shapeFacets.data ? { onRetry: () => void shapeFacets.refetch(), error: shapeFacets.error } : undefined;

  /* The figures need both their reads: if either fails, they say so and one retry asks again for whichever failed. */
  const statsFailed = !stats && ((statsQuery.isError && !statsQuery.data) || (poolQuery.isError && !poolQuery.data));
  const statsError = statsFailed
    ? {
        onRetry: () => {
          if (statsQuery.isError) void statsQuery.refetch();
          if (poolQuery.isError) void poolQuery.refetch();
        },
        error: statsQuery.error ?? poolQuery.error,
      }
    : undefined;

  const groups: FacetGroupView[] = [
    {
      key: "made-for",
      label: "Made for",
      loading: facets.isLoading,
      failure: factsFailure,
      rows: topOptions(facets.data?.roles ?? [], TOP_ROLES, madeFor).map((option) => ({
        value: option.value,
        // The registry's name where one matched, the creator's own spelling where it did not.
        label: option.label ?? option.value,
        count: option.count,
        selected: madeFor.includes(option.value),
        onToggle: () => go({ madeFor: toggled(madeFor, option.value) }),
      })),
    },
    {
      key: "made-with",
      label: "Made with",
      loading: facets.isLoading,
      failure: factsFailure,
      rows: topOptions(facets.data?.tools ?? [], TOP_TOOLS, madeWith).map((option) => ({
        value: option.value,
        label: option.label ?? option.value,
        count: option.count,
        selected: madeWith.includes(option.value),
        onToggle: () => go({ madeWith: toggled(madeWith, option.value) }),
      })),
    },
    {
      key: "shape",
      label: "Shape",
      loading: shapeFacets.isLoading,
      failure: shapesFailure,
      rows: topOptions(shapeFacets.data ?? [], TOP_SHAPES, shapes).map((option) => ({
        value: option.value,
        label: option.value,
        count: option.count,
        selected: shapes.includes(option.value),
        onToggle: () => go({ shapes: toggled(shapes, option.value) }),
      })),
    },
  ];

  const firstPaint = useRef(true);
  useEffect(() => {
    firstPaint.current = false;
  }, []);

  const shown = featuredBuild ? builds.filter((build) => build.id !== featuredBuild.build.id) : builds;
  const cards: WallCard[] = shown.map((build, index) => ({
    key: build.id,
    render: (variant) => (
      <Reveal index={index} animate={firstPaint.current}>
        <GalleryCard
          build={build}
          srcByPath={srcByPath}
          engagement={engagementFor(engagement, build.id)}
          coverHeight={variant === "phone" ? 96 : undefined}
          titleSize={variant === "phone" ? 18 : undefined}
        />
        <Shortfall build={build} viewerId={user?.id ?? null} />
      </Reveal>
    ),
  }));

  const featured: FeaturedView | null = featuredBuild
    ? (() => {
        const media = coverMedia(featuredBuild.build);
        const src = stillFor(srcByPath, media);
        return {
          to: `/b2/${featuredBuild.build.slug}`,
          title: (featuredBuild.build.title ?? "").trim() || "Untitled build",
          outcome: featuredBuild.outcome ?? "",
          build: featuredBuild.build,
          cover: src ? (
            <img
              src={src}
              alt={mediaAlt(featuredBuild.build, media)}
              decoding="async"
              style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <CoverFallback seed={featuredBuild.build.id} radius={0} />
          ),
        };
      })()
    : null;

  const error = wallQuery.error;
  const status = error && builds.length === 0 ? "error" : wallQuery.isPending ? "loading" : "ready";

  return (
    <>
      <SeoHead
        title="Gallery — buildgallery"
        description="Things people built with AI, ordered by how many others got them working."
        path="/gallery"
      />
      <GalleryView
        fit="content"
        lens={lens}
        onLensChange={(next) => go({ lens: next })}
        lensCounts={lensCounts.data ?? null}
        stats={stats}
        statsError={statsError}
        facets={groups}
        query={query}
        onSearch={(next) => go({ query: next })}
        appliedCount={madeFor.length + madeWith.length + shapes.length}
        narrowed={narrowed}
        onClearAll={() => navigate(galleryHref())}
        total={total}
        featured={featured}
        aboveWall={query !== null ? <MakersRow makers={makers.data ?? []} /> : undefined}
        wall={{
          status,
          errorKind: error && isPermissionError(error) ? "permission" : "error",
          cards,
          hasMore: wallQuery.hasNextPage,
          loadingMore: wallQuery.isFetchingNextPage,
          onMore: () => void wallQuery.fetchNextPage(),
          onRetry: () => void wallQuery.refetch(),
          error,
        }}
        onNavigate={navigate}
      />
    </>
  );
}

export default GalleryPage;
