import type { ReactNode } from "react";

import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
/* Roles imported by name rather than as `type`: this file uses inline
   type-import modifiers, which a value binding called `type` makes ambiguous.
   The scale module says so at its export. */
import { bodyLarge, eyebrow as eyebrowRole, measure, sectionHead } from "@/lib/theme/type";

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

   ONE `<h1>`, because a page has one name. It takes the whole `sectionHead`
   role — the display face at 30–48px — rather than `hero`, which is 44–78px
   and "one per page, at most" for a landing surface, not for the top of an
   application screen. The face is never named here: it is whatever the role
   says it is, which is what keeps the scale's 20px display floor covering
   this component as well as the module that declares it.
   ──────────────────────────────────────────────────────────────────────────── */

export interface PageHeaderProps {
  /** The small mono label above the title — a section, a count, a kind. */
  eyebrow?: ReactNode;
  /** The page's name. Rendered as the page's one `<h1>`. */
  title: ReactNode;
  /** One paragraph under the title. Capped at the 68ch reading measure. */
  description?: ReactNode;
  /** Buttons or controls belonging to the page as a whole. */
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header
      style={{
        display: "flex",
        flexDirection: "column",
        /* sm between the title row and the description: they are one group.
           lg below the header: the header and what it heads are not. */
        gap: SPACE.sm,
        marginBottom: SPACE.lg,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: SPACE.md,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs, minWidth: 0 }}>
          {eyebrow != null && (
            <span style={{ ...eyebrowRole, color: t.text2 }}>{eyebrow}</span>
          )}
          <h1 style={{ ...sectionHead, color: t.text, margin: 0 }}>{title}</h1>
        </div>

        {actions != null && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: SPACE.xs,
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
