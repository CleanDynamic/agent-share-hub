# UI-P10 — Orbs

Follow `design/RULES.md`.

**Goal.** The three orbs. Each shows one real number; none is decoration.

**Read first.** `components/profile-game/LevelRing.tsx` and `AvatarLevelRing.tsx`, `lib/progress/index.ts` (`xpProgressInLevel`, `levelFromXp`).

**Reference.** Section `Orbs`; `data-ui="orb-glass"`, `orb-solid`, `orb-ring`.

**Build.** All circles (`border-radius: 50%`, the only use of `--r-full` besides avatars and dots). Sizes used: 162, 150, 140, 128, 118 (glass and solid); 150, 120, 118, 112 (ring).
1. **`OrbGlass`** (`size`, `label`, optional `sub`): background `--orb-glass`; `box-shadow: inset 0 0 0 1px var(--orb-glass-edge), inset 0 12px 40px rgba(255,255,255,.18), 0 20px 50px rgba(0,0,0,.25)`; a centred column with gap 5px and `padding-bottom: 16%` of the size (the text sits above the glowing ring inside); a static dotted circle 18px (`r=7.5`, stroke `--on-orb-glass` 1.6, `stroke-dasharray: 1.2 3.4`, round caps); the label in Figtree 13px 500 `--on-orb-glass`, centred; the sub-label in DM Mono 10px at opacity .8.
2. **`OrbSolid`** (`size`, `top`, `value`, `bottom`): background `--orb-solid`, `box-shadow: 0 20px 50px rgba(0,0,0,.25)`; a centred column with gap 3px: `top` in Figtree 11px `--on-orb-solid-2`; `value` in DM Mono at `Math.trunc(size * .17)`px, letter-spacing −0.03em, `--on-orb-solid`; `bottom` like `top`.
3. **`OrbRing`** (`size`, `percent`, `value`, `caption`): outer circle `background: conic-gradient(var(--lit) 0 {p}%, var(--ring-track) {p}% 100%)`, padding 9px, `box-shadow: var(--ring-glow)`; inside it a glass orb (as above, without the spinner) with `padding-bottom: 12%`; `value` in Sentient at `Math.trunc(size * .2)`px, −0.03em, line-height 1; `caption` in DM Mono 10px. Give it `role="img"` and a full label ("Level 7, 77% of the way to level 8"). Repaint `LevelRing` to use it.
4. Nothing animates. (A later change may add a slow turn to the dotted circle while a live value updates; not now.)

**Done when.** Orbs section compares within 0.04 in both themes.

**Commit.** `UI-P10: glass, solid and ring orbs`
