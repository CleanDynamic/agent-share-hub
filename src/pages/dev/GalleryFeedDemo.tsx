/* UI-P49 — /dev/kit/pages/gallery-feed?theme=noon|dusk&viewport=desktop|mobile.

   `GalleryFeedView` with the ten builds from Miles's canvas, inside the frame
   `KitPages` draws. No board is compared (there is none). The controls work:
   the demo holds the filters the live page keeps in its address, and runs the
   fixture through the data layer's rules, so "Any model" and a chosen model can
   both be checked here, in both themes. */

import { useState } from "react";

import {
  FEED_FIXTURE_AUDIENCES,
  FEED_FIXTURE_COUNTS,
  FEED_FIXTURE_NOW,
  feedFixture,
  type FeedFixtureFilters,
} from "@/dev/fixtures/gallery-feed";
import type { GalleryViewMode } from "@/lib/build/galleryParams";
import { MODEL_VERSIONS } from "@/lib/models/registry";
import { GalleryFeedView, type FeedListView, type FeedSectionView } from "@/pages/site/gallery/GalleryFeedView";
import { feedRowView } from "@/pages/site/gallery/galleryModel";
import type { GalleryFeedRow } from "@/lib/build/gallery";
import type { ModelVersion } from "@/lib/models/registry";

import type { DesignPageProps } from "./KitPages";

const noop = () => undefined;
const NO_SRC: ReadonlyMap<string, string> = new Map();

const section = (rows: GalleryFeedRow[], model: ModelVersion | null): FeedSectionView => ({
  rows: rows.map((build) => feedRowView(build, model)),
  total: rows.length,
  hasMore: false,
  loadingMore: false,
  onMore: noop,
});

export default function GalleryFeedDemo({ fit = "board", state = "populated" }: DesignPageProps) {
  const [view, setView] = useState<GalleryViewMode>("feed");
  const [filters, setFilters] = useState<FeedFixtureFilters>({ model: null, audience: null, sort: "newest", q: null });
  const set = (next: Partial<FeedFixtureFilters>) => setFilters((current) => ({ ...current, ...next }));

  const feed = state === "empty" ? feedFixture({ ...filters, q: filters.q ?? "zzzz" }) : feedFixture(filters);
  const list: FeedListView =
    feed.kind === "all"
      ? { kind: "all", list: section(feed.rows, null) }
      : { kind: "model", reproducedOn: section(feed.reproducedOn, feed.model), notYet: section(feed.notYet, feed.model) };

  return (
    <GalleryFeedView
      fit={fit}
      now={FEED_FIXTURE_NOW}
      view={view}
      onViewChange={setView}
      query={state === "empty" ? (filters.q ?? "zzzz") : filters.q}
      onSearch={(q) => set({ q })}
      model={filters.model ? (MODEL_VERSIONS.find((version) => version.id === filters.model) ?? null) : null}
      onModelChange={(model) => set({ model })}
      audience={filters.audience}
      onAudienceChange={(audience) => set({ audience })}
      audiences={FEED_FIXTURE_AUDIENCES}
      sort={filters.sort}
      onSortChange={(sort) => set({ sort })}
      counts={state === "loading" ? null : FEED_FIXTURE_COUNTS}
      status={state === "loading" ? "loading" : state === "error" ? "error" : "ready"}
      onRetry={noop}
      list={list}
      srcByPath={NO_SRC}
      onClearAll={() => set({ q: null, model: null, audience: null })}
      onNavigate={noop}
    />
  );
}
