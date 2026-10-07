// The category chip: one part category, in its own hue (BG-P11, repainted UI-P06+).
//
// WHAT THIS REPLACES. Seven surfaces each drew their own — the gallery card,
// the build header, the node card, the run view, the convert plan, the compose
// tree and the intake proposal — and no two agreed on the shape. This is the one
// rendering, and the design kit's: a 1px `--line` border, DM Mono 10px, padding
// 2px 4px (2px 6px before the UI-P54 density pass), radius 8, no wrap, and NO
// FILL. The category is carried by the text
// colour alone, `--cat-<category>`, which every hue clears as text on glass
// (>= 5.72:1 on Noon, >= 5.78:1 on Dusk, `contrast.test.ts`).
//
// The props are unchanged: `category` + `label` + `count`, `selected`, the
// `overflow` variant. Anything the resolver does not recognise lands on
// `--cat-fallback` (`--text2`) rather than on an invented hue — a role like
// "founders" is NOT a category and must not borrow one of the nine.
//
// SELECTION IS A BORDER, never a fill: a selected chip's border is `--action`.
//
// A COUNT RIDES INSIDE THE CHIP, not beside it. "configuration 3" is one object
// naming one category; a chip with a number after it is two.
//
// Styled with inline style objects, like every other surface on the new path:
// Tailwind's generated utilities win over hand-written classes at build time.

import type { CSSProperties, MouseEventHandler } from "react";

import { categoryColour } from "@/lib/theme/category";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, tabular } from "@/lib/theme/type";

/** What every chip shares: the reference's box, with no fill and a hairline. */
const BASE: CSSProperties = {
  border: `1px solid ${t.line}`,
  fontFamily: DM_MONO,
  fontSize: 10,
  lineHeight: "normal",
  padding: "2px 4px",
  borderRadius: r.chip,
  whiteSpace: "nowrap",
};

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
   * fallback ink — `--text2` — rather than on an invented hue. A role like "founders" is NOT a category and resolves there
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
        data-ui="category-chip"
        data-variant="overflow"
        data-visual-slot="category-chip"
        data-chip-variant="overflow"
        title={title}
        onClick={onClick}
        style={{
          /* An overflow chip names no category, so it wears no category hue: a
             coloured "+4" reads as a tenth category rather than as the rest of
             the row. */
          ...BASE,
          ...tabular,
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
      data-ui="category-chip"
      data-variant={category}
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
        ...BASE,
        color: categoryColour(category),
        ...(selected ? { borderColor: t.action } : null),
        display: "inline-flex",
        alignItems: "baseline",
        gap: 5,
        cursor: selectable ? "pointer" : undefined,
        ...style,
      }}
    >
      {label}
      {/* The count is set apart by `tabular` and by the gap. It carries no
          opacity: the ink has to stay the measured hue (BG-P30). */}
      {showCount ? (
        <span data-chip-count="" style={tabular}>
          {count}
        </span>
      ) : null}
    </span>
  );
}

export default CategoryChip;
