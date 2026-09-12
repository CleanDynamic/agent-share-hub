// The category chip: one part category, in its measured pair (BG-P11).
//
// WHAT THIS REPLACES. Seven surfaces each drew their own — the gallery card,
// the build header, the node card, the run view, the convert plan, the compose
// tree and the intake proposal — and no two agreed on the shape. Three were at
// `border-radius: 100` or `999`, which is the capsule rule the theme dropped by
// decision; one was at 6, one at 8; two were uppercase and five were not; and
// the build header's was not a category chip at all but a hairline outline in a
// hardcoded teal or orange, so "made for founders" was painted the same green
// the platform reserves for a configuration part.
//
// THE FILL IS THE WHOLE TREATMENT. `categoryFill` returns a measured
// background/foreground pair — see the note in category.ts for how the ten were
// struck — and the contract is that the halves are used together or not at all.
// So a chip carries a transparent border and the fill does the work; there is
// no second colour on it, and selection does not overwrite the fill, because
// the fill is the one thing the chip encodes.
//
// WHY NOT `ui/badge.tsx`. Badge is the shadcn primitive and it resolves through
// the same `chipStyle`, so this is not a second implementation of the paint —
// it is a second WRAPPER, and deliberately. Badge is a `<div>` carrying cva
// classes whose padding is `px-2.5 py-0.5`; every surface converted here sits a
// chip inline in a text row at 2px/7px, and adopting Badge's padding would move
// each of them. A chip must also be phrasing content: several of these sit
// inside a `<p>` or an `<a>`, where a `<div>` is invalid. So: one paint, two
// wrappers, and the difference between them is the box, not the colour.
//
// A COUNT RIDES INSIDE THE CHIP, not beside it. "configuration 3" is one object
// naming one category; a chip with a number after it is two, and a reader has
// to work out whether the number belongs to the chip or to the next one.
//
// Styled with inline style objects, like every other surface on the new path:
// Tailwind's generated utilities win over hand-written classes at build time.

import type { CSSProperties, MouseEventHandler } from "react";

import { chipSelectedStyle, chipStyle } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";
import { tabular } from "@/lib/theme/type";

/** The chip's own padding. Smaller than a control's: it is a label, not a target. */
const PAD = "2px 8px";

interface CommonProps {
  /** Anything the surface wants on hover — what the category means, usually. */
  title?: string;
  /** Present only on a selectable chip. Supplying it makes the chip a control. */
  onClick?: MouseEventHandler<HTMLSpanElement>;
  style?: CSSProperties;
}

export interface CategoryChipCategoryProps extends CommonProps {
  variant?: "category";
  /**
   * A part category. Anything the resolver does not recognise lands on the
   * measured fallback pair — `--text2` on `--recess` — rather than on an
   * invented hue. A role like "founders" is NOT a category and resolves there
   * on purpose: borrowing one of the nine for it would say the card was talking
   * about a configuration.
   */
  category: string;
  /** What the chip says. The registry's label, usually. */
  label: string;
  /** A tally riding inside the chip. Absent and zero both render no number. */
  count?: number | null;
  /** Whether this chip is currently chosen. A border, never a second fill. */
  selected?: boolean;
}

export interface CategoryChipOverflowProps extends CommonProps {
  variant: "overflow";
  /** How many more there are. "+4". */
  count: number;
}

export type CategoryChipProps = CategoryChipCategoryProps | CategoryChipOverflowProps;

export function CategoryChip(props: CategoryChipProps) {
  const { title, onClick, style } = props;
  const selectable = Boolean(onClick);

  if (props.variant === "overflow") {
    return (
      <span
        data-visual-slot="category-chip"
        data-chip-variant="overflow"
        title={title}
        onClick={onClick}
        style={{
          /* The OUTLINE tone, which is `--text2` on nothing. An overflow chip
             names no category, so it must not wear one of the ten grounds — a
             filled "+4" reads as a tenth category rather than as the rest of
             the row. */
          ...chipStyle("outline", { selectable }),
          ...tabular,
          padding: PAD,
          whiteSpace: "nowrap",
          color: t.text2,
          ...style,
        }}
      >
        +{props.count}
      </span>
    );
  }

  const { category, label, count, selected } = props;
  const showCount = typeof count === "number" && count > 0;

  return (
    <span
      data-visual-slot="category-chip"
      data-chip-variant="category"
      data-category={category}
      data-chip-selected={selected ? "" : undefined}
      title={title}
      onClick={onClick}
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      aria-pressed={selectable ? Boolean(selected) : undefined}
      onKeyDown={
        selectable
          ? (event) => {
              /* A chip that says it is a button has to answer to the keys a
                 button answers to, or it is a span that merely looks like one. */
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.currentTarget.click();
              }
            }
          : undefined
      }
      style={{
        ...chipStyle("category", { category, selectable }),
        ...(selected ? chipSelectedStyle : null),
        display: "inline-flex",
        alignItems: "baseline",
        gap: 5,
        padding: PAD,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {label}
      {showCount ? (
        <span data-chip-count="" style={{ ...tabular, opacity: 0.75 }}>
          {count}
        </span>
      ) : null}
    </span>
  );
}

export default CategoryChip;
