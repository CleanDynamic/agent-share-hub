/* Mobile 28 G: one drop on still water, the picture in every empty list on a phone. No React.

   THE PICTURE. A 4px lattice over the canvas. A drop falls in the middle every `DROP_CYCLE_S` (2.6s); the last three trains of
   rings are alive at once, spreading with the phone's ring scale (engine.ts, PHONE_RINGS) and squashed to half height, so the
   water reads as a surface seen at an angle. In the first 18% of each cycle the drop's splash brightens the middle. Grain is
   added to every dot's tone and only dots over a threshold are drawn, so the faint parts break into scattered dots rather
   than fading as a smooth wash. The field thins out towards its edges. Colours are the three dot tokens (deep, mid, hi).

   Times are seconds; lengths are CSS pixels. Nothing here reads the DOM except through the canvas it is given. */

import { clamp01, DotBatch, hash2, PHONE_RINGS, ringsOf, shadeOf, waveAt, type Rings } from "./engine";

export const DROP_PITCH = 4;
/** A drop falls this often. */
export const DROP_CYCLE_S = 2.6;
/** How many ring trains are alive at once. */
export const DROP_TRAINS = 3;
/** The splash lasts this share of a cycle. */
export const SPLASH_SHARE = 0.18;
/** Rings are drawn at this share of their height. */
export const SQUASH = 0.5;
/** A dot is drawn only when its tone (grain included) is over this. */
export const DRAW_OVER = 0.36;
/** The frame drawn under reduced motion: rings out, no splash. */
export const STILL_T = 1.1;

/** The trains alive at `t` around (`cx`, `cy`), on the squashed plane. */
export function dropTrains(t: number, cx: number, cy: number): Rings[] {
  const phase = ((t % DROP_CYCLE_S) + DROP_CYCLE_S) % DROP_CYCLE_S;
  const out: Rings[] = [];
  for (let k = 0; k < DROP_TRAINS; k++) {
    const rings = ringsOf(cx, cy, phase + k * DROP_CYCLE_S, DROP_TRAINS * DROP_CYCLE_S, PHONE_RINGS);
    if (rings) out.push(rings);
  }
  return out;
}

/** How bright the splash is at `t`: rises and falls inside the first 18% of the cycle, 0 after. */
export function splashAt(t: number): number {
  const phase = (((t % DROP_CYCLE_S) + DROP_CYCLE_S) % DROP_CYCLE_S) / DROP_CYCLE_S;
  if (phase >= SPLASH_SHARE) return 0;
  return Math.sin((phase / SPLASH_SHARE) * Math.PI);
}

/** One dot's tone at (`x`, `y`) in a field `w` by `h` at `t`, before the threshold. Pure. */
export function dropTone(x: number, y: number, w: number, h: number, t: number, rings: readonly Rings[], splash: number): number {
  const cx = w / 2;
  const cy = h / 2;
  /* The rings are circles on the water; seen at an angle, the water's y is doubled before it is measured. */
  const ly = cy + (y - cy) / SQUASH;
  const wave = rings.length ? waveAt(rings, x, ly) : 0;
  const r = Math.hypot(x - cx, ly - cy);
  const splashTone = splash * Math.exp(-(r * r) / (2 * 14 * 14)) * 0.9;
  /* Still water is faint; the rings and the splash lift it. */
  const edge = clamp01(1 - Math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2)) * 0.9);
  const grain = (hash2(Math.round(x / DROP_PITCH), Math.round(y / DROP_PITCH)) - 0.5) * 0.36;
  return (0.26 + 0.55 * Math.max(0, wave) + 0.12 * wave + splashTone) * (0.35 + 0.65 * edge) + grain;
}

/** Draws one frame. `palette` is the three dot colours, deepest first. Returns how many dots were drawn. */
export function drawDropField(ctx: CanvasRenderingContext2D, w: number, h: number, ratio: number, t: number, palette: readonly string[], batch = new DotBatch()): number {
  const rings = dropTrains(t, w / 2, h / 2);
  const splash = splashAt(t);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, w, h);
  batch.begin(3);
  let drawn = 0;
  for (let y = DROP_PITCH / 2; y < h; y += DROP_PITCH) {
    for (let x = DROP_PITCH / 2; x < w; x += DROP_PITCH) {
      const tone = dropTone(x, y, w, h, t, rings, splash);
      if (tone <= DRAW_OVER) continue;
      const v = clamp01(tone);
      batch.add(shadeOf(v), x, y, DROP_PITCH * 0.46 * (0.58 + 0.42 * v));
      drawn++;
    }
  }
  batch.flush(ctx, palette);
  return drawn;
}
