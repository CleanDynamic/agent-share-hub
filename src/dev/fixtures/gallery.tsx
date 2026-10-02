/* UI-P28 — Gallery's sample data, as `GalleryView` takes it.

   DEV ONLY (imported from `src/pages/dev/**` and `src/dev/**` alone). This is
   where the sample's indices become objects: `design/fixtures/sample-data.json →
   gallery` points at builds by their 1-based position in `builds`. The wall's
   cards are drawn with `BuildCard` directly, from the sample's own fields — the
   live page hands `GalleryCard` a real record instead. Nothing here reaches a
   production bundle. */

import { BuildCard, CardCredit } from "@/components/brand/BuildCard";
import { CoverFallback } from "@/components/brand/CoverFallback";
import type { DesignState } from "@/dev/useDesignTheme";
import type { GalleryViewProps } from "@/pages/site/gallery/GalleryView";
import type { FacetGroupView, FeaturedView, WallCard } from "@/pages/site/gallery/galleryModel";

import { FIXTURE_NOW, fixturePlaque, fixtures, type FixtureBuild } from "../designFixtures";

const build = (index: number): FixtureBuild => fixtures.builds[index - 1];
const noop = () => undefined;
const now = FIXTURE_NOW.getTime();

const cover = (b: FixtureBuild) => <CoverFallback seed={b.id} radius={0} sky={b.cover_sky} />;

function card(b: FixtureBuild): WallCard {
  const ask = b.has_open_gap && b.open_gap_reward_gbp ? `1 part unsolved · £${b.open_gap_reward_gbp}` : null;
  return {
    key: b.id,
    render: (variant) => (
      <BuildCard
        to={`/b2/${b.slug}`}
        title={b.title}
        cover={cover(b)}
        coverHeight={variant === "phone" ? 96 : 92}
        titleSize={variant === "phone" ? 18 : 19}
        shape={b.shape}
        credit={<CardCredit rebuiltFrom={b.rebuilt_from} by={b.maker} />}
        delta={b.change_summary}
        build={fixturePlaque(b)}
        categories={b.part_categories}
        openAsk={ask}
        gap={b.has_open_gap}
        now={now}
      />
    ),
  };
}

const group = (
  key: FacetGroupView["key"],
  label: string,
  rows: readonly (readonly (string | number)[])[],
): FacetGroupView => ({
  key,
  label,
  loading: false,
  rows: rows.map(([value, count]) => ({ value: String(value), label: String(value), count: Number(count), selected: false, onToggle: noop })),
});

/**
 * UI-P37 — the same page in its other three states, from the same sample. Loading has
 * every panel waiting (the wall leads with the featured plate's place, as it will);
 * empty is a gallery with nothing in it under a lens, its facet groups left out
 * because they have no counts; error has the wall, the figures and every facet group
 * failing, each in its own place.
 */
function inState(base: Omit<GalleryViewProps, "fit">, state: DesignState): Omit<GalleryViewProps, "fit"> {
  if (state === "loading") {
    return {
      ...base,
      lensCounts: null,
      stats: null,
      facets: base.facets.map((group) => ({ ...group, loading: true, rows: [] })),
      featured: null,
      wall: { ...base.wall, status: "loading", cards: [] },
    };
  }
  if (state === "empty") {
    return {
      ...base,
      lens: "unsolved",
      lensCounts: { all: 0, proven: 0, rebuilt: 0, unsolved: 0 },
      stats: base.stats && {
        ...base.stats,
        inGallery: 0,
        reproducedThisWeek: 0,
        freshPct: 0,
        poolGbp: 0,
        open: 0,
        withSolutions: 0,
      },
      facets: base.facets.map((group) => ({ ...group, rows: [] })),
      narrowed: true,
      total: 0,
      featured: null,
      wall: { ...base.wall, cards: [] },
    };
  }
  if (state === "error") {
    const failure = { onRetry: noop };
    return {
      ...base,
      lensCounts: null,
      stats: null,
      statsError: failure,
      facets: base.facets.map((group) => ({ ...group, rows: [], failure })),
      featured: null,
      wall: { ...base.wall, status: "error", cards: [], onRetry: noop },
    };
  }
  return base;
}

/** Everything `GalleryView` needs except `fit`, from the sample data. */
export function galleryFixture(state: DesignState = "populated"): Omit<GalleryViewProps, "fit"> {
  const g = fixtures.gallery;
  const featuredBuild = build(g.featured.build);
  const featured: FeaturedView = {
    to: `/b2/${featuredBuild.slug}`,
    title: featuredBuild.title,
    outcome: g.featured.outcome,
    build: fixturePlaque(featuredBuild),
    cover: cover(featuredBuild),
  };

  return inState({
    now,
    lens: "all",
    onLensChange: noop,
    lensCounts: g.lens_counts,
    stats: {
      inGallery: g.in_gallery,
      reproducedThisWeek: g.reproduced_this_week,
      // The sample draws "/ 400"; the product sets no goal, so the live page shows last week's bar instead.
      weeklyGoal: 400,
      reproducedLastWeek: null,
      freshPct: g.fresh_pct,
      poolGbp: g.open_bounty_pool_gbp,
      open: g.open_bounties,
      withSolutions: Math.round(g.open_bounties * 0.42),
    },
    facets: [
      group("made-for", "Made for", g.facets.made_for),
      group("made-with", "Made with", g.facets.made_with),
      group("shape", "Shape", g.facets.shape),
    ],
    query: null,
    onSearch: noop,
    appliedCount: 0,
    narrowed: false,
    onClearAll: noop,
    total: g.in_gallery,
    featured,
    wall: {
      status: "ready",
      cards: g.wall.map((index) => card(build(index))),
      hasMore: false,
      loadingMore: false,
      onMore: noop,
      onRetry: noop,
    },
    onNavigate: noop,
  }, state);
}
