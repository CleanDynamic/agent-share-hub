// buildgallery.ai — the radius scale.
//
// THE SHAPE LANGUAGE WAS DROPPED. An earlier revision of this system specified
// domed "pod" cards, porthole ovals, chrome rims, a reflective floor and a
// capsule rule that made every control a pill. All five were dropped by
// decision, and this scale is what replaced them: radius is now the WHOLE shape
// vocabulary, which is why there are eight names and not sixteen. (Six until
// BG-P09 added `r-thread` for the box inset in a build card, seven with
// `r-full`, and eight since UI-P81 added `r-window`; see their notes.)
//
// NOTHING IS A PILL AND NOTHING IS SQUARE. `--r-full` is not the default for
// anything interactive — it exists only for genuinely circular objects, a
// spinner or an avatar. A button at 999px is off-brand in this system, and the
// `--radius-btn: 100px` still sitting in the legacy `:root` block is the shape
// this series is moving away from. BG-P07 repoints its consumers; this module
// only defines what they will be repointed to.
//
// WHY THE VALUES LIVE IN BOTH THEME BLOCKS. They are theme-independent — a card
// is 14px in Noon and 14px in Dusk. They are declared in both blocks
// anyway so that everything a component reads off the root element comes from
// one place, and so a future theme could move a radius without a second
// mechanism being invented for it. `css-parity.test.ts` holds the two blocks to
// this file.
//
// THE SCALE IS THE REFINED LOOK'S (UI-P81, the only one since UI-P99): 4 tag, 6 control
// and media, 8 card, 10 surface, 12 window. Radius is theme-independent: a card is 8px
// in Noon and 8px in Dusk.
//
// USAGE. Like `tokens.ts`, every member is a `var()` reference ready to drop
// into an inline style, because Tailwind's generated utilities beat hand-written
// classes at build time and this codebase styles inline:
//
//   import { r } from "@/lib/theme/radius";
//   <button style={{ borderRadius: r.control }}>

/** Every radius token and its value. The single source of truth for the scale. */
export const RADIUS = {
  /** 4px — chips, tags, badges, checkboxes. */
  "r-chip": "4px",
  /** 6px — images, video, thumbnails, media wells. */
  "r-media": "6px",
  /** 6px — buttons, inputs, selects, switch tracks, list rows. NOT 999px. */
  "r-control": "6px",
  /**
   * 6px — the thread box inset in a build card (BG-P09), and nothing else.
   *
   * THE SAME VALUE AS `r-control` AND `r-media`, AND A SEPARATE NAME ANYWAY. The
   * box, the button and the picture are different roles, and the day one of them
   * moves the other two must not follow. Spending `r-control` on the box would tie the box's shape to
   * the button scale, so the day a control moves the card would silently follow
   * it — which is exactly the drift the named scale exists to stop. A radius
   * with two jobs is two radii.
   */
  "r-thread": "6px",
  /** 8px — cards. */
  "r-card": "8px",
  /** 10px — the page surface and panels. */
  "r-panel": "10px",
  /** 12px — a window: a dialog or a side sheet (UI-P81). */
  "r-window": "12px",
  /**
   * 999px — CIRCULAR THINGS ONLY: spinners, avatars.
   *
   * This is not the default for controls and is not a "very rounded" step. The
   * capsule rule was removed deliberately, so reaching for this on a button, an
   * input or a badge is the one misuse the scale has. If a thing is not a
   * circle, one of the five steps above is its radius.
   */
  "r-full": "999px",
} as const;

export type RadiusName = keyof typeof RADIUS;

export const RADIUS_NAMES = Object.keys(RADIUS) as RadiusName[];

/** `"r-chip"` → `"chip"`. The CSS prefix is noise once you are inside `r`. */
type Unprefixed<S extends string> = S extends `r-${infer Rest}` ? Rest : S;

export type RadiusAccessor = {
  readonly [K in RadiusName as Unprefixed<K>]: `var(--${K})`;
};

/**
 * The scale, by role: `r.chip`, `r.media`, `r.control`, `r.thread`, `r.card`,
 * `r.panel`, `r.window`, `r.full`. Values are `var()` references, so a surface
 * written with them needs no re-render if a radius ever moves
 */
export const r = Object.fromEntries(
  RADIUS_NAMES.map((name) => [name.slice(2), `var(--${name})`]),
) as RadiusAccessor;

/** The same reference by CSS name, for a radius decided at runtime. */
export const radiusVar = (name: RadiusName): `var(--${RadiusName})` => `var(--${name})`;
