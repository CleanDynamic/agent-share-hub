# UI-P08 — The lamp and the plaque

Follow `design/RULES.md`.

**Goal.** The proof primitives: the lamp dot, the picture lamp above a card, and the plaque — driven by `plaqueState()` (`healthy | stale | unreproduced`) as `RULES.md §5` describes.

**Read first.** `components/brand/Plaque.tsx` (`Plaque`, `PlaqueLamp`, `plaqueState`, sizes `card | header | row`, `NEVER_CONFIRMED`), `lib/build/signals.ts` (`freshnessLabel`, `isStale`, `STALE_AFTER_DAYS`).

**Reference.** Section `Proof`; `data-ui="lamp-dot"` (`on`, `dim`), `picture-lamp` (`on`, `dim`, `off`), `plaque` (`fresh`, `stale`, `never`).

**Build.**
1. **`LampDot`** (`width` × `height`, default 10×7; also 12×8, 20×12, 22×14): an ellipse (`border-radius: 50%`) in `--lit`, opacity 1 when healthy and .45 when stale, `box-shadow: var(--lamp-glow)` when healthy (none on Noon by token). Repaint `PlaqueLamp` to this.
2. **`PictureLamp`** (`state`): an 18px-tall centred row.
   - lamp: a 30×8 ellipse in `--lit`, margin-top 3px, opacity 1 / .45, `box-shadow: var(--picture-lamp-glow)` when healthy;
   - wash: absolutely positioned at `left: 50%; top: 10px; width: 220px; height: 110px; margin-left: -110px`, `background: radial-gradient(ellipse 50% 60% at 50% 0%, var(--picture-lamp-wash) 0%, transparent 100%)`, opacity .45 when stale, `pointer-events: none`;
   - `unreproduced`: an empty 18px spacer, so cards in a row stay aligned.
3. **`Plaque`** — same props and states, repainted:
   - container: flex, wrap, align centre, gap 7px;
   - tag: background `--evidence-fill`, text `--on-evidence-fill`, DM Mono (10px at size `card`, 11px at `row`, 13px at `header`), padding 2px 6px, radius 8, no wrap — "**N reproduced**";
   - freshness: flex, gap 5px, Figtree (10px card, 11px row, 12px header), `--text` (healthy) or `--text2` (stale), a `LampDot`, then the text. Sizes `card` and `row` use the short form "3 days ago, on sonnet-4.5"; `header` uses `freshnessLabel()` in full ("last confirmed working 3 days ago, on sonnet-4.5"). The text may wrap;
   - unreproduced: Figtree at the same size in `--text2`: "not yet reproduced".

**Done when.** Proof section compares within 0.04; unit tests cover the three states for all three components.

**Commit.** `UI-P08: lamp dot, picture lamp and plaque`
