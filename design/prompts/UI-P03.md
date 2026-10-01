# UI-P03 — Noon (Birch Mist) values and the new tokens

Follow `design/RULES.md`.

**Goal.** Every token in `design/tokens/tokens.css` exists in the code with exactly those values, in both themes, through the existing two-tier system (`primitives.ts` → `semantics.ts` → `index.css` → `tokens.ts`).

**Read first.** `design/tokens/tokens.css`, `design/tokens/token-map.md`, `src/lib/theme/primitives.ts`, `semantics.ts`, `tokens.ts`, the `:root` blocks in `src/index.css`, and the tests `css-parity.test.ts`, `contrast.test.ts`, `compliance.test.ts`, `glass.test.ts`.

**Do.**
1. For each row in `token-map.md`: if the token already exists (`--text`, `--text2`, `--line`, `--recess`, `--glass`, `--glass-2`, `--glass-border`, `--action`, `--on-action`, `--evidence`, `--evidence-fill`, `--lit`, `--on-lit`, `--cat-*`, `--bg`), set its Noon and Dusk values to the kit's. If it does not, add it: to `TOKEN_NAMES`, to both theme objects in `semantics.ts` (the `Record<TokenName, …>` type will force both), to every theme block in `index.css`, and to `t` in `tokens.ts` with the mechanical camel-case name (`--on-evidence-fill` → `t.onEvidenceFill`, `--arc-1` → `t.arc1`, `--shadow-card` → `t.shadowCard`).
2. Gradients (`--backdrop`, `--ambient`, `--orb-glass`, `--orb-solid`) and shadows (`--shadow-float`, `--shadow-card`, `--panel-highlight`, `--lamp-glow`, `--picture-lamp-glow`) are tokens too. Store them as strings in the same system.
3. Values without a hex primitive (rgba, gradients) may live directly in `semantics.ts`; hexes go through `primitives.ts` as the file's header requires. Add only the primitive steps a token consumes.
4. The `tokens.css` file includes a `[data-theme="system"]` block for completeness. `ThemeContext` already resolves `system` to `noon` or `dusk` before setting the attribute, so do not add that block.
5. Existing tokens the kit does not mention (`--porthole`, `--chrome-hi`, `--chrome-lo`, `--glass-hi`, `--card-frame`, `--card-thread`, …) keep their current values for now. UI-P14 and UI-P41 deal with them.
6. Update `contrast.test.ts` to the new measured pairs. Measured on the flattened glass surface (the kit's values): Noon text/glass 15.24, text2/glass 6.78, action/glass 7.12, on-action/action 7.07, evidence/glass 6.37, on-evidence-fill/evidence-fill 11.86, every category hue on glass ≥ 5.72; Dusk text/glass 14.26, text2/glass 7.69, label/glass 6.60, action/glass 6.37, on-action/action 6.35, evidence/glass 8.24, on-evidence-fill/evidence-fill 6.01, every category hue on glass ≥ 5.78. `--lit` on either ground is below 3:1 — it is light, never text or a state border; keep or add the test that asserts that.

**Do not.** Change any component. Rename existing tokens (only add and re-value).

**Done when.** `css-parity` passes with the new names in every block; contrast and compliance tests pass; `/dev/kit` shows the new colours on the existing controls in both themes.

**Commit.** `UI-P03: Noon (Birch Mist) values and overhaul tokens`
