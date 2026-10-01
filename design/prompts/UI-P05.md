# UI-P05 — Sentient as the display face

Follow `design/RULES.md`.

**Goal.** Every heading in the overhaul is set in **Sentient** (500). Figtree stays the UI and body face; DM Mono stays the data face. Bodoni Moda is retired.

**Read first.** `index.html` (the Google Fonts link currently loads Bodoni Moda, DM Mono and Figtree), `src/lib/theme/type.ts` (roles and the floors enforced there), `design/reference/fonts/`.

**Do.**
1. Copy `design/reference/fonts/Sentient-Medium.otf` and `Sentient-Bold.otf` to `public/fonts/`. Add two `@font-face` rules to `src/index.css` (`font-family: "Sentient"`, weights 500 and 700, `font-display: swap`) and a `<link rel="preload" as="font" type="font/otf" href="/fonts/Sentient-Medium.otf" crossorigin>` in `index.html`.
2. Remove Bodoni Moda from the Google Fonts URL; keep `DM Mono:wght@400;500` and `Figtree:wght@400..600`.
3. In `type.ts`, add `type.display(px)` returning a complete role for Sentient at that size, with letter-spacing and line-height by size band, exactly as the reference uses them:
   - 52px and up: letter-spacing −0.04em, line-height 0.95
   - 44–51px: −0.035em, line-height 1
   - 30–43px: −0.03em, line-height 1 (−0.035em for page headings on mobile at 30–36px)
   - 20–29px: −0.02em, line-height 1.05
   - 17–19px: −0.02em, line-height 1.05
   - the lockup wordmark: −0.03em, line-height 1, at its own size (16, 18, 19, 21, 34, 64, 70)
   Existing display roles move from Bodoni Moda to Sentient at their current sizes.
4. Replace the floor "Bodoni Moda never under 20px" with "Sentient never under 17px" (card titles on mobile are 17–18px in the reference). Keep "Figtree never under weight 400 below 18px".
5. Add `type.mono(px, { caps })` for DM Mono: eyebrows are uppercase with letter-spacing .09em (10–12px); data values have no extra tracking; large numbers (22px and up) get −0.02em. Add `fontVariantNumeric: "tabular-nums"` wherever digits align in columns.
6. Update the comments in `type.ts` and the theme skill text to say Sentient.

**Do not.** Change the size of any existing heading.

**Done when.** `/dev/kit` headings render in Sentient in both themes; the network panel shows no Bodoni Moda request; type tests pass.

**Commit.** `UI-P05: Sentient replaces Bodoni Moda as the display face`
