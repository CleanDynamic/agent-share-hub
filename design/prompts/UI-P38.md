# UI-P38 — The accessibility pass

Follow `design/RULES.md`.

**Goal.** One pass over everything built, fixing what the reference could not show: names, order, contrast, motion and touch.

**Read first.** `src/lib/theme/contrast.test.ts` and `compliance.test.ts`, every component from UI-P06 to UI-P36.

**Check and fix.**
1. **Names.** Every icon-only control has an `aria-label` that says what it does, not what it looks like ("Activity, 3 unread", "Play the build", "Show the full anatomy", "Theme: Noon"). Every link whose text is only a title has enough context. The lockup's link is "buildgallery home".
2. **Landmarks and order.** One `<h1>` per page (the tagline chips are `aria-hidden`; the sentence is the real `h1`). `<header>`, `<nav aria-label>`, `<main id="main">`, `<footer>` once each. Tab order follows the visual order on every board; nothing focusable is invisible; the skip link is first.
3. **State.** `aria-current="page"` on the current header link, dock tile and breadcrumb leaf. `aria-pressed` on toggles (filters, facets, me too). `role="tablist" / "tab" / "tabpanel"` with `aria-selected` on the build page's tabs and the works tabs, arrow keys moving between them. `aria-live="polite"` for "Copied", "Marked read" and each optimistic result.
4. **Colour and contrast.** Re-run `npm run audit:contrast` and `npm run audit:themes`. No text under 10px anywhere (the reference's 9px mono labels are 10px). Amber (`--lit`) is never text or the only marker of a state: the lamp always sits beside words ("41 reproduced", "last confirmed…"), and read-out amber uses `--lit-ink`. Category hues are never the only signal either — every dot has its name or chip beside it. The gap is dashed **and** labelled.
5. **Focus.** The UI-P04 ring is visible on every interactive element on both themes, including inside the dock, the part viewer's tab strip and over covers; it is never clipped by `overflow: hidden` (add padding or an inset ring where it is).
6. **Motion.** Under `prefers-reduced-motion: reduce`: no scroll-entry animation, no skeleton pulse, no sheet slide (it appears), no hover translation. The lamp, the arc and the grain never animate for anyone.
7. **Touch and input.** Every target ≥44×44 on phones (dock tiles 62×54; checkbox rows 48 tall; chips 36 tall with 8px gaps count as 44 with their padding — verify each one). Every mobile input ≥16px. The sheet's grabber is not the only way to close it.
8. **Screen-reader pass** over Home, Build page and Bounties: the page reads as a sentence, the plaque reads as "41 reproduced, last confirmed working 3 days ago, on sonnet-4.5", and a card reads title first.

**Done when.** `npm run audit:contrast`, `audit:themes` and `audit:glass` pass; an axe run (via `@axe-core/playwright` **only if it is already a dependency**; otherwise a manual pass over the checklist above) reports no serious or critical issues on the ten pages in both themes; every tier1 spec passes.

**Commit.** `UI-P38: accessibility pass`
