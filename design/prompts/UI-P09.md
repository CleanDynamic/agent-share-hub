# UI-P09 — Panels, wall labels, stats and striped bars

Follow `design/RULES.md`.

**Goal.** The containers and the density pieces borrowed from the dashboard reference.

**Read first.** `components/progress/LitBar.tsx` (`value`, `max`, `label`, `valueText`), `src/lib/theme/elevation.ts`, `glass.ts` and `glass.test.ts`.

**Reference.** Section `Panels`; `data-ui="panel"` (`glass`, `flat`), `panel-head`, `wall-label`, `stat`, `detail`, `striped-bar`.

**Build.**
1. **`Panel`** — `variant: "glass" | "flat"`, `padding` (default `16px 18px`; lists use `14px 16px`). Glass: background `--glass`, 1px border `--glass-border`, radius 16, `box-shadow: var(--shadow-card), var(--panel-highlight)`, `overflow: hidden`, **no backdrop-filter**. Flat (compose and import only): background `--flat`, 1px border `--glass-border`, radius 16, no shadow. Keep `glass.test.ts` passing: panels are not blurred surfaces.
2. **`PanelHead`** — title (Figtree 600, 16px default; 13–15px where the reference is smaller), optional subtitle (Figtree 12px `--text2`, 3px below), optional right slot (gap 6px). Title and subtitle stack; the right slot aligns to the top.
3. **`WallLabel`** — `columns` (2, 3 or 4) and cells. Grid with `repeat(n, minmax(0, 1fr))`, gap 1px on a `--hairline` background, radius 12, `overflow: hidden`. Each cell: background `--cell`, padding 12px 14px, column with gap 7px.
4. **`Detail`** — an `Eyebrow` (10px) over a DM Mono 14px value in `--text` (or a passed colour), no wrap, ellipsis.
5. **`Stat`** — an `Eyebrow` (10px), then a baseline row: the value in DM Mono 22px, letter-spacing −0.02em, `--text`; optionally "&nbsp;/ {of}" in DM Mono 12px `--text2`; optionally a `StripedBar` 10px tall.
6. **`StripedBar`** — `value` 0–100, `colour` (token), `height` (8–16, default 12), optional `ticks: {at, colour}[]`. A flex row of full width: the filled part `width: value%` with `background: repeating-linear-gradient(-60deg, <colour> 0 2.5px, transparent 2.5px 6px)`; the rest `flex-grow: 1` with the same pattern in `--bar-base`; each tick absolutely placed at `left: at%`, `top: -4px; bottom: -4px`, 1.5px wide. `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax` and a label. Colours by meaning: `--lit` for progress, XP and goals; `--evidence` for proof and freshness; `--action` for money and bounties; `--cat-agents` for rebuilds. Make `LitBar` render a `StripedBar` in `--lit` so its call sites change look without changing code.

7. **`PageHeading`** (`eyebrow`, `title`, `sub?`, `size`) — the heading block that stands on the backdrop above a phone's panels (`data-ui="page-heading"` on every mobile board except Home and Sign in): a column, gap 8, padding 4px 2px: `Eyebrow`; an `h1` in `type.display(size)` (30 | 32 | 34 | 36 as each page states), −0.035em, line-height 1, `--text`; the sub in Figtree 14px, line-height 1.5, `--text2`. On desktop the same three parts sit inside the page's header panel at that page's sizes, so the component takes a `variant: "bare" | "in-panel"`.

**Done when.** Panels section compares within 0.04 in both themes; `glass.test.ts`, `elevation.test.ts` pass.

**Commit.** `UI-P09: panel, wall label, stat, detail and striped bar`
