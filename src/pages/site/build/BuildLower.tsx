/* UI-P30 — everything the build page shows under its first screen.

   The same sections as before, in the same order, each a glass `Panel` (16px
   18px) in the column, full width, 12 apart:

     comments      the existing discussion, whole. It draws its own "Comments"
                   heading, so the panel adds no second one (its structure is
                   not this prompt's to change).
     where next    one panel per row — rebuilds of this, more made with its
                   tool, more from its maker — each a `PanelHead` and a row of
                   three build cards, or a two-column wall on a phone. A row
                   with nothing in it is left out, and so is the whole section
                   when there is nowhere onward.

   No new sections. PURE: the cards are drawn by the page or the fixture. */

import type { ReactNode } from "react";

import { Button } from "@/components/brand/Button";
import { Panel, PanelHead } from "@/components/brand/Panel";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import type { WhereNextRowView } from "./buildModel";

/** The column under the first screen: full width, 12 apart, 12 below the first screen. */
export function LowerSections({ children }: { children: ReactNode }) {
  return (
    <div data-testid="build-lower" style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
      {children}
    </div>
  );
}

/** The discussion, in a glass panel. */
export function CommentsPanel({ children }: { children: ReactNode }) {
  return (
    <Panel padding="16px 18px">
      <div data-testid="build-comments-panel">{children}</div>
    </Panel>
  );
}

/** Where next: a panel per row with something in it. */
export function WhereNextPanels({ rows, phone }: { rows: readonly WhereNextRowView[]; phone: boolean }) {
  const shown = rows.filter((row) => row.cards.length > 0);
  if (shown.length === 0) return null;
  return (
    <>
      {shown.map((row) => (
        <Panel key={row.key} padding="16px 18px">
          <div data-testid={`where-next-${row.key}`}>
            <PanelHead headingLevel={2} title={row.heading} />
            <ul
              aria-label={row.heading}
              style={{
                listStyle: "none",
                margin: "12px 0 0",
                padding: 0,
                display: "grid",
                gridTemplateColumns: phone ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))",
                gap: phone ? 10 : 12,
                alignItems: "start",
              }}
            >
              {row.cards.map((card) => (
                <li key={card.key} data-testid="where-next-card" style={{ minWidth: 0 }}>
                  {card.render(phone ? "phone" : "desktop")}
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      ))}
    </>
  );
}

/** Where next could not be read: one sentence and a retry. */
export function WhereNextError({ onRetry }: { onRetry: () => void }) {
  return (
    <Panel padding="16px 18px">
      <div data-testid="where-next-error" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 14, color: t.text2 }}>Where to go next could not be loaded.</p>
        <Button variant="secondary" size={30} fontSize={12} onClick={onRetry}>
          Try again
        </Button>
      </div>
    </Panel>
  );
}
