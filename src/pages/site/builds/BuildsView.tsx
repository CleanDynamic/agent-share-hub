/* SV-11: the Builds page, pure: the head with its view switch, the filter column and the chosen view's column. The live
   page (`BuildsPage`) and the dev page (`vision-builds-table`) both draw from this, so the board is compared against the
   page itself. Below 1000 the columns stack, the filters first and closed to their heads until opened. */

import { useState, type ReactNode } from "react";

import type { FigurePart } from "@/components/vision/PageFigure";
import type { GalleryViewMode } from "@/lib/build/galleryParams";
import { STALE_AFTER_DAYS } from "@/lib/build/signals";
import { t } from "@/lib/theme/tokens";

import { BuildsColumns, BuildsControl, BuildsHead, ViewSwitch, useBuildsTwoColumns } from "./BuildsFrame";
import { BuildsFiltersView, type BuildsFiltersViewProps } from "./BuildsFiltersView";
import { BuildsTableView, type BuildsTableViewProps } from "./BuildsTableView";

export interface BuildsStats {
  published: number;
  runsThisWeek: number;
  freshPct: number;
}

/** "Of 120 published · 214 reproductions this week · 78% confirmed in the last 120 days", the runs in `--evidence`. */
export function statParts({ published, runsThisWeek, freshPct }: BuildsStats): FigurePart[] {
  return [
    { text: `Of ${published} published` },
    {
      text: (
        <>
          <span style={{ color: t.evidence }}>{`${runsThisWeek} ${runsThisWeek === 1 ? "reproduction" : "reproductions"}`}</span> this week
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
  /** The Table's props, or the other view's content (Maps, Classification). */
  table: BuildsTableViewProps | null;
  other?: ReactNode;
}

export function BuildsView({ figure, parts, view, hrefFor, onViewIntent, filters, table, other }: BuildsViewProps) {
  const two = useBuildsTwoColumns();
  const [open, setOpen] = useState(false);
  return (
    <BuildsColumns
      two={two}
      head={<BuildsHead figure={figure} parts={parts} switcher={<ViewSwitch view={view} hrefFor={hrefFor} onIntent={onViewIntent} />} />}
      filters={
        <>
          {two ? null : (
            <div style={{ marginBottom: 12 }}>
              <BuildsControl aria-expanded={open} onClick={() => setOpen((value) => !value)}>
                {open ? "Hide filters" : "Show filters"}
              </BuildsControl>
            </div>
          )}
          <BuildsFiltersView {...filters} collapsed={!two && !open} />
        </>
      }
      main={table ? <BuildsTableView {...table} /> : other}
    />
  );
}
