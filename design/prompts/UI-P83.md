# UI-P83 — Model marks with Lobe Icons, background-less

Follow `design/RULES.md`.

**Series rules (UI-P77 to UI-P99).** These hold for every prompt in the series, after `design/RULES.md`.
- **A re-skin.** Routes, data, handlers, copy, accessible names and the order of every page's parts stay as they are. Only the look changes. The one copy change is UI-P96's em-dash sweep.
- **Source of truth.** `design/reference/refined/{dusk,noon}/<board>.html`, 1440 wide, values exact, no browser strip, no mobile boards: `foundations`, `components`, `model-marks`, `home`, `gallery-dashboard`, `build-list`, `build-map`, `activity`, `composer-list`, `composer-map`, `prompt-window`, `composer-card`. Sample text is presentation only. Two things on the boards are placeholders: model marks drawn as a tile with an initial (the site shows the real logo with no tile, UI-P83), and em dashes already shown as "·" (they ship in UI-P96).
- **The switch.** Everything is behind `REFINED_LOOK_ENABLED` in `src/lib/theme/look.ts` (UI-P78), off until UI-P98. `useLook()` returns `"refined" | "current"`; on `/dev/*`, `?look=refined` or `?look=current` decides. Refined token values live in `:root[data-theme="…"][data-look="refined"]`.
- **Forks.** A page is forked, not edited: `Refined<Name>.tsx` beside the view, typed with the view's own props (imported, not copied); the page container and the dev page choose with `useLook()`. Current views go only in UI-P99. Primitives keep their props and branch inside. Under the refined look only, this series amends `design/RULES.md` §3: primitives and the frame may change padding, gap, height and radius to the values given here.
- **Recipes.** *frame*: `--frame`, the header on it with no background or border. *surface*: one panel per page, `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `24px clamp(16px, 4.6vw, 64px) 48px`, the footer inside it. *module*: `--module`, 1px `--module-border`, radius 8, `--module-shadow`, padding 16. *tile*: `--tile`, 1px `--tile-border`, radius 6, padding 12. *well*: `--well`, 1px `--well-border`, `--well-shadow`, radius 6; maps and media add the dot grid `radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px. *control*: `--control`, 1px `--control-border`, `--control-shadow`, radius 6; hover `--control-on`, never opacity; pressed sinks to the well. *primary*: `--action`, `--action-shadow`, `--on-action` 500; one per view, and the header's New build is secondary. *rows*: hairline-separated, min-height 40, 48 or 56. *selected*: `--selected-fill`, 1px `--selected-edge`, plus `--selected-ring` in Noon or `0 8px 20px -10px rgba(0,0,0,.6)` in Dusk; never a colour. *window*: `--window`, 1px `--window-border`, radius 12, `--window-shadow` (dialogs) or `--sheet-shadow` (side sheets), over `--scrim`, no blur. *lamp*: a bar 3px high, radius 1, `--lit`, `--lamp-glow`; never an edge colour. *dimmed*: `filter: var(--dim-filter)`, never opacity.
- **Type and space.** Geist; Geist Mono only for ids, keys and mono pills; tabular numbers. Space 2 4 6 8 12 16 20 24 32 40 48 64 (2 for segmented tracks, 6 for tight inline pairs). Radius 4 tag, 6 control and media, 8 card, 10 surface, 12 window.
- **Never under refined.** Gradients other than the picture light, the shading inside raised objects in Dusk and flat chart areas; glass, blur or grain; any glow but the lamp's; serif or italic; coloured card edges; icons inside labelled buttons; fade-in on scroll; hover fades; em dashes in shown copy; emoji.

**Goal.** Every model, lab and AI tool the site names gets its real logo beside the name: the logo alone, no tile, no background, no border.

**This prompt amends `design/RULES.md` §3: it installs one dependency,** `@lobehub/icons-static-svg@^1.95` (MIT; static SVG files, no runtime dependencies). Do **not** install `@lobehub/icons`: it needs React 19, antd 6 and `@lobehub/ui`, and this site is React 18.

**Build.**
1. `npm install @lobehub/icons-static-svg@^1.95`. Check that `package-lock.json` gains only that package.
2. `src/lib/models/marks.ts` (pure, tested) — `markFor({ tool, model, lab }): MarkKey | null`:
   - **tool first** (session tools, `CONNECTOR_TOOLS` in `src/lib/connect/connector.ts`, and any tool name in session data): Claude → `claude-color`, Claude Code → `claudecode-color`, ChatGPT → `openai`, Cursor → `cursor`, Gemini → `gemini-color`, Grok → `grok`, Vercel → `vercel`;
   - **then model**, through `normaliseModel()` in `src/lib/models/registry.ts` (so aliases resolve): lab Anthropic → `claude-color`, OpenAI → `openai`, Google → `gemini-color`, xAI → `grok`, DeepSeek → `deepseek-color`;
   - **then lab** (the Gallery's Labs list): Anthropic → `anthropic`, OpenAI → `openai`, Google → `google-color`, xAI → `xai`, DeepSeek → `deepseek-color`;
   - Gmail → the `mail` glyph; anything else → `null`.
   Tests cover each row, an alias (e.g. `claude-sonnet-4.5` style spellings already in `registry.test.ts`), case and whitespace, and the null case.
3. `src/components/brand/ModelMark.tsx` — props `tool?`, `model?`, `lab?`, `size: 14 | 16 | 18 | 20 | 24 | 28`. Import each of the 12 SVGs as a URL (`import claudeColor from "@lobehub/icons-static-svg/icons/claude-color.svg"`) so only those files ship. Rendering:
   - keys ending `-color` → `<img src alt="" width height aria-hidden="true" draggable={false}>`, unaltered;
   - mono keys → `<span aria-hidden="true">` sized `size`×`size`, `background-color: currentColor`, `mask-image` and `-webkit-mask-image: url(<file>)`, `mask-size: contain`, no repeat, centred, `color: t.text` unless the parent sets one;
   - `mail` → `<Glyph name="mail">`; `null` → render nothing (the name stands alone).
   - **No tile, no padding, no border, no background, no radius, no shadow.** `flex-shrink: 0`, `display: inline-block`, `vertical-align: middle`, `data-mark={key}`.
4. `ModelTag` (a quiet tag with a 14px mark, gap 6, padding `0 8px 0 6px`, height 22, `--tag-fill`, `--on-tag` 11.5) and `ModelChip` (a control, height 32, padding `0 12px 0 8px`, 20px mark, gap 8; pressed = selected recipe) in `src/components/brand/`.
5. `/dev/kit/components` gains a **Model marks** section built like the `model-marks` board: every lab at 14, 16, 20, 24 and 28 with the models it names, the tool rows, tags and chips. The board draws tiles with initials: build the marks alone, without the tile (expected difference).
6. `THIRD_PARTY_NOTICES.md` at the repo root (create it if there is none): Lobe Icons, MIT, with the copyright line from its licence, and the note "Logos are trademarks of their owners; shown to name the tool a build was made with." Add Geist (OFL 1.1) there too.

**Do not.** Recolour, crop, outline or redraw a mark; put one on a filled square; make one larger than 28px; place marks in pages (the page prompts do).

**Done when.** `markFor` tests pass; the Model marks section shows the real marks with no background in both themes; `npm run build` shows only the 12 files added to the bundle.

**Commit.** `UI-P83: model marks from Lobe Icons static SVGs, no background`
