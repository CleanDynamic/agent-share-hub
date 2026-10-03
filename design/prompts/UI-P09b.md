# UI-P09b — Liquid glass, on main panels only

Follow `design/RULES.md`.

**Goal.** The page-level panels become liquid glass: a refracted edge where the backdrop bends through them, over a fill solid enough to read body text on. Everything inside a panel — build cards, feed rows, wall labels, wells — stays as it is: slightly translucent and flat.

**Read first.** `components/brand/Panel.tsx` (UI-P09), `src/index.css`, `src/lib/theme/glass.ts` and `glass.test.ts` (the blur rules and the test that enforces them), `src/components/shell/SiteFrame.tsx`.

**This prompt amends three standing rules. Make each change deliberately, and say so in the report.**

1. `RULES.md` §3 says no new CSS classes for styling. Liquid glass needs two pseudo-elements, which inline styles cannot express. **One** class, `.bg-glass`, is added to `src/index.css` for this and nothing else. Every colour inside it is a custom property, so the tokens still govern it.
2. `glass.test.ts` asserts a small set of blurred surfaces. The budget becomes: the four chrome surfaces from `UI-P40` **plus** page-level panels. Update the assertion and its comment in this commit.
3. The performance guidance forbids `feDisplacementMap`. It is the whole effect here, so it is permitted on this one filter, under the guards in step 5. Nothing else in the app may use one.

**Build.**

1. **The filter, mounted once.** `src/components/brand/GlassFilter.tsx` renders a hidden `<svg width="0" height="0" aria-hidden="true" style="position:absolute">` holding one filter. `SiteFrame` renders it once, above everything. Values, as measured over the real backdrop at panel size:

   ```
   <filter id="bg-glass-distortion" x="0%" y="0%" width="100%" height="100%">
     <feTurbulence type="fractalNoise" baseFrequency="0.012 0.012" numOctaves="2" seed="92" result="noise"/>
     <feGaussianBlur in="noise" stdDeviation="2" result="blurred"/>
     <feDisplacementMap in="SourceGraphic" in2="blurred" scale="42"
                        xChannelSelector="R" yChannelSelector="G"/>
   </filter>
   ```

   The source this came from uses `baseFrequency 0.035` and `scale 180`, tuned for a 400×300 card. At 1280px those values tear the panel apart: the frequency drops to `0.012` so one wave spans the panel instead of twenty, and the scale to `42` so the edge bends without smearing. Keep `x/y/width/height` at `0%/100%` — it clips the displacement to the panel and stops the corners pulling in content from outside.

2. **The class**, in `src/index.css`, exactly these rules:

   ```css
   .bg-glass { position: relative; isolation: isolate; }
   .bg-glass > * { position: relative; z-index: 1; }
   .bg-glass::before {
     content: ""; position: absolute; inset: 0; z-index: 0; border-radius: inherit;
     pointer-events: none; background: var(--glass-fill);
     border: 1px solid var(--glass-border);
     box-shadow: inset 0 1px 0 var(--panel-highlight-color),
                 inset 0 0 20px -12px var(--glass-rim);
   }
   .bg-glass::after {
     content: ""; position: absolute; inset: 0; z-index: -1; border-radius: inherit;
     pointer-events: none; isolation: isolate;
     backdrop-filter: blur(7px) saturate(1.2);
     -webkit-backdrop-filter: blur(7px) saturate(1.2);
     filter: url(#bg-glass-distortion);
     -webkit-filter: url(#bg-glass-distortion);
   }
   ```

   **`.bg-glass > * { position: relative; z-index: 1 }` is not optional.** The tint layer is positioned, so without it the tint paints over the panel's own text and every word goes muddy. This is the single easiest way to get this wrong.

3. **Tokens** (UI-P03's system, both themes). `--glass-fill` is the one that matters: it is what body text sits on, so it is not the near-transparent fill the source uses.
   - `--glass-fill`: Noon `rgba(255,255,255,.58)`, Dusk `rgba(26,21,35,.74)` — **the two themes are not symmetric on purpose.** Noon's text is near-black on a light backdrop, so the fill can stay thin and let the horizon's salmon through; measured over the backdrop it still gives `--text` 13.2:1 and `--text2` 5.9:1. Dusk's text is near-white over a field that lifts into violet and salmon, so at `.58` the light areas eat the text; `.74` is where it holds. Do not "tidy" these to the same number.
   - `--glass-rim`: Noon `rgba(255,255,255,.55)`, Dusk `rgba(255,255,255,.55)`
   - `--panel-highlight-color`: Noon `rgba(255,255,255,1)`, Dusk `rgba(238,234,244,.12)`
   - `--glass-halo` (the outer edge light): Noon `0 0 21px -10px rgba(26,35,32,.18)`, Dusk `0 0 21px -8px rgba(255,255,255,.22)`
   `Panel` keeps `--shadow-card` and adds `--glass-halo` before it.

4. **Where it applies, and where it must not.** `Panel` gains `surface: "glass" | "flat" | "plain"`; only `glass` adds `.bg-glass`.
   - **Liquid glass:** a panel that is a direct child of the page column and sits on the backdrop — the Home hero, the visitors' book, the orbs panel, challenges, streak, where-next, the Gallery header and facet column, the Build proof panel, anatomy, timeline, the Bounties header and solve panel, the Profile level panel, works, activity, marks, the Activity list and its right column, and the sign-in card.
   - **Never:** anything that repeats inside a panel or a grid — build cards, vacant frames, feed rows, notification rows, wall-label cells, part viewer, `--recess` wells, chips, buttons, the inner preview on the import page. These keep what they have now: a slightly translucent fill, 1px border, no backdrop-filter, no filter.
   - **Never nested:** a `.bg-glass` inside another `.bg-glass` doubles the blur cost and reads as fog. Add a dev-only assertion that warns in the console if one is found.
   - Compose and import stay `flat` (§5.5 of the handoff) — a working surface does not refract.

5. **Guards**, all of them:
   - Below 768px, drop the `filter` and keep the blur and fill. Phone GPUs and mobile Safari pay for the displacement on every scroll frame, and at phone width the refraction is a few pixels wide and invisible anyway. Do this in CSS with a media query, not in JS.
   - `@media (prefers-reduced-transparency: reduce)` — drop both `filter` and `backdrop-filter`, and raise `--glass-fill` to `.96` in both themes.
   - `@supports not (backdrop-filter: blur(2px))` — fill only, no filter.
   - Safari applies the SVG filter to the element but not reliably to what is behind it, so it degrades to frosted glass without the refracted edge. That is acceptable; do not add a Safari-specific hack.

6. **Contrast.** Re-run `npm run audit:contrast` with panels composited over the *lightest* and *darkest* points of the backdrop, not over a flat colour. Every text token on `--glass-fill` must still pass 4.5:1 at both extremes. Measured at the values above, Noon's worst case is `--text2` at about 5.9:1 and Dusk's is tighter — check it rather than assuming. If a pair fails, raise that theme's `--glass-fill`; never lighten the text, and never raise both themes because one failed.

**Done when.** The listed panels refract the backdrop at their edges in both themes; no card, row or cell does; text contrast passes at both backdrop extremes; `glass.test.ts` passes with its updated assertion; scrolling the Gallery at 1440 holds 60fps with paint flashing on; and the phone build has no `feDisplacementMap` in its computed styles.

**Commit.** `UI-P09b: liquid glass on page panels`
