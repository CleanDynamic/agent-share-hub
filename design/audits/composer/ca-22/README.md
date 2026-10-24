# CA-22 · motion across the build page

Made against `/dev/kit/pages/sandbox?build=ca22` (`src/dev/fixtures/ca22.ts`, shown by `src/pages/dev/MotionDemo.tsx`: an in-memory build
with its own history and a bar of buttons that make each change; `&bar=0` hides it, `&bar=hide` keeps it out of sight, `&tiles=300`
adds a long session). Scripts: `scripts/ca22-rest.mjs <before|after>`, `scripts/ca22-diff.py`, `scripts/ca22-screens.mjs`,
`scripts/ca22-measure.mjs` (a running `npx vite`; `PW_CHROMIUM_PATH` points at a Chromium).

- `before/`, `after/`: the build page at rest, 1440 and 390, Dusk and Noon. `before/` was taken on main with only the fixture and the dev page
  added; `after/` on this branch. Difference: 0.0000% of pixels in all four.
- `<moment>-dusk-1440.png`: each moment stopped in the middle (the page's clock is the script's; every animation is paused at the point it
  had reached). 20 moments: remove a tile, undo the removal, remove a session, clear the build, undo clearing, merge, add a tile,
  duplicate, split, add a part, undo and redo, move to part, send together, fold, unfold, convert, the selection bar, Details, Go to it,
  List to Map.
