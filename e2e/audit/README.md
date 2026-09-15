# The audit sweeps

Two browser sweeps that measure what the product actually renders, in both
rooms, across the routes a reader visits. They exist because a token is not a
pairing: `src/lib/theme/contrast.test.ts` proves the *contract* still holds
against the values in `semantics.ts`, and these prove the *pages* do.

Re-run them after any visual change. A repaint that clears every token floor
and still puts secondary ink on a surface token is invisible to a unit test and
obvious to these.

## Running

```bash
npm run audit            # both sweeps
npm run audit:contrast   # the contrast sweep only
npm run audit:themes     # the both-theme completeness assertion only
```

Each starts a Vite dev server if one is not already listening on `5173`
(`E2E_PORT` / `E2E_BASE_URL` override it). In a sandbox that ships its own
Chromium, point at it:

```bash
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run audit
```

Reports land in `e2e/audit/out/` (gitignored):

| file | what it holds |
|---|---|
| `contrast-all.csv` | every distinct pairing measured, pass and fail |
| `contrast-failures.csv` | just the failures |
| `contrast-notes.csv` | hairlines, and pairs over an image or a gradient |
| `contrast-summary.txt` | coverage, counts, and the failures as prose |
| `theme-leaks.csv` | colours belonging to the other room |
| `theme-completeness.txt` | the same, as prose |

## What the contrast sweep does

For every route in `support/harness.ts`, in Exhibition and in Dusk:

1. **Text.** Every text node's rendered `color`, at its effective opacity,
   composited over the ground its ancestors actually produce — each background
   layer multiplied by that layer's own opacity chain, stacked in paint order.
   Floor 4.5:1. Large text is measured at the same floor and marked `large-text`
   in the report so `critique-typography` can tell 13px from 24px.
2. **Borders.** Any visible border, measured against both adjacent grounds and
   scored on the better of the two. Failed only when the border **carries
   state** — it is painted in a state token, it is the boundary of a checkbox,
   switch or radio, it marks an error, or it is a ≥1.5px boundary on a control.
   Everything else is a **hairline**: reported, never failed. `--line` is
   1.2:1 on the Exhibition ground *by design* — the spec names it "hairlines,
   chip borders" and floors it nowhere, because a separator is not a control
   boundary.
3. **Control fills.** A checkbox, switch or radio with no label of its own is
   identified by its shape, so its fill is floored at 3.0:1 against the ground.
   A control carrying its own text is identified by the text, so its fill is
   reported and not failed.
4. **Focus rings.** Forty controls per route, focused for real — one `Tab` sets
   Chromium's keyboard modality, and two frames are waited out after each
   `focus()` because `controls.ts` draws the ring from React state and a style
   read in the same task measures the control before its ring exists. Floor
   3.0:1 against the ground the offset band exposes. `outline-style: auto` is
   recorded as `ua-default` rather than measured: Chromium paints its own
   two-colour ring there, so a single ratio would describe nothing — but it is
   still counted, because it marks a control the system's own ring never
   reached.

Pairs with an image or a gradient under them are reported as `image-beneath`
with the composite they would have had, and never failed. A gradient has no one
ratio, and inventing one is the eye-repainting the whole discipline forbids.

Rows are deduplicated by route, theme, selector, pair and type size, with a
count — a page that puts `--text2` on `--glass` two hundred times is one row and
a 200.

## What the completeness sweep does

Collects every colour each page paints in each room and fails on any value that
belongs to the **other** room's token block and to no token in the room it is
painted in. That is the classic two-theme failure — a surface written with a
value instead of a token looks right in one room and wrong in the other — and
the asymmetric rule catches it with no false positives against `color-mix()`
and `tokenAlpha()`, which resolve to values that are in no token block by
design.

The file's first test plants Dusk's salmon on an Exhibition page and requires
the sweep to find it, so a green run is a measurement rather than a tautology.

## The network

Nothing reaches it. `support/harness.ts` intercepts PostgREST, auth, storage,
the realtime socket and the font CDN, and serves its own rows: nine builds, one
per part category so all nine hues render, a build with an open gap, a legacy
content item, notifications, a thread, a collection and a library. A signed-in
session is injected into `localStorage` for the routes behind `ProtectedRoute`.

This repo has one `.env` and nothing in the tree says the project it names is a
dev project, so the sweep reads no project and writes to none — the same trade
`e2e/tier2/support/supabaseStub.ts` documents, for the same reason.

## What is exempt, and why

Three classes are measured, recorded and never failed. Each is a rule, not a
shrug:

- **Hairlines.** `--line` is 1.2:1 on the Exhibition ground by design.
- **Inactive components.** WCAG 1.4.3 excludes text that is part of an inactive
  control and 1.4.11 excludes its boundary. The 50% wash this kit puts on a
  disabled control works *because* it is harder to see. The numbers are still
  in `contrast-notes.csv`.
- **A control already identified.** 1.4.11 floors the visual information
  *required* to identify a component. A switch with a label, or one whose
  boundary already clears 3.0:1, does not also need its fill to — otherwise no
  inset control could sit on a surface one step from it, which is what
  `--recess` is for.

## Accepting a survivor

A failure that is genuinely correct goes in `SURVIVORS` in
`contrast-sweep.spec.ts` (or `EXEMPT` in `theme-completeness.spec.ts`) with the
reason it stands. Both lists are ratchets: they may only shrink. A survivor with
no justification is not a survivor, it is an unfixed failure.
