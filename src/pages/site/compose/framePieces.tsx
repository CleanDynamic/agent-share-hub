/* SV-06 P4: a bordered, rounded box drawn in three pieces, so its size can change on the compositor alone.

   A part's frame and a skeleton lane are a 1px line with rounded corners. Scaled to a new height, the corners and the line would
   stretch; revealed by `clip-path`, every frame would repaint. In pieces, they do neither: the TOP (the top edge and its two corners),
   the SIDES (two 1px lines with nothing to stretch, scaled in height), and the BOTTOM (the bottom edge and its corners, which slides).
   At rest the frame is drawn WHOLE, one rounded border exactly as before (the box it frames has 1px more padding in place of its own
   border, so nothing moves); the pieces stand hidden behind it. While a frame moves, the animator shows the pieces and hides the whole
   (`showPieces`), and puts it back when they have ended, so even the anti-aliasing of the corners at rest is what it always was. The
   listMotion helpers `resizePieces` and `openFrame` move them. */

import type { CSSProperties } from "react";

/** Each piece carries this attribute: "top", "sides" or "bottom"; the frame drawn whole, at rest, "whole". */
export const FRAME_PIECE = "data-frame-piece";

const piece = (extra: CSSProperties): CSSProperties => ({ position: "absolute", left: 0, right: 0, boxSizing: "border-box", pointerEvents: "none", ...extra });

/** The frame round a box with `position: relative`, `radius` its corners, `colour` its 1px line, `fill` the inside (none by default). */
export function FramePieces({ radius, colour, fill }: { radius: number; colour: string; fill?: string }) {
  const edge = `1px solid ${colour}`;
  const background = fill ?? undefined;
  return (
    <>
      <span aria-hidden="true" {...{ [FRAME_PIECE]: "whole" }} style={piece({ top: 0, bottom: 0, border: edge, borderRadius: radius, background })} />
      <span aria-hidden="true" {...{ [FRAME_PIECE]: "top" }} style={piece({ top: 0, height: radius, borderTop: edge, borderLeft: edge, borderRight: edge, borderRadius: `${radius}px ${radius}px 0 0`, background, visibility: "hidden" })} />
      <span aria-hidden="true" {...{ [FRAME_PIECE]: "sides" }} style={piece({ top: radius, bottom: radius, borderLeft: edge, borderRight: edge, background, transformOrigin: "0 0", visibility: "hidden" })} />
      <span aria-hidden="true" {...{ [FRAME_PIECE]: "bottom" }} style={piece({ bottom: 0, height: radius, borderBottom: edge, borderLeft: edge, borderRight: edge, borderRadius: `0 0 ${radius}px ${radius}px`, background, visibility: "hidden" })} />
    </>
  );
}
