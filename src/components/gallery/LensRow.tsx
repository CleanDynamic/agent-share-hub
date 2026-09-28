import type { KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";

import { GALLERY_LENSES, type GalleryLens } from "@/lib/build/gallery";
import { chipType, ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { feedback } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";

/* ────────────────────────────────────────────────────────────────────────────
   RC-P10 — the lens row.

   FOUR WAYS IN, BY THE READER'S INTENT ⟦hicks-law › Budgets: lens row⟧: All,
   Proven (does it work?), Rebuilt (can I build on it?), Unsolved (where can I
   help?). Exactly four, single-select, All by default. A lens filters the
   gallery; it never reorders it.

   A DIFFERENT SET FROM THE FACETS, AND IT LOOKS IT ⟦law-of-similarity⟧. Both
   are chips on the ground (STATES.md rows 4 and 5), so they share the outline
   and the selected fill; what separates the sets is the label. Lenses are
   uppercase DM Mono and carry no count; facet options are the chip face in
   lower case with a count. Within each set every chip is identical.

   EACH CHIP IS A LINK. The state lives in the address (galleryParams.ts), so a
   lens is somewhere to go: a middle-click opens it in a new tab, and the
   browser's Back button walks back through lenses. role="radio" with
   aria-checked tells assistive technology it is one choice of four; the arrow
   keys move between the four, and Space chooses, as a radio group's do.

   32 TALL, 44 TO THE FINGER ⟦responsive-design › Touch⟧. The link is the hit
   area and the chip is inside it, so the extra height is padding on the link
   rather than a bigger chip. The row wraps rather than scrolling sideways
   ⟦better-layout › Plan for growth⟧.

   NOT ORANGE WHEN CHOSEN ⟦von-restorff-effect⟧. The selected chip takes the
   --recess fill and a --text border: selection is a state of a control, not
   the page's one call to action, so it does not borrow --action.
   ──────────────────────────────────────────────────────────────────────────── */

/** What each lens is called on screen. */
export const LENS_LABELS: Record<GalleryLens, string> = {
  all: "All",
  proven: "Proven",
  rebuilt: "Rebuilt",
  unsolved: "Unsolved",
};

/** The chip's own height. */
const CHIP_HEIGHT = 32;

/** The smallest a touch target may be. */
const HIT_HEIGHT = 44;

export interface LensRowProps {
  /** The lens the gallery is showing. */
  current: GalleryLens;
  /** The address of the gallery under each lens, everything else kept. */
  hrefFor: (lens: GalleryLens) => string;
}

export function LensRow({ current, hrefFor }: LensRowProps) {
  /* Arrow keys move focus along the four, wrapping at either end; they do not
     navigate, so a reader can reach any lens without opening the ones between. */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) return;
    const radios = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'),
    );
    const at = radios.indexOf(document.activeElement as HTMLElement);
    if (at === -1) return;
    event.preventDefault();
    radios[(at + step + radios.length) % radios.length]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Lens"
      data-visual-slot="gallery-lens-row"
      onKeyDown={onKeyDown}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        columnGap: SPACE.xs,
        rowGap: 0,
      }}
    >
      {GALLERY_LENSES.map((lens) => (
        <LensChip key={lens} lens={lens} checked={lens === current} to={hrefFor(lens)} />
      ))}
    </div>
  );
}

function LensChip({ lens, checked, to }: { lens: GalleryLens; checked: boolean; to: string }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();

  return (
    <Link
      to={to}
      role="radio"
      aria-checked={checked}
      data-testid={`lens-${lens}`}
      onKeyDown={(event) => {
        /* Space chooses a radio. A link only answers Enter on its own. */
        if (event.key === " ") {
          event.preventDefault();
          event.currentTarget.click();
        }
      }}
      {...handlers}
      style={{
        display: "inline-flex",
        alignItems: "center",
        paddingBlock: (HIT_HEIGHT - CHIP_HEIGHT) / 2,
        textDecoration: "none",
        outline: "none",
      }}
    >
      <span
        style={{
          ...chipType,
          textTransform: "uppercase",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: CHIP_HEIGHT,
          paddingInline: 12,
          boxSizing: "border-box",
          whiteSpace: "nowrap",
          borderRadius: r.chip,
          borderWidth: 1,
          borderStyle: "solid",
          /* Row 5 when chosen; row 4 otherwise, its border lifting to --text2
             under a fine pointer as every selectable chip's does. */
          borderColor: checked ? t.text : state.hovered ? t.text2 : t.line,
          background: checked ? t.recess : "transparent",
          color: checked ? t.text : t.text2,
          cursor: "pointer",
          /* Colour and fill only, 150ms; "none" under reduced motion. */
          transition: feedback("color", "background-color"),
          ...ring(state.focusVisible),
        }}
      >
        {checked ? <Check size={12} aria-hidden strokeWidth={2.25} /> : null}
        {LENS_LABELS[lens]}
      </span>
    </Link>
  );
}

export default LensRow;
