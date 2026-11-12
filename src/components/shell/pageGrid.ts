/* Page shell: the page's 12-column grid, 32 gutters, inside the content width (1312 at 1440, so a column is 80 and the
   column starts are 64, 400 and 1072 from the window's edge).

   A template names its tracks, each a whole number of columns and the gutters inside it:
     feed          3 / 6 / 3   Home, OpenBuilds, Space, Library; Settings' nav and content; Connect's content;
                               the build reader's lower row
     mainSide      9 / 3       Drafts, Activity, Post, the build reader's upper row, the profile
     mainWideSide  8 / 4       the rebuild and the lineage only (their side column needs 416 at 1440)
     full          12          Builds
   The side tracks are sized exactly and the middle one takes what is left, so the edges land on the columns at every
   width. A page keeps its own breakpoints; this is the template it uses above them. */

import type { CSSProperties } from "react";

/** The gutter between columns. */
export const PAGE_GUTTER = 32;

/** `n` columns and the `n - 1` gutters inside them. */
const span = (n: number) => `calc((100% - ${11 * PAGE_GUTTER}px) * ${n} / 12 + ${(n - 1) * PAGE_GUTTER}px)`;

export type PageTemplate = "feed" | "mainSide" | "mainWideSide" | "full";

/** The grid for a page template: spread onto the page's grid element. */
export function pageColumns(template: PageTemplate): CSSProperties {
  const tracks =
    template === "feed"
      ? `${span(3)} minmax(0, 1fr) ${span(3)}`
      : template === "mainSide"
        ? `minmax(0, 1fr) ${span(3)}`
        : template === "mainWideSide"
          ? `minmax(0, 1fr) ${span(4)}`
          : "minmax(0, 1fr)";
  return { display: "grid", gridTemplateColumns: tracks, columnGap: PAGE_GUTTER };
}
