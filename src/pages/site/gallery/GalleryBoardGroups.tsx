/* CA-16b P3: the Gallery's grouped tabs: "By field", "By task", "By what was built" and "By technique".

   Each tab groups the builds by that facet's top-level values (a Field's Area or Domain, a Task group, a What was built value,
   a technique). A group is its value's name at 14/500 with its count in the data face, then its first three builds in the
   same three-column grid, then "Show all 14", which chooses that value in the filters and returns to All builds. Groups go by
   count, highest first, and a value with no builds is left out. The filters, the search, the quick filters and the lens all
   still apply inside every tab: they are part of each group's request. */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getBuildClassifications, getBuildTries, listGalleryFeed, type GalleryFeedRow, type GalleryLens } from "@/lib/build/gallery";
import type { GalleryBy } from "@/lib/build/galleryParams";
import { TAXONOMY, type Facet, type TaxonomyValue } from "@/lib/classify/taxonomy";
import { useIsPhone, useMinWidth } from "@/components/shell/useMinWidth";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { BoardItem, lensRows } from "./GalleryBoard";

const FACET_OF: Record<GalleryBy, Facet> = { field: "field", task: "task", built: "built", technique: "technique" };

/** How many groups a tab draws before "Show more groups": each asks for its own three builds. */
export const GROUPS_FIRST = 8;

/** The values a tab groups by, with their counts: most builds first, none with no builds. */
export function groupValues(by: GalleryBy, counts: Readonly<Record<string, number>>): { value: TaxonomyValue; count: number }[] {
  const facet = FACET_OF[by];
  return TAXONOMY[facet]
    .filter((value) => (by === "field" || by === "task" ? value.parent === null : true))
    .map((value) => ({ value, count: counts[`${facet}:${value.id}`] ?? 0 }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.value.label.localeCompare(b.value.label));
}

export interface GalleryBoardGroupsProps {
  by: GalleryBy;
  counts: Readonly<Record<string, number>>;
  /** What the filters, the search and the quick filters already say. */
  facets: readonly string[];
  query: string | null;
  lens: GalleryLens;
  /** "Show all": choose the value and go back to All builds. */
  onShowAll: (key: string) => void;
}

function Group({ by, entry, facets, query, lens, onShowAll }: Omit<GalleryBoardGroupsProps, "counts"> & { entry: { value: TaxonomyValue; count: number } }) {
  const key = `${entry.value.facet}:${entry.value.id}`;
  const merged = useMemo(() => (facets.includes(key) ? [...facets] : [...facets, key]), [facets, key]);
  const columns = useMinWidth(1100) ? 3 : 2;
  const phone = useIsPhone();
  const feed = useQuery({
    queryKey: ["build", "listGalleryFeed", "group", merged, query, by],
    queryFn: () => listGalleryFeed({ facets: merged, classified: true, q: query ?? undefined, sort: "reproduced", page: 0 }),
    staleTime: 300_000,
  });
  const rows: GalleryFeedRow[] = feed.data?.kind === "all" ? lensRows(feed.data.rows, lens).slice(0, 3) : [];
  const ids = rows.map((row) => row.id);
  const classifications = useQuery({ queryKey: ["build", "getBuildClassifications", ids.join(",")], queryFn: () => getBuildClassifications(ids), enabled: ids.length > 0, staleTime: 300_000 });
  const tries = useQuery({ queryKey: ["build", "getBuildTries", ids.join(",")], queryFn: () => getBuildTries(ids), enabled: ids.length > 0, staleTime: 300_000 });
  if (feed.isSuccess && rows.length === 0) return null;
  return (
    <section aria-label={entry.value.label} data-testid="board-group" style={{ display: "flex", flexDirection: "column", minWidth: 0, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, paddingBottom: 4 }}>
        <h2 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 14, fontWeight: 500, color: t.text }}>{entry.value.label}</h2>
        <span style={{ fontFamily: DM_MONO, fontSize: 11.5, color: t.label }}>{entry.count}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${phone ? 1 : columns}, minmax(0, 1fr))`, columnGap: 32 }}>
        {rows.map((row) => (
          <BoardItem key={row.id} row={row} classification={classifications.data?.[row.id]} tries={tries.data?.[row.id]} />
        ))}
      </div>
      <button type="button" onClick={() => onShowAll(key)} style={{ alignSelf: "flex-start", border: 0, background: "transparent", cursor: "pointer", padding: 0, minHeight: phone ? 44 : undefined, fontFamily: FIGTREE, fontSize: 12.5, color: t.text2, textDecoration: "underline", textUnderlineOffset: 3 }}>
        {`Show all ${entry.count}`}
      </button>
    </section>
  );
}

export function GalleryBoardGroups({ by, counts, ...rest }: GalleryBoardGroupsProps) {
  const [all, setAll] = useState(false);
  const entries = useMemo(() => groupValues(by, counts), [by, counts]);
  if (entries.length === 0) return <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, color: t.text2 }}>Nothing here yet.</p>;
  const shown = all ? entries : entries.slice(0, GROUPS_FIRST);
  return (
    <div data-testid="board-groups" data-by={by} style={{ display: "flex", flexDirection: "column" }}>
      {shown.map((entry) => (
        <Group key={entry.value.id} by={by} entry={entry} {...rest} />
      ))}
      {!all && entries.length > GROUPS_FIRST ? (
        <button type="button" onClick={() => setAll(true)} style={{ alignSelf: "flex-start", border: 0, background: "transparent", cursor: "pointer", padding: 0, fontFamily: FIGTREE, fontSize: 12.5, color: t.text2, textDecoration: "underline", textUnderlineOffset: 3 }}>
          Show more groups
        </button>
      ) : null}
    </div>
  );
}
