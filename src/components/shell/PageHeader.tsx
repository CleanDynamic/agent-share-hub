import type { CSSProperties, ReactNode } from "react";

import { SPACE_COMPACT } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
/* Roles imported by name rather than as `type`: this file uses inline
   type-import modifiers, which a value binding called `type` makes ambiguous.
   The scale module says so at its export. */
import { bodyLarge, eyebrow as eyebrowRole, FIGTREE, measure } from "@/lib/theme/type";

/* ────────────────────────────────────────────────────────────────────────────
   BG-P14 — PageHeader.

   THE HEADER A WIDE PAGE PUTS ABOVE ITS GRID. A wide centre has no fixed
   measure, so a page that opens with a heading needs something that spans the
   whole column and sits above the grid rather than inside it — a `.fs-grid`
   with a heading as its first child would lay the heading out as a card.

   STANDARD PAGES MAY USE IT TOO, and that is not a concession: it is the same
   four parts in the same order at whatever width the column happens to be. The
   component knows nothing about the mode.

   THE FOUR PARTS, and why they are in this order:

     eyebrow      12px mono, uppercase, --text2. What kind of page this is.
     title        The display face, clamped 30–48px. What this page is.
     actions      Whatever the page offers. Sits beside the title on a wide
                  row and drops under it when there is no room.
     description  One paragraph, capped at the 68ch measure.

   The description is LAST IN THE DOM and last on the screen, under the whole
   title row rather than beside it. A description sharing a row with the actions
   would either cap the prose at half the column or push the actions off the
   first screen; and prose at a wide page's full width is 140 characters a line,
   which is why `measure` is on it and not on the title.

   ONE `<h1>`, because a page has one name. It takes PAGE_TITLE (below), the
   title every site page already drew by hand: Figtree 20 / 500 on a 24 line.

   ITS SPACING IS THE COMPACT SCALE (UI-P55): the same steps by name, through
   the density table — sm 12, md 17, lg 29, xs 6 (16, 24, 40 and 8 before).

   THE PAGE SHELL. Every framed page opens with this header, first in `<main>`,
   so the title's top is the shell's content top (88 at 1440 by 900). The title
   is the site pages' own: Figtree 20 / 500, line 24. The breadcrumb sits in the
   24 above the title, out of flow, so it never moves the title. The actions sit
   on the title's 24px line, centred on it, and end at the content edge. The
   space under the header belongs to the page, unless there is a description.
   ──────────────────────────────────────────────────────────────────────────── */

/** The page title: one face, size and line on every page. */
export const PAGE_TITLE: CSSProperties = {
  margin: 0,
  fontFamily: FIGTREE,
  fontSize: 20,
  fontWeight: 500,
  lineHeight: "24px",
  letterSpacing: "-0.015em",
  color: t.text,
};

export interface PageHeaderProps {
  /** The small mono label above the title — a section, a count, a kind. */
  eyebrow?: ReactNode;
  /** The page's name. Rendered as the page's one `<h1>`. */
  title: ReactNode;
  /** One paragraph under the title. Capped at the 68ch reading measure. */
  description?: ReactNode;
  /** Buttons or controls belonging to the page as a whole. */
  actions?: ReactNode;
  /** Where the page sits, for a page with a parent: in the 24 above the title. */
  breadcrumb?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions, breadcrumb }: PageHeaderProps) {
  return (
    <header
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        /* sm between the title row and the description: they are one group.
           lg below a description: the header and what it heads are not. */
        gap: SPACE_COMPACT.sm,
        marginBottom: description != null ? SPACE_COMPACT.lg : 0,
      }}
    >
      {breadcrumb != null && (
        <div data-slot="page-breadcrumb" style={{ position: "absolute", left: 0, right: 0, bottom: "100%", height: 24, display: "flex", alignItems: "center", minWidth: 0 }}>
          {breadcrumb}
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: SPACE_COMPACT.md,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE_COMPACT.xs, minWidth: 0 }}>
          {eyebrow != null && (
            <span style={{ ...eyebrowRole, color: t.text2 }}>{eyebrow}</span>
          )}
          <h1 style={PAGE_TITLE}>{title}</h1>
        </div>

        {actions != null && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              /* On the title's line: a taller control is centred on it and does not push the title down. */
              height: 24,
              gap: SPACE_COMPACT.xs,
              /* Never the element that makes the row wider than the column:
                 the actions wrap inside themselves before the row wraps. */
              minWidth: 0,
            }}
          >
            {actions}
          </div>
        )}
      </div>

      {description != null && (
        <p style={{ ...bodyLarge, ...measure, color: t.text2, margin: 0 }}>{description}</p>
      )}
    </header>
  );
}

export default PageHeader;
