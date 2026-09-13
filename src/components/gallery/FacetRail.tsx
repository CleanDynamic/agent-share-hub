import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { r } from "@/lib/theme/radius";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { body, eyebrow, tabular } from "@/lib/theme/type";

/* ────────────────────────────────────────────────────────────────────────────
   BG-P19 — the gallery's facet rail.

   THREE GROUPS, ONE SHAPE. Made for, Made with and Open bounties were three
   hand-rolled chip rows inside a glass panel, each with its own 12px button,
   its own 100px radius and its own hard-coded `rgba(255,255,255,…)` fills. All
   three are now the SAME control — BG-P07's selectable chip — and the only
   thing that differs between the groups is what they are counting.

   NO PANEL, AND THAT IS THE WHOLE VISUAL ARGUMENT OF THIS FILE. The rail used
   to be a glass card with a border and a radius sitting directly under the
   page's `<h1>`: the heaviest object on the screen, above the work, made of
   the same material as the cards it filters. On a page whose entry point must
   be the builds, a filter panel that reads as a card is a second grid of one
   item competing with the real one. So the band sits ON THE GROUND — mono
   labels in `--text2`, outline chips, and a single `--line` hairline under the
   whole thing to say where the filters end and the work begins. Weight is spent
   on the cards, which is the only place this page has to spend it.

   THE PILLS ARE GONE WITH IT. Every chip here was `borderRadius: 100`, which
   the theme retired outright: "nothing is a pill and nothing is square", and
   `--r-full` is for circles only. `chipStyle` puts them all on `--r-chip`.

   BELOW 1024 THE BAND COLLAPSES INTO A SHEET, and that is a layout change
   rather than a repaint — sanctioned by this prompt, and the only one in it.
   The reason is arithmetic rather than taste: at 1023px the centre column is
   under 700px wide, three label-plus-chips rows stack to five or six wrapped
   lines, and a reader arrives at a screen of filters with the first card
   pushed below the fold. 1024 is also where the frame already drops the right
   rail into a drawer, so the page gains no new breakpoint of its own.

   SELECTED FACETS GET THEIR OWN ROW, above the grid and below whichever of the
   two controls is on screen. At wide widths that row is partly redundant with
   the band — the chip is lit in both places — and it is still worth having,
   because the band is the OPTIONS and this row is the QUERY: it is the one
   place a reader can see everything currently narrowing the grid without
   reading three rows of twenty chips, and it is the only place the collapsed
   layout can show it at all.
   ──────────────────────────────────────────────────────────────────────────── */

/** Chips are 28px tall here, as they were before the repaint. */
const CHIP_HEIGHT = 28;

/** Below this the band becomes a "Filters" control and a sheet. */
export const FACET_COLLAPSE_BELOW = 1024;

export interface FacetOption {
  /** The value as stored, which is what the query filters on. */
  value: string;
  /** What the chip says: the registry's name, or the creator's own spelling. */
  label: string;
  /** How many builds carry it. Null while it is still being counted. */
  count: number | null;
  selected: boolean;
  onToggle: () => void;
}

export interface FacetGroup {
  /** Stable, and used for test ids. */
  key: string;
  /** The mono label at the left of the band. */
  label: string;
  options: FacetOption[];
  loading: boolean;
  /** What the group says when creators have named nothing yet. */
  emptyText: string;
  /**
   * The one group that names a part category.
   *
   * Open bounties is the same fact as the card's dashed edge and the build
   * page's gap panel, so its chip carries `--cat-breakage` as its ink in both
   * states — a reader who has learnt what that red means on a card should not
   * have to learn it again here. The other two groups name a role and a tool,
   * neither of which is a part category, so neither may borrow a category hue.
   */
  tone?: "breakage";
}

export interface SelectedFacet {
  /** Unique across groups: two groups may legitimately hold the same string. */
  id: string;
  label: string;
  onRemove: () => void;
}

export interface FacetRailProps {
  groups: FacetGroup[];
  selected: SelectedFacet[];
  onClearAll: () => void;
}

export function FacetRail({ groups, selected, onClearAll }: FacetRailProps) {
  const breakpoint = useBreakpoint();
  const collapsed = breakpoint === "md" || breakpoint === "mobile";

  return (
    <section
      data-visual-slot="gallery-facets"
      data-facets-collapsed={collapsed ? "" : undefined}
      aria-label="Filters"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: SPACE.sm,
        paddingBottom: SPACE.md,
        /* The one line on this page. Space alone could almost carry the
           boundary, but almost is what leaves a reader unsure whether the first
           card belongs to the filters. A hairline is the cheapest thing that
           settles it, and it is `--line` rather than a shadow or a rule. */
        borderBottom: `1px solid ${t.line}`,
      }}
    >
      {collapsed ? (
        <CollapsedFacets groups={groups} activeCount={selected.length} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
          {groups.map((group) => (
            <FacetGroupRow key={group.key} group={group} />
          ))}
        </div>
      )}

      {selected.length > 0 ? (
        <SelectedRow selected={selected} onClearAll={onClearAll} />
      ) : null}
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   The band
   ──────────────────────────────────────────────────────────────────────────── */

/** One group: its mono label, then its chips, wrapping under themselves. */
function FacetGroupRow({ group }: { group: FacetGroup }) {
  return (
    <div
      data-facet-group={group.key}
      style={{ display: "flex", alignItems: "flex-start", gap: SPACE.sm, flexWrap: "wrap" }}
    >
      <span
        style={{
          ...eyebrow,
          color: t.text2,
          /* The three labels share a column so the chip rows start on one
             edge; 92 is what the longest of them ("MADE WITH") needs. */
          minWidth: 92,
          /* Optically centred against the first row of 28px chips rather than
             sat on their top edge. */
          paddingTop: (CHIP_HEIGHT - 16) / 2,
        }}
      >
        {group.label}
      </span>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: SPACE.xs,
          flex: "1 1 240px",
          minWidth: 0,
        }}
      >
        {group.loading ? (
          <span style={{ ...body, fontSize: 14, color: t.text2 }}>Loading…</span>
        ) : group.options.length === 0 ? (
          <span style={{ ...body, fontSize: 14, color: t.text2 }}>{group.emptyText}</span>
        ) : (
          group.options.map((option) => (
            <FacetChip
              key={option.value}
              option={option}
              tone={group.tone}
              testId={`facet-${group.key}-${option.value}`}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * One option, as BG-P07's selectable chip.
 *
 * SELECTION IS THREE SIGNALS AT ONCE. `chipSelectedStyle` gives the `--action`
 * border, which at 12px in a row of twenty chips is a hairline the eye can
 * miss on its own. So a selected chip also takes a `--glass-2` fill and
 * darkens its label from `--text2` to `--text`. The fill is free HERE and
 * nowhere else: the theme forbids it on a category chip because there the fill
 * encodes the category, and an outline chip's fill encodes nothing.
 */
function FacetChip({
  option,
  tone,
  testId,
}: {
  option: FacetOption;
  tone?: "breakage";
  testId: string;
}) {
  return (
    <Badge
      variant="outline"
      selectable
      selected={option.selected}
      data-testid={testId}
      onClick={option.onToggle}
      style={{
        minHeight: CHIP_HEIGHT,
        padding: "0 10px",
        gap: 6,
        ...(option.selected ? { background: t.glass2, color: t.text } : {}),
        /* After the selected ink, so the category's red survives selection. */
        ...(tone === "breakage" ? { color: t.catBreakage } : {}),
      }}
    >
      {option.label}
      {option.count === null ? null : (
        <span style={{ ...tabular, color: t.text2 }}>{option.count}</span>
      )}
    </Badge>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   The selected row
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Everything currently narrowing the grid, each removable on its own, plus one
 * control that removes all of them.
 *
 * "Clear all" is TERTIARY. It is the least consequential control on the page —
 * it widens a query, and nothing is lost by pressing it — and the theme allows
 * one primary action per view, which the frame's own compose control is
 * already spending.
 */
function SelectedRow({
  selected,
  onClearAll,
}: {
  selected: SelectedFacet[];
  onClearAll: () => void;
}) {
  return (
    <div
      data-visual-slot="gallery-selected-facets"
      style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: SPACE.xs }}
    >
      {selected.map((facet) => (
        <Badge
          key={facet.id}
          variant="outline"
          selectable
          selected
          data-testid={`selected-facet-${facet.id}`}
          aria-label={`Remove filter ${facet.label}`}
          onClick={facet.onRemove}
          style={{
            minHeight: CHIP_HEIGHT,
            padding: "0 8px 0 10px",
            gap: 6,
            background: t.glass2,
            color: t.text,
          }}
        >
          {facet.label}
          <X size={12} aria-hidden style={{ color: t.text2 }} />
        </Badge>
      ))}

      <Button
        type="button"
        variant="ghost"
        data-testid="gallery-clear-all"
        onClick={onClearAll}
        style={{ height: CHIP_HEIGHT, padding: "0 10px", borderRadius: r.control }}
      >
        Clear all
      </Button>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   The collapsed control
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Below 1024: one control, and the same three groups inside a sheet.
 *
 * THE SHEET IS THE KIT'S, not a second one written here. BG-P07 put the
 * portalled surfaces on the per-theme elevation model and gave them the scrim,
 * the focus trap and the Escape key; re-implementing any of that for one page
 * would be a second overlay to keep in step with the first.
 *
 * FILTERS APPLY AS THEY ARE PRESSED, so "Done" closes the sheet and does
 * nothing else. A sheet that batched the changes would need an Apply, a Cancel
 * and a draft copy of the selection, which is three new concepts for a surface
 * whose whole job is one request per click.
 */
function CollapsedFacets({
  groups,
  activeCount,
}: {
  groups: FacetGroup[];
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          data-testid="gallery-filters-trigger"
          style={{ alignSelf: "flex-start", gap: SPACE.xs }}
        >
          <SlidersHorizontal size={16} aria-hidden />
          Filters
          {activeCount > 0 ? (
            <span style={{ ...tabular, color: t.text2 }}>{activeCount}</span>
          ) : null}
        </Button>
      </SheetTrigger>

      <SheetContent
        side="bottom"
        data-visual-slot="gallery-facet-sheet"
        style={{ maxHeight: "85vh", overflowY: "auto" }}
      >
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>
            Made for and Made with combine: a build has to match one of each. Picking
            several inside one group widens it.
          </SheetDescription>
        </SheetHeader>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: SPACE.md,
            paddingTop: SPACE.md,
            paddingBottom: SPACE.md,
          }}
        >
          {groups.map((group) => (
            <FacetGroupRow key={group.key} group={group} />
          ))}
        </div>

        <SheetClose asChild>
          <Button type="button" variant="secondary" style={{ width: "100%" }}>
            Done
          </Button>
        </SheetClose>
      </SheetContent>
    </Sheet>
  );
}

export default FacetRail;
