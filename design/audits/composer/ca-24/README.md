# CA-24 screens

Dusk and Noon, at 1440 and 390 (`npm run audit -- composer-ca24-shots`; the dev page is `/dev/kit/pages/sandbox?build=ca24&show=<what>`).

- `first-load-1-building`, `first-load-2-wave`, `first-load-3-arriving`: the first load with every animation paused (`document.getAnimations()`, then `currentTime`): rows part-way up, the wave mid-page, and halfway through the blocks fading out and the content fading in.
- `details-loading`, `details-failed` (the build working beside it), `empty-build`.
- `slow-import-6-of-18`: the whole page, from the head with its Importing tag to the bar. The page itself feeds no count (the import is one write); the dev page does, to show the row.

First-load frame rate (headless Chromium, no GPU, 1440 wide): 59.3 to 60.0 fps, 416 animated layers for 1,622 cells (`e2e/audit/out/ca24-frame-rate.json`).
