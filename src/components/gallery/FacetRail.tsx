import { useId, useState } from "react";
import { Check, ChevronDown, ChevronUp, SlidersHorizontal, X } from "lucide-react";

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
import { chipType, ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { SPACE_COMPACT as SPACE } from "@/lib/theme/space";
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

   RC-P10 — TWO GROUPS, SIX OPTIONS EACH, THEN "MORE".

   Made for and Made with are the only facet groups now ⟦hicks-law › Budgets:
   facet groups ≤ 2⟧: Open bounties became the Unsolved lens, in the lens row
   above this band. Each group shows at most six options, highest count first
   ⟦hicks-law › Readers table: frequency⟧, and a selected option is always
   among them. A group with more ends in a text control, "More" with a chevron
   pointing down, that reveals the rest in place and becomes "Fewer" pointing
   up ⟦law-of-continuity › Directional indicators⟧ ⟦better-layout › Hint at
   hidden content⟧. It is the one split the budget sanctions: the second level
   holds more of the same, so a reader knows what is behind it before opening.

   On the band the two groups stand side by side, 29 apart, each a mono label
   with its chips 6 under it ⟦law-of-proximity⟧ (40 and 8 before the UI-P56
   density pass). Those gaps live on wrappers
   written for this band; the sheet below 1024 keeps its rows as they were.

   The chips are STATES.md rows 4 and 5: an outline chip at rest; chosen, the
   --recess fill, a --text border, a --text label and a 12px check before it.
   The count rides inside in DM Mono, tabular.
   ──────────────────────────────────────────────────────────────────────────── */

/** Chips are 23px tall here: the 28 they were before the repaint, through the UI-P56 density table. The spacing is SPACE_COMPACT, the old steps through the same table. */
const CHIP_HEIGHT = 23;

/** Below this the band becomes a "Filters" control and a sheet. */
export const FACET_COLLAPSE_BELOW = 1024;

/** How many options a group shows before "More" ⟦hicks-law › Budgets⟧. */
export const FACET_VISIBLE_MAX = 6;

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
}

/**
 * The options a group shows: highest count first, at most FACET_VISIBLE_MAX
 * while folded, every selected option among them. Ties keep the order they
 * arrived in. More than six selected options are all shown: that many is the
 * reader's own choice, and hiding one of them would hide part of the query.
 */
export function visibleOptions(
  options: readonly FacetOption[],
  expanded: boolean,
): { shown: FacetOption[]; hidden: number } {
  const ranked = [...options].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  if (expanded || ranked.length <= FACET_VISIBLE_MAX) return { shown: ranked, hidden: 0 };

  const chosen = ranked.filter((option) => option.selected);
  const room = Math.max(0, FACET_VISIBLE_MAX - chosen.length);
  const kept = new Set([...chosen, ...ranked.filter((option) => !option.selected).slice(0, room)]);
  const shown = ranked.filter((option) => kept.has(option));
  return { shown, hidden: ranked.length - shown.length };
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
        <FacetBand groups={groups} />
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

/**
 * At 1024 and up: the groups side by side, 40 apart, wrapping under each other
 * when the column is too narrow for both. Each is its label, then its chips 8
 * below. Every element here is new to RC-P10.
 */
function FacetBand({ groups }: { groups: FacetGroup[] }) {
  return (
    <div
      data-visual-slot="gallery-facet-groups"
      style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: SPACE.lg }}
    >
      {groups.map((group) => (
        <BandGroup key={group.key} group={group} />
      ))}
    </div>
  );
}

function BandGroup({ group }: { group: FacetGroup }) {
  const labelId = useId();
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      data-facet-group={group.key}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: SPACE.xs,
        flex: "1 1 280px",
        minWidth: 0,
      }}
    >
      <span id={labelId} style={{ ...eyebrow, color: t.text2 }}>
        {group.label}
      </span>
      <FacetOptions group={group} />
    </div>
  );
}

/**
 * A group's chips: at most six, highest count first, a selected one always
 * among them, then More or Fewer when there are more than six. Shared by the
 * band and the sheet, so both fold the same way.
 */
function FacetOptions({ group }: { group: FacetGroup }) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();

  if (group.loading) {
    return <span style={{ ...body, fontSize: 13, color: t.text2 }}>Loading…</span>;
  }
  if (group.options.length === 0) {
    return <span style={{ ...body, fontSize: 13, color: t.text2 }}>{group.emptyText}</span>;
  }

  const { shown, hidden } = visibleOptions(group.options, expanded);
  const foldable = expanded || hidden > 0;

  return (
    <div
      id={listId}
      data-facet-options={group.key}
      style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: SPACE.xs, minWidth: 0 }}
    >
      {shown.map((option) => (
        <FacetChip
          key={option.value}
          option={option}
          testId={`facet-${group.key}-${option.value}`}
        />
      ))}
      {foldable ? (
        <MoreToggle
          expanded={expanded}
          controls={listId}
          testId={`facet-${group.key}-more`}
          onToggle={() => setExpanded((open) => !open)}
        />
      ) : null}
    </div>
  );
}

/**
 * "More" with a chevron pointing down; "Fewer" with it pointing up: text with
 * no outline, so it reads as a control beside the chips rather than as one.
 *
 * --text, NOT THE PICTURE'S BURNT ORANGE. --action clears the floor on the
 * band's --bg (4.80 Noon, 6.33 Dusk), but the sheet below 1024 is
 * --glass over the scrim, and there --action measured 3.69:1 on Noon,
 * under the 4.5 text floor. The theme's first remedy is a legal pairing, and
 * --text is legal on both grounds; one look for one control on both surfaces
 * ⟦law-of-similarity⟧.
 */
function MoreToggle({
  expanded,
  controls,
  testId,
  onToggle,
}: {
  expanded: boolean;
  controls: string;
  testId: string;
  onToggle: () => void;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const Chevron = expanded ? ChevronUp : ChevronDown;

  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={controls}
      data-testid={testId}
      onClick={onToggle}
      {...handlers}
      style={{
        ...chipType,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        minHeight: CHIP_HEIGHT,
        paddingInline: 4,
        background: "transparent",
        border: "none",
        borderRadius: r.chip,
        color: t.text,
        cursor: "pointer",
        textDecoration: state.hovered ? "underline" : "none",
        textUnderlineOffset: "3px",
        ...ring(state.focusVisible),
      }}
    >
      {expanded ? "Fewer" : "More"}
      <Chevron size={12} aria-hidden strokeWidth={2.25} />
    </button>
  );
}

/** One group: its mono label, then its chips, wrapping under themselves. */
function FacetGroupRow({ group }: { group: FacetGroup }) {
  return (
    <div
      data-facet-group={group.key}
      role="group"
      aria-label={group.label}
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
        <FacetOptions group={group} />
      </div>
    </div>
  );
}

/**
 * One option, as BG-P07's selectable chip, painted as STATES.md rows 4 and 5.
 *
 * SELECTION IS FOUR SIGNALS AT ONCE (row 5): the --recess fill, a --text
 * border, the label darkened from --text2 to --text, and a 12px check before
 * it, so the state survives without colour. The fill is free HERE and nowhere
 * else: the theme forbids it on a category chip because there the fill
 * encodes the category, and an outline chip's fill encodes nothing. It is set
 * after Badge's own selected border, which is --action and belongs to category
 * chips (STATES.md note on row 5).
 */
function FacetChip({ option, testId }: { option: FacetOption; testId: string }) {
  return (
    <Badge
      variant="outline"
      selectable
      selected={option.selected}
      data-testid={testId}
      onClick={option.onToggle}
      style={{
        minHeight: CHIP_HEIGHT,
        padding: "0 7px",
        gap: 4,
        ...(option.selected ? { background: t.recess, borderColor: t.text, color: t.text } : {}),
      }}
    >
      {option.selected ? <Check size={12} aria-hidden strokeWidth={2.25} /> : null}
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
            padding: "0 6px 0 7px",
            gap: 4,
            /* Row 5, like the chosen chip it removes. */
            background: t.recess,
            borderColor: t.text,
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
        style={{ height: CHIP_HEIGHT, padding: "0 7px", borderRadius: r.control }}
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
