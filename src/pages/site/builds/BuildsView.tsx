/* SV-11: the Builds page, pure: the head with its view switch, the filter column and the chosen view's column. The live
   page (`BuildsPage`) and the dev page (`vision-builds-table`) both draw from this, so the board is compared against the
   page itself. Below 1000 the columns stack, the filters first and closed to their heads until opened. */

import { useState, type ReactNode } from "react";

import type { FigurePart } from "@/components/vision/PageFigure";
import type { GalleryViewMode } from "@/lib/build/galleryParams";

import { BuildsColumns, BuildsControl, BuildsHead, ViewSwitch, useBuildsTwoColumns } from "./BuildsFrame";
import { BuildsFiltersView, type BuildsFiltersViewProps } from "./BuildsFiltersView";
import { BuildsTableView, type BuildsTableViewProps } from "./BuildsTableView";

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
