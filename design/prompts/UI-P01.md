# UI-P01 — The verbatim check: a compare harness and dev compare pages

Follow `design/RULES.md`.

**Goal.** A repeatable way to check "does the app look exactly like the mockup?": a Playwright audit that screenshots a reference board and the matching dev page at the same size and diffs them, plus the dev pages it points at.

**Read first.** `playwright.config.ts`, `playwright.audit.config.ts` and the existing audit specs it runs (`audit:contrast`, `audit:themes`, `audit:glass`), `src/App.tsx` (how `/dev/kit` is registered: `import.meta.env.DEV` + `lazy`), `src/pages/dev/Kit.tsx`, `src/contexts/ThemeContext.tsx`, `design/reference/index.json`, `design/fixtures/sample-data.json`.

**Build.**
1. **Fixture loader** `src/dev/designFixtures.ts` (dev-only): imports `design/fixtures/sample-data.json` (enable `resolveJsonModule` if needed; Vite serves files from the repo root in dev) and exports it typed. Export `FIXTURE_NOW = new Date(sample.now)` for relative times. Nothing outside `src/dev/` and `src/pages/dev/` may import it.
2. **Dev routes**, registered exactly like `/dev/kit` (DEV only, lazy, outside production bundles):
   - `/dev/kit/components?theme=noon|dusk` — the component catalogue, built up by UI-P06–UI-P15. Start it as an empty page at 1440px wide with the backdrop colour and a heading. Each section it will render carries `data-catalogue="<Section name>"`, using the same names as `design/reference/components/*.html` (Identity, Controls, Proof, Panels, Orbs, Tagline, Build cards, Charts, Frame).
   - `/dev/kit/pages/:page?theme=noon|dusk&viewport=desktop|mobile` — renders a page view (`HomeView`, `GalleryView`, …) with fixtures. Until a view exists, render `<div data-design-ready="false">Not built yet</div>`.
   - Both routes set `data-theme` on `<html>` from `?theme=` for the life of the page, without writing to the stored preference.
3. **Audit spec** beside the existing audit specs, named `design-compare.spec.ts`, plus a script in `package.json`: `"audit:design": "playwright test --config=playwright.audit.config.ts design-compare"`. For every entry in `design/reference/index.json`:
   - **Pages** (`kind` desktop or mobile): open the reference HTML with `file://`, wait for `document.fonts.ready`, and screenshot it at its `width`×`height` (`deviceScaleFactor: 1`). For desktop boards, clip off the top 84px (the browser strip). Then open `/dev/kit/pages/<page>?theme=<theme>&viewport=<kind>` at the same width and screenshot the same area. Skip the pair with a clear message if the page reports `data-design-ready="false"`.
   - **Components**: for each `[data-catalogue]` section present in both the reference catalogue and `/dev/kit/components`, take an element screenshot of each and compare.
   - Compare by writing the reference screenshot to `testInfo.snapshotPath(name)` and then `expect.soft(appShot).toMatchSnapshot(name, { maxDiffPixelRatio })`, where the ratio defaults to `0.04` and can be overridden with `DESIGN_MAX_DIFF`. Playwright's report then shows expected, actual and diff for every board. This needs no new dependency.
   - Filter with `--grep` (for example `npm run audit:design -- --grep "desktop/noon/home"`).
4. Document the three commands at the top of `design/README.md` under "Checking a change".

**Do not.** Add any dependency. Put fixtures or dev pages in the production bundle (verify with `npm run build` and a search of `dist/` for `sample-data`).

**Done when.** `npm run audit:design` runs, reports every page pair as skipped ("not built yet"), and the Components pair runs against the empty catalogue. Build output contains no fixture data.

**Commit.** `UI-P01: design compare harness and dev compare pages`
