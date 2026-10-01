# UI-P04 — The focus ring on Noon

Follow `design/RULES.md`.

**Goal.** Keyboard focus is visible on both themes. Today the ring is 2px `--lit` with a 2px offset in both themes; lamp gold measures under 2:1 on Noon's ground, below the 3:1 floor for UI state.

**Read first.** `src/lib/theme/focus.ts` (and its comment, which claims the offset makes amber legal on the light ground — it does not on Noon).

**Do.**
1. `--focus-ring` already exists from UI-P03 (Noon `#1A2320`, the ink; Dusk `#D9A441`, the lamp). If UI-P03 skipped it, add it now through the same tiers.
2. `focus.ts` uses `--focus-ring` for the outline colour. Width 2px and offset 2px are unchanged; the outline stays an `outline`, not a `box-shadow`.
3. Rewrite the comment: the ring is ink on Noon (13:1 against the ground) and lamp gold on Dusk (7.5:1), because a focus ring is UI state (floor 3:1) and gold does not reach that on Noon.
4. Add a contrast assertion for `--focus-ring` against `--bg` in both themes (≥ 3:1).

**Done when.** Tabbing through `/dev/kit` shows an ink ring on Noon and a gold ring on Dusk; tests pass.

**Commit.** `UI-P04: focus ring uses ink on Noon`
