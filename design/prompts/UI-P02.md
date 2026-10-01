# UI-P02 — Rename the light theme: Exhibition → Noon

Follow `design/RULES.md`.

**Goal.** The two themes are **Noon** (light) and **Dusk** (dark). "Exhibition" disappears from the code, the UI and the docs. Values do not change yet (UI-P03 does that).

**Read first.** `src/lib/theme/semantics.ts` (`ThemeName = "exhibition" | "dusk"`), `src/contexts/ThemeContext.tsx` (`ThemeChoice = "exhibition" | "dusk" | "system"`, storage key `bg-theme`, the resolve step), the theme boot script in `index.html` (kept in sync with the context), `src/index.css` (`:root, :root[data-theme="exhibition"]` and `:root[data-theme="dusk"]`), `src/components/theme/ThemeToggle.tsx`, and every test that names a theme (`grep -rn "exhibition" src e2e index.html`).

**Do.**
1. `ThemeName` becomes `"noon" | "dusk"` and `ThemeChoice` becomes `"noon" | "dusk" | "system"`. Rename every object key, map entry and test fixture that uses `exhibition`.
2. `index.css`: `:root, :root[data-theme="exhibition"]` becomes `:root, :root[data-theme="noon"]`. Noon stays the default for a visitor with no stored preference.
3. **Migration, in both the boot script and `ThemeContext`:** a stored value of `"exhibition"` is read as `"noon"` and written back as `"noon"`. Add a unit test for it.
4. Every visible label reads **Noon · Dusk · System** (the ThemeToggle, any menu, aria-labels such as "Theme: Noon").
5. Update comments and docs that say Exhibition (`src/lib/theme/*`, any `docs/` or `README`), and note at the top of `semantics.ts` that Noon was called Exhibition before UI-P02.

**Do not.** Change any colour value. Change the storage key.

**Done when.** `grep -rni "exhibition" src e2e index.html` returns nothing except the migration line and its test. All theme tests, `css-parity` included, pass.

**Commit.** `UI-P02: rename the Exhibition theme to Noon`
