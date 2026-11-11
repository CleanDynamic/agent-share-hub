/* SV-11: the Builds page, pure: the head with its view switch and the chosen view under it. The live page (`BuildsPage`)
   and the dev page (`vision-builds-table`) both draw from this. BF-06 (A1): the filters are a dialog, opened by the
   Filters button in the Table's lens row; the Table has the page's width. */

import { useState, type ReactNode } from "react";

import type { FigurePart } from "@/components/vision/PageFigure";
import type { GalleryViewMode } from "@/lib/build/galleryParams";
import { STALE_AFTER_DAYS } from "@/lib/build/signals";
import { t } from "@/lib/theme/tokens";

import { BuildsColumns, BuildsHead, ViewSwitch } from "./BuildsFrame";
import { BuildsFiltersDialog } from "./BuildsFiltersDialog";
import { BuildsFiltersView, type BuildsFiltersViewProps } from "./BuildsFiltersView";
import { BuildsTableView, type BuildsTableViewProps } from "./BuildsTableView";

export interface BuildsStats {
  published: number;
  runsThisWeek: number;
  freshPct: number;
  /** BF-01 P2: a filter is on, so the figure already says "n of published" and the first part is left out. */
  filtered?: boolean;
}

/** "Of 120 published · 214 reproductions this week · 78% confirmed in the last 120 days", the runs in `--evidence` when above zero. */
export function statParts({ published, runsThisWeek, freshPct, filtered }: BuildsStats): FigurePart[] {
  return [
    ...(filtered ? [] : [{ text: `Of ${published} published` }]),
    {
      text: (
        <>
          <span data-testid="stat-runs" style={{ color: runsThisWeek > 0 ? t.evidence : t.text2 }}>{`${runsThisWeek} ${runsThisWeek === 1 ? "reproduction" : "reproductions"}`}</span> this week
        </>
      ),
    },
    { text: `${freshPct}% confirmed in the last ${STALE_AFTER_DAYS} days` },
  ];
}

export interface BuildsViewProps {
  figure: ReactNode;
  parts: readonly FigurePart[];
  view: GalleryViewMode;
  hrefFor: (view: GalleryViewMode) => string;
  onViewIntent?: (view: GalleryViewMode) => void;
  filters: BuildsFiltersViewProps;
  /** The Table's props, or what stands in its place (its error). Maps and Classification draw their own pages. The view
      gives the Table its way to open the filters. */
  table: Omit<BuildsTableViewProps, "onOpenFilters" | "activeCount"> | null;
  other?: ReactNode;
  /** BF-02 (C2): the figure and the rows are the last address's, kept until the new page lands. */
  updating?: boolean;
}

export function BuildsView({ figure, parts, view, hrefFor, onViewIntent, filters, table, other, updating }: BuildsViewProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <BuildsColumns
        head={<BuildsHead figure={figure} parts={parts} updating={updating} switcher={<ViewSwitch view={view} hrefFor={hrefFor} onIntent={onViewIntent} />} />}
        main={table ? <BuildsTableView {...table} activeCount={filters.activeCount} onOpenFilters={() => setOpen(true)} updating={updating} /> : other}
      />
      <BuildsFiltersDialog open={open} onOpenChange={setOpen}>
        <BuildsFiltersView {...filters} />
      </BuildsFiltersDialog>
    </>
  );
}
