import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { chipSelectedStyle, chipStyle, type ChipTone } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";

/* ────────────────────────────────────────────────────────────────────────────
   BG-P07 — chips and badges.

   Radius `--r-chip`, and DM Mono at 12px for the label. A chip is the plaque
   under a specimen, not prose: it names a thing in as few characters as
   possible, and mono is the face this system gives to anything that labels
   rather than reads.

   THE CATEGORY CHIP LIVES HERE. There is no separate category-chip component in
   this codebase — `categoryFill()` is spent directly by the gallery card, the
   node card and the build header, all of which this prompt is forbidden to
   touch. So the reusable one is this component, given a `category` prop that
   resolves through the same measured resolver. The surfaces that inline their
   own chips keep theirs until the prompt that owns each one adopts this.

   `category` AND `selectable` ARE NEW AND OPTIONAL, WHICH IS NOT AN API CHANGE.
   Every consumer that compiles today compiles unchanged; the props only exist
   for consumers that want them. Nothing existing is renamed or removed.

   A FILLED CHIP CARRIES NO BORDER COLOUR OF ITS OWN. `categoryFill` returns a
   measured background/foreground pair and the theme is explicit that the two
   halves are used together or not at all — this hue on some other ground is a
   pairing nobody measured. So a category chip's border is transparent and the
   fill does the work; only the `outline` tone spends `--line`.

   SELECTION IS A BORDER, NOT A SECOND FILL. Overwriting the fill would destroy
   the one thing the fill encodes, which is the category.
   ──────────────────────────────────────────────────────────────────────────── */

const badgeVariants = cva(
  "inline-flex items-center border px-2.5 py-0.5 transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: "",
        secondary: "",
        destructive: "",
        outline: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** shadcn's four variant names, mapped onto the theme's chip tones. */
const TONE: Record<BadgeVariant, ChipTone> = {
  default: "action",
  secondary: "neutral",
  /* Destructive resolves through the category resolver rather than carrying a
     colour of its own, because breakage IS one of the nine part categories and
     a second red defined here would drift from it the first time either moved. */
  destructive: "category",
  outline: "outline",
};

/** The category a variant implies when the consumer named none. */
const IMPLIED_CATEGORY: Partial<Record<BadgeVariant, string>> = { destructive: "breakage" };

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  /**
   * A part category. Resolves through `categoryFill()` to one of the nine
   * measured hue/ground pairs, or to the fallback pair when it is not one of
   * them. Setting this wins over `variant`, because a chip that names a
   * category must be that category's colour.
   */
  category?: string;
  /** Makes the chip a control: focusable, pressable, and keyboard-operable. */
  selectable?: boolean;
  /** Whether a selectable chip is currently chosen. */
  selected?: boolean;
}

function Badge({
  className,
  variant,
  category,
  selectable,
  selected,
  style,
  onKeyDown,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  ...props
}: BadgeProps) {
  const { state, handlers } = useInteractive<HTMLDivElement>({
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
    onPointerDown,
    onPointerUp,
    onPointerCancel,
  });

  const resolvedVariant = variant ?? "default";
  const tone: ChipTone = category !== undefined ? "category" : TONE[resolvedVariant];
  const resolvedCategory = category ?? IMPLIED_CATEGORY[resolvedVariant];

  /* A chip that says it is selectable has to actually be operable, or it is a
     div that merely looks like a control. Enter and Space are what a button
     answers to, so a chip claiming role="button" answers to them too. The
     element stays a <div> — changing the tag would change the DOM every
     existing consumer already renders. */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (!selectable || event.defaultPrevented) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.currentTarget.click();
    }
  };

  return (
    <div
      className={cn(badgeVariants({ variant }), className)}
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      aria-pressed={selectable ? Boolean(selected) : undefined}
      style={{
        ...chipStyle(tone, { category: resolvedCategory, selectable, ...state }),
        ...(selected ? chipSelectedStyle : {}),
        ...style,
      }}
      onKeyDown={handleKeyDown}
      {...props}
      {...(selectable ? handlers : {})}
    />
  );
}

export { Badge, badgeVariants };
