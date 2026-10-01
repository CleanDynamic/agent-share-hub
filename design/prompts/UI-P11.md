# UI-P11 — Tagline, hero plate and part viewer

Follow `design/RULES.md`.

**Goal.** The three large composition pieces used by Home, Gallery, Build page, Profile and Sign in.

**Reference.** Section `Tagline` of the catalogue (`data-ui="tagline"`); the hero plate on `design/reference/desktop/*/build.html` and the featured build on `…/gallery.html`; the part viewer on `…/build.html` (the panel whose strip reads "PART 01").

**Build.**
1. **`Tagline`** (`lines: [string, string, string]`, `size`, `offsets: [number, number, number]`). A column of three chips aligned left. Each chip: background `--tagline-chip`, text `--on-tagline-chip`, `type.display(size)` (−0.03em, line-height 1), padding `trunc(size*.22)px trunc(size*.32)px trunc(size*.26)px`, `margin-left: offset`, no wrap. Radii: line 1 `14px 14px 0 14px`, line 2 `0 14px 14px 14px`, line 3 `14px`. Line 2 ends with a `Mark` at `trunc(size*.6)`px (body `--on-tagline-chip`, lamp `--tagline-lamp`) after a gap of `trunc(size*.25)`px. Sizes and offsets used: desktop Home 46 → 0 / 90 / 30; mobile Home 30 → 0 / 44 / 14; desktop Sign in 40 → 0 / 70 / 24; mobile Sign in 26 → 0 / 40 / 12. For screen readers the whole thing is one heading with the sentence as its text ("Every AI build, hung with its proof."); the chips are `aria-hidden`.
2. **`HeroPlate`** — two variants.
   - `featured` (Gallery): a `PictureLamp` above a row that fills the remaining height, radius 16, 1px border `--glass-border`, `--shadow-card`, `overflow: hidden`: the cover (flex 1.2) and an inverse panel (flex 1; background `--inverse`, text `--on-inverse`, padding 18px 20px, space-between column). Top line: "MOST REPRODUCED THIS MONTH" in DM Mono 10px, .08em, `--on-inverse-2`, with an 18px `Mark` on the right. Bottom: the title in `type.display(32)`; the outcome in Figtree 12px, line-height 1.45, `--on-inverse-2`; the plaque on the inverse ground: the tag in `--inverse-evidence-fill` / `--on-inverse-evidence-fill` (DM Mono 10px, padding 2px 6px, radius 8), the lamp dot 10×7, then "{when}, on {model}" in Figtree 11px `--on-inverse` — give `Plaque` a `tone="inverse"` prop for this. The rank square sits at `left: 20px; bottom: -14px`: 84×84, radius 14, `--inverse` with `--on-inverse`, `box-shadow: var(--shadow-square)`: "NO." (DM Mono 9px → 10px, .1em, opacity .7) over the rank in `type.display(40)` with −0.04em.
   - `build` (Build page): see UI-P29 for placement; this prompt builds the plate only — absolutely placed 16px from left, right and bottom; padding 18px 20px 18px 120px; radius 16; background `--plate`; 1px border `--header-border`; `backdrop-filter: blur(16px) saturate(1.15)`; h1 in `type.display(44)`; outcome Figtree 13px, line-height 1.45, `--text2`, max-width 560px, 8px above; credit row Figtree 12px `--text2`, 10px above, gap 14px, ending with the Δ line in DM Mono 11px. The 88×88 mark square (radius 14, `--inverse`, a 50px `Mark` in `--on-inverse`, `box-shadow: var(--shadow-square)`) sits at `left: 30px; bottom: 30px`. This plate is one of only three blurred surfaces on a page (with the header and, on phones, the dock).
3. **`PartViewer`** — radius 16, background `--solid`, 1px border `--glass-border`, `--shadow-card`, column:
   - a 46px strip: a 96px block in `--viewer-block` (radius `0 0 14px 0`) holding "PART 01" in DM Mono 11px, .08em, `--text2`, 16px from the left; then the raised tab (grow, margin `7px 0 0 7px`, background `--tab`, 1px `--header-border` border without the bottom edge, radius `12px 0 0 0`, padding-left 12px, gap 8px): a `CategoryChip`, then "01 · System prompt" in Figtree 12px 600;
   - the page's `UnderlineTabs` at 12px, padding `10px 14px 0`;
   - the body, padding 12px 16px, gap 10px: a row with `Segmented` Run / Understand (size 30) and a secondary 30px **Copy** button with the copy icon; the layer blurb in Figtree 11px `--text2`; the content in Figtree 14px, line-height 1.65, `--text`.
   No window dots, no close button: this is a frame for one part, not a browser.

**Done when.** Tagline section compares within 0.04; the plate and viewer are on `/dev/kit/components` in a new "Compositions" section and match the Build and Gallery boards by eye (they are compared as part of UI-P28 and UI-P29).

**Commit.** `UI-P11: tagline, hero plate and part viewer`
