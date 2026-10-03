# UI-P13b — The living backdrop

Follow `design/RULES.md`. **This replaces what `UI-P13` built.** If `UI-P13` has not run, build it from here instead and skip its static arc.

**Goal.** The backdrop stops being a static SVG and becomes a slow, continuous gradient field: silk folds that drift on their own, bottoming out at the darkest purple on Dusk, with the arc region lifting into violet and salmon. A click sends a soft wavefront through the folds.

**Read first.** `UI-P13`'s `PageBackdrop`, `src/lib/theme/tokens.ts`, `design/tokens/tokens.json` (the `backdrop`, `ambient`, `arc*` and `haze` values per theme), `src/components/shell/SiteFrame.tsx`, and the reference boards for the colour it has to match.

**This prompt amends a standing rule.** `RULES.md` §3.4 and the performance guidance say the backdrop is static, one paint, no animation. It is now a continuously rendering WebGL canvas. Update that line in `RULES.md` and in `HANDOFF.md` §3.4 in this commit, with the budget in step 4.

**Build** `src/components/brand/PageBackdrop.tsx`.

1. **The canvas.** One `<canvas>`, `position: fixed; inset: 0; z-index: 0`, `aria-hidden`, behind everything in `SiteFrame`. One WebGL context, one fullscreen triangle, no library and no dependency. Buffer at `min(devicePixelRatio, 1.5) × 0.85` of the viewport (`× 0.72` above 2.2 megapixels) and upscaled — the field has no hard edges, so nobody can tell.

2. **The field.** A fragment shader. Value noise → 5-octave fbm → two rounds of domain warp (`q` from the fbm, then `r` from `p + 1.7q`, then the final `f` from `p + 1.9r`). That second warp is what makes folds instead of blobs; one round looks like smoke. Then:
   - start at `--bg` (Dusk `#1A1523`, the darkest purple — the whole field bottoms out here);
   - mix toward a fold shadow by `smoothstep(0.30, 0.95, f)`, at full strength on Dusk and `0.42` on Noon so the light theme stays light;
   - Noon only: a warm horizon band, `exp(-((uv.y - 0.52) / 0.09)²)`, in the arc's salmon;
   - lift the top-right toward the arc's violet by `pow(glow, 1.6)` and its salmon by `pow(glow, 1.9)`, where `glow = smoothstep(1.05, 0.05, distance(uv, vec2(0.92, 0.04)))` — this is where the old SVG arc crossed, so the composition does not move;
   - a pale sheen from the second warp's `r.x`, and ±0.016 of hash grain so the gradient never bands.
   Theme values come from uniforms read off the tokens — no hexes in the shader source.

3. **The click.** Up to 8 live ripples, each `{x, y, startTime}` in viewport coordinates. Each is a ring `exp(-((d - age·0.40) / 0.10)²) · exp(-age·1.05)`, faded by distance, gone after about 4 seconds. Where the ring is, offset the sampling point by `wave · 0.075` **and sample each colour channel a step apart** (`×1.22`, `×1.00`, `×0.74`) so the field separates into its components at the moving edge. Everywhere else, one sample. Attach the listener to `window` as `pointerdown`, and fire one from the centre of the focused element on Enter or Space so keyboard users get it too.

4. **Budget.** Pause via `visibilitychange` when the tab is hidden. Stop the loop when no ripple is live and `prefers-reduced-motion` is set — that case renders exactly one frame, at a fixed time, and ignores clicks. Never render more than one canvas: it is mounted once in `SiteFrame`, never per page. Measure a scroll of `/gallery` with paint flashing on and record the frame time in `design/BASELINE.md`.

5. **Fallback.** If `getContext("webgl")` returns null, hide the canvas and put the existing `--ambient, --backdrop` CSS gradients on the element instead. The page must look finished, not broken, with no WebGL at all.

6. **The boards.** The reference boards still show the static arc, so every page board will now differ in the backdrop region. Teach the compare harness to mask it: pass a mask rectangle covering everything outside the content column and panels, or compare only the panel bounding boxes. Say in `design/README.md` which it is, so the next person is not surprised by a 12% diff that is not a bug.

**Do not.** Animate the lamp, the arc colour or anything inside a panel. Add a second canvas. Sample the backdrop in JS for any purpose.

**Done when.** The backdrop drifts continuously at 60fps on a laptop in both themes, a click sends a visible wavefront through the folds, the reduced-motion case renders one static frame, the no-WebGL case renders the CSS gradient, and `npm run audit:design` passes with the backdrop masked.

**Commit.** `UI-P13b: living backdrop`
