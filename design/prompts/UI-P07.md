# UI-P07 — Controls

Follow `design/RULES.md`.

**Goal.** The control set every page uses, in `src/components/brand/`, shown in the **Controls** section of `/dev/kit/components`. Existing controls in `src/lib/theme/controls.ts` are the starting point; extend or add, but keep existing call sites working.

**Reference.** Section `Controls`; `data-ui="button"` (with `data-variant`), `icon-button`, `segmented`, `tabs`, `filter-chip`, `category-chip`, `eyebrow`, `avatar`.

**Build.** All radii from the radius scale; all colours via `t`.
1. **`Button`** — `variant: "primary" | "secondary" | "ghost"`, `size` (height: 28 | 30 | 32 | 34 | 36 | 38 | 42 | 44 | 46 | 48), `fontSize` (11–15), optional `icon`, optional `fullWidth`. Padding 0 14px at every size; radius 12; gap 7px; icon 15px, stroke 1.8; no wrap. Weight 600 (primary) or 500. The reference states size and font size for every instance; the pairs used are 28/11, 30/12, 32/12, 34/12, 36/13, 38/13, 42/14, 44/13, 46/15, 48/14 and 48/15. Defaults: 36/13. `fullWidth` makes it `display: flex; width: 100%` (the mobile 48px buttons).
   - primary: background `--action`, text `--on-action`, 1px border `--action`;
   - secondary: background `--glass-2`, text `--text`, 1px border `--line`;
   - ghost: transparent, text `--text2`, transparent border.
   Only one primary per page body (the header's New build is chrome and does not count).
2. **`IconButton`** — `size: 30 | 34 | 38`, required `label` (becomes `aria-label`). Square, radius 12, background `--glass-2`, 1px border `--line`, icon colour `--text2`, icon 16px stroke 1.6.
3. **`Segmented`** — `items`, `value`, `onChange`, `size: 30 | 32 | 34 | 36 | 38`. Track: inline-flex, gap 2px, padding 4px, radius 12, background `--glass-2`, 1px border `--line`. Items: height = size − 8, padding 0 12px, radius 8, Figtree at `fontSize` 11 | 12 | 13 (default 12; each reference instance states its own — e.g. 30/11 for panel filters, 32/11 in the footer, 36/12 for the gallery lenses, 36/13 on mobile); current: background `--text`, text `--on-text`, weight 600; others transparent, `--text2`, weight 500. Buttons with `aria-pressed`; the group has an accessible name.
4. **`UnderlineTabs`** — font size 12 | 13 | 14 (default 14). Row: flex, gap 24px, aligned to the bottom, 1px bottom border `--line`. Current: Figtree 600 `--text`, padding-bottom 10px, 2px bottom border `--action`. Others: `--text2`, padding-bottom 12px. `role="tablist"` / `role="tab"` / `aria-selected`.
5. **`FilterChip`** (mobile sideways rows) — height 36, padding 0 12px, radius 10, Figtree 13px 500, optional count (DM Mono 10px, opacity .7, gap 7px). On: background `--text`, text `--on-text`, border `--text`. Off: background `--glass-2`, text `--text`, border `--line`.
6. **`CategoryChip`** — repaint `components/brand/CategoryChip.tsx` without changing its props: 1px border `--line`, text `--cat-<category>`, DM Mono 10px, padding 2px 6px, radius 8, no wrap, no fill.
7. **`Eyebrow`** — DM Mono 11px (10px inside wall labels and panels), uppercase, letter-spacing .09em, colour `--label`, no wrap.
8. **`Avatar`** — circle; sizes 18–110; background one of `#5C5480 #3F7A8C #9A5B4A #4B3F8C #3E6B55 #8C4A6A` chosen by a stable hash of the user id (fixtures pass `avatar_hue`); initials in Figtree 600 at `Math.trunc(size * .38)`px, colour `#F7F8F9`. A profile image, when there is one, fills the circle instead.

**Do not.** Change existing button call sites in live pages (they move when their page is rebuilt).

**Done when.** Controls section compares within 0.04 in both themes; every control is reachable and operable with the keyboard on `/dev/kit/components`.

**Commit.** `UI-P07: controls — button, icon button, segmented, tabs, chips, eyebrow, avatar`
