# UI-P96 — The trope sweep and the copy fixes

Follow `design/RULES.md`.

**Series rules (UI-P77 to UI-P99).** These hold for every prompt in the series, after `design/RULES.md`.
- **A re-skin.** Routes, data, handlers, copy, accessible names and the order of every page's parts stay as they are. Only the look changes. The one copy change is UI-P96's em-dash sweep.
- **Source of truth.** `design/reference/refined/{dusk,noon}/<board>.html`, 1440 wide, values exact, no browser strip, no mobile boards: `foundations`, `components`, `model-marks`, `home`, `gallery-dashboard`, `build-list`, `build-map`, `activity`, `composer-list`, `composer-map`, `prompt-window`, `composer-card`. Sample text is presentation only. Two things on the boards are placeholders: model marks drawn as a tile with an initial (the site shows the real logo with no tile, UI-P83), and em dashes already shown as "·" (they ship in UI-P96).
- **The switch.** Everything is behind `REFINED_LOOK_ENABLED` in `src/lib/theme/look.ts` (UI-P78), off until UI-P98. `useLook()` returns `"refined" | "current"`; on `/dev/*`, `?look=refined` or `?look=current` decides. Refined token values live in `:root[data-theme="…"][data-look="refined"]`.
- **Forks.** A page is forked, not edited: `Refined<Name>.tsx` beside the view, typed with the view's own props (imported, not copied); the page container and the dev page choose with `useLook()`. Current views go only in UI-P99. Primitives keep their props and branch inside. Under the refined look only, this series amends `design/RULES.md` §3: primitives and the frame may change padding, gap, height and radius to the values given here.
- **Recipes.** *frame*: `--frame`, the header on it with no background or border. *surface*: one panel per page, `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `24px clamp(16px, 4.6vw, 64px) 48px`, the footer inside it. *module*: `--module`, 1px `--module-border`, radius 8, `--module-shadow`, padding 16. *tile*: `--tile`, 1px `--tile-border`, radius 6, padding 12. *well*: `--well`, 1px `--well-border`, `--well-shadow`, radius 6; maps and media add the dot grid `radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px. *control*: `--control`, 1px `--control-border`, `--control-shadow`, radius 6; hover `--control-on`, never opacity; pressed sinks to the well. *primary*: `--action`, `--action-shadow`, `--on-action` 500; one per view, and the header's New build is secondary. *rows*: hairline-separated, min-height 40, 48 or 56. *selected*: `--selected-fill`, 1px `--selected-edge`, plus `--selected-ring` in Noon or `0 8px 20px -10px rgba(0,0,0,.6)` in Dusk; never a colour. *window*: `--window`, 1px `--window-border`, radius 12, `--window-shadow` (dialogs) or `--sheet-shadow` (side sheets), over `--scrim`, no blur. *lamp*: a bar 3px high, radius 1, `--lit`, `--lamp-glow`; never an edge colour. *dimmed*: `filter: var(--dim-filter)`, never opacity.
- **Type and space.** Geist; Geist Mono only for ids, keys and mono pills; tabular numbers. Space 2 4 6 8 12 16 20 24 32 40 48 64 (2 for segmented tracks, 6 for tight inline pairs). Radius 4 tag, 6 control and media, 8 card, 10 surface, 12 window.
- **Never under refined.** Gradients other than the picture light, the shading inside raised objects in Dusk and flat chart areas; glass, blur or grain; any glow but the lamp's; serif or italic; coloured card edges; icons inside labelled buttons; fade-in on scroll; hover fades; em dashes in shown copy; emoji.

**Goal.** Nothing on the trope list survives, and a test keeps it that way.

**The trope list.** None of these may appear under the refined look:
1. Purple-to-blue gradient. 2. Gradient text. 3. Emoji in headings. 4. Inter, or any font but Geist and Geist Mono. 5. Coloured-border cards (the only edges are hairlines, the neutral selected edge and dashed suggestions). 6. Glass, blur or translucency over content. 7. Low-contrast text (4.5:1 minimum). 8. Three icon boxes in a row. 9. A badge above the headline. 10. Lucide everywhere (glyphs, UI-P82). 11. Untouched shadcn defaults. 12. Fade-in on scroll. 13. Cursor-following light. 14. Buttons that fade on hover. 15. Spacing off the scale. 16. Em dashes in shown copy. 17. Buzzword copy. 18. Serif or italic accents. 19. Space Grotesk or Instrument Serif. 20. Grain over a gradient.

**Build.**
1. **Em dashes in shown copy.** These copy changes ship in **both** looks (they are copy, not look):
   - page titles `"X — buildgallery"` → `"X · buildgallery"` (every `SeoHead` and `document.title`);
   - joins inside a line → ` · ` — the visitors' book subtitle becomes "Builds, rebuilds, reproduction notes and asks · newest first" (`HomeView.tsx`), the repro-note line joins its quote with ` · ` (`homeModel.ts`), `composeModel.ts` "not saved · ";
   - sentences → a full stop, words unchanged otherwise: "Please verify your email before signing in. Check your inbox.", "That email is already registered. Try signing in instead.", `Taken. Try "${suggestion}"`;
   - a lone "—" meaning "no value" in a table cell → "–" (en dash) in `--label`;
   - find the rest with `rg "—" src --glob "*.tsx" --glob "*.ts"` outside comments and tests, and list every change in the report. Update tests that assert the old strings.
2. **`src/lib/theme/refinedTropes.test.ts`** reads every `Refined*.tsx` and the files UI-P84 to UI-P87 and UI-P95 changed, and fails on: `backdrop-filter`, `background-clip: text` / `WebkitBackgroundClip`, `fontStyle: "italic"`, a font name other than the `--font-*` tokens, `linear-gradient` outside the allowed list (framed work, map box, picture light, chart area), a hex or rgba outside the named artwork constants, `opacity` inside a hover handler, an em dash in a JSX text node or string literal, an emoji, a `gap`/`padding`/`margin` px value not on the series spacing scale.
3. **One primary per view**: a test renders each refined view with its dev fixture and counts elements styled with `--action` as background: at most one.
4. **No icon in a labelled button**: the same render asserts no `svg` inside a `button` or `a` that has text content, except `MenuButton`'s chevron and the disclosure chevron.
5. Run `e2e/audit/contrast-sweep.spec.ts` and `theme-completeness.spec.ts` with `look=refined` on every refined dev page and fix what they find.

**Done when.** The new tests pass; the contrast sweep is clean under refined; the report lists every copy change.

**Commit.** `UI-P96: em dashes out of shown copy; the refined trope tests`
