/* Synth 08: everything the build page shows under its panels, full width of the 1280 container, one panel each on the page
   shade, 8 apart:

     comments      the existing discussion, whole. It draws its own heading as a fact ("4 comments", 20/600), so the panel
                   adds none.
     where next    "Rebuilds of this" and "More from <maker>", each a panel with its heading as a fact and three build cards
                   on Card (the name 15/600, "@maker" 13 Text 3), or a two-column grid on a phone. A row with nothing in it
                   is left out, and so is the whole section when there is nowhere onward. "More made with <tool>" is gone.

   PURE: the cards are drawn by the page or the fixture. */

import { useState, type ReactNode } from "react";

import { PANEL_GUTTER, PANEL_PAD, PANEL_RADIUS } from "@/components/shell/chromeSize";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { hoverFill } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import type { WhereNextRowView } from "./buildModel";

const panel = { background: t.surface, borderRadius: PANEL_RADIUS, minWidth: 0, boxSizing: "border-box", padding: PANEL_PAD } as const;

/** The column under the panels: full width, 8 apart, 8 below them. */
export function LowerSections({ children }: { children: ReactNode }) {
  return (
    <div data-testid="build-lower" style={{ display: "flex", flexDirection: "column", gap: PANEL_GUTTER, marginTop: PANEL_GUTTER }}>
      {children}
    </div>
  );
}

/** The discussion, in a panel. */
export function CommentsPanel({ children }: { children: ReactNode }) {
  return (
    <section style={panel}>
      <div data-testid="build-comments-panel">{children}</div>
    </section>
  );
}

/** A build in the lower rows: on Card, its name 15/600 as the link, "@maker" 13 Text 3 under it when it is known. */
export function LowerBuildCard({ href, title, maker }: { href: string; title: string; maker?: string | null }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  const [hover, setHover] = useState(false);
  return (
    <div
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      style={{ background: hover ? hoverFill(t.module) : t.module, borderRadius: 12, padding: 16, minHeight: 72, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 2 }}
    >
      <Link
        to={href}
        {...handlers}
        style={{ fontFamily: FIGTREE, fontSize: 15, fontWeight: 600, lineHeight: "20px", color: t.text, textDecoration: "none", overflowWrap: "anywhere", borderRadius: r.chip, ...ring(state.focusVisible) }}
      >
        {title}
      </Link>
      {maker ? <span style={{ fontFamily: FIGTREE, fontSize: 13, lineHeight: "20px", color: t.label }}>{`@${maker}`}</span> : null}
    </div>
  );
}

/** Where next: a panel per row with something in it. */
export function WhereNextPanels({ rows, phone }: { rows: readonly WhereNextRowView[]; phone: boolean }) {
  const shown = rows.filter((row) => row.cards.length > 0);
  if (shown.length === 0) return null;
  return (
    <>
      {shown.map((row) => (
        <section key={row.key} aria-labelledby={`where-next-${row.key}-heading`} style={panel}>
          <div data-testid={`where-next-${row.key}`}>
            <h2 id={`where-next-${row.key}-heading`} style={{ margin: 0, fontFamily: FIGTREE, fontSize: 20, fontWeight: 600, lineHeight: "24px", color: t.text }}>
              {row.heading}
            </h2>
            <ul
              aria-label={row.heading}
              style={{
                listStyle: "none",
                margin: "12px 0 0",
                padding: 0,
                display: "grid",
                gridTemplateColumns: phone ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))",
                gap: PANEL_GUTTER,
                alignItems: "stretch",
              }}
            >
              {row.cards.map((card) => (
                <li key={card.key} data-testid="where-next-card" style={{ minWidth: 0 }}>
                  {card.render(phone ? "phone" : "desktop")}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
    </>
  );
}
