/* CA-21: sliding by measuring. SV-06: what is left here is the measuring vocabulary; the slides themselves are played by the
   List's one animator (`listMotion.ts`), which measures every `[data-slide-id]` element before and after each change. */

export interface Spot {
  x: number;
  y: number;
}

export interface Box extends Spot {
  w: number;
  h: number;
}

/** Every element that can slide carries its own name here: `tile:<id>`, `session:<key>`, `part:<key>`. */
export const SLIDE_ATTR = "data-slide-id";
