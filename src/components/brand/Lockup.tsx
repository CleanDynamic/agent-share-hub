// The lockup: the mark and the word (UI-P06).
//
// The word is lower case and set in the display face at the lockup's own size,
// with the letter-spacing and line-height `type.display(size, { lockup: true })`
// gives it (Sentient 500, −0.03em, line-height 1) — the one place Sentient may
// go under its 20px floor. The mark is 1.1× the type size and the gap 0.38×, both
// truncated, which is what the reference draws at every size it uses: 16 footer,
// 19 mobile header, 21 site header, 34 mobile sign-in, 64 and 70 desktop sign-in.
//
// `size` IS THE DRAWN SIZE (UI-P54). The density pass renders the word through
// the table (21 → 18, 16 → 15) and the gap too (7 → 5, 24 → 17); the mark is an
// SVG sized by its own attributes in the kit, which the pass did not touch, so it
// keeps 1.1× the drawn size — the header's mark is still 23 beside an 18px word.
//
// A LINK HOME NAMES ITSELF. The mark is `aria-hidden` and the word is the whole
// visible label, but "buildgallery" alone says nothing about where the link
// goes, so a lockup given `to` is a link whose accessible name is "buildgallery
// home". Without `to` it is a plain row and says nothing about itself.

import type { CSSProperties } from "react";
import { Link } from "react-router-dom";

import { denseSpace } from "@/lib/theme/density";
import { t } from "@/lib/theme/tokens";
import { display } from "@/lib/theme/type";

import { Mark } from "./Mark";
import { useRoom } from "./useRoom";

export interface LockupProps {
  /** The type size in px, as the reference drew it; rendered through the density table. */
  size: number;
  /** The ink of the word and the mark's body. Defaults to `--text`. */
  color?: string;
  /** Make the lockup a link home. */
  to?: string;
}

export function Lockup({ size, color = t.text, to }: LockupProps) {
  const halo = useRoom() === "dusk";

  const row: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: denseSpace(Math.trunc(size * 0.38)),
    color,
    ...(to ? { textDecoration: "none" } : null),
  };

  const content = (
    <>
      <Mark size={Math.trunc(size * 1.1)} halo={halo} />
      <span style={display(size, { lockup: true })}>buildgallery</span>
    </>
  );

  if (to) {
    return (
      <Link data-ui="lockup" to={to} aria-label="buildgallery home" style={row}>
        {content}
      </Link>
    );
  }
  return (
    <div data-ui="lockup" style={row}>
      {content}
    </div>
  );
}

export default Lockup;
