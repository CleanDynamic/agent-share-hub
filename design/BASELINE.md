# Baseline before the UI overhaul (UI-P00)

Measured on `32176eb` (main, merge of #265), before any `UI-Pnn` change. Later prompts compare against these numbers. Nothing failed, so nothing is listed as pre-existing breakage.

Environment: Node 22.22.0, npm 10.9.4, `npm ci` from `package-lock.json`, Playwright 1.58.2.

| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | Pass, 0 errors |
| `npm test` | Pass: 158 files, 2566 tests passed, 0 failed |
| `npm run build` | Pass (built in 6.6s); 72 JS files, `dist/` 4.2 MB |
| `npx playwright test e2e/tier1 --project=desktop --project=mobile` | Pass: 92 passed (46 desktop, 46 mobile), 0 failed, 0 skipped |

## Largest JS chunks (`npm run build`)

| Chunk | Minified | Gzip |
|---|---|---|
| `index-*.js` (entry) | 2,887.47 kB | 802.20 kB |
| `client-*.js` | 189.14 kB | 49.61 kB |
| `Compose-*.js` | 106.27 kB | 30.78 kB |
| `BuildPage-*.js` | 89.43 kB | 25.70 kB |
| `SchemaForm-*.js` | 85.19 kB | 27.33 kB |
| `ReblogDetail-*.js` | 60.39 kB | 17.70 kB |

Warnings already present in the build output:

- Some chunks are larger than 500 kB after minification (the entry chunk).
- `INEFFECTIVE_DYNAMIC_IMPORT`: `src/lib/mentions.ts` is imported dynamically by `src/lib/notifications/triggers.ts` and statically by `src/components/CommentsSection.tsx` and `src/lib/bounty-solver/postDiscussionComment.ts`.
- `INEFFECTIVE_DYNAMIC_IMPORT`: `src/lib/content-detail/index.ts` is imported both dynamically and statically by `src/pages/ContentDetail.tsx`.

## Tier 1 by spec

| Spec | Passed (desktop + mobile) |
|---|---|
| `e2e/tier1/auth-entry.spec.ts` | 34 |
| `e2e/tier1/wide-layout.spec.ts` | 58 |

## Running tier 1 in the cloud sandbox

The committed `playwright.config.ts` ran unchanged apart from two sandbox limits, which a gitignored `playwright.e2e.tmp.ts` override (`*.tmp.ts`) worked around:

- The sandbox ships Chromium build 1194 at `/opt/pw-browsers/chromium`, and Playwright 1.58.2 expects build 1208. The override sets `launchOptions.executablePath` to that path.
- The sandbox has no IPv6, so the dev server cannot bind `vite.config.ts`'s `host: "::"`. The override starts the dev server with `--host 127.0.0.1`, as `playwright.audit.config.ts` already does.

On a normal machine the command above runs as written.

# After the performance pass (UI-P40)

Measured on the UI-P40 branch against its parent, `f71e6aa` (main after UI-P39), both built in this sandbox with the same toolchain.

| Check | UI-P00 | `f71e6aa` (before UI-P40) | UI-P40 |
|---|---|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | Pass | Pass | Pass, 0 errors |
| `npm test` | 2566 passed | — | Pass: 218 files, 3657 tests passed, 0 failed |
| `npm run build` | 72 JS files, `dist/` 4.2 MB | 134 JS files, `dist/` 4.8 MB | Pass (built in 5.8s); 273 JS files, `dist/` 5.3 MB |
| Entry chunk `index-*.js` | 2,887.47 kB (gzip 802.20) | 2,893.88 kB (gzip 804.32) | **466.32 kB (gzip 136.24)** |
| Largest chunk | 2,887.47 kB (entry) | 2,893.88 kB (entry) | 837.78 kB (`Upload-*.js`, lazy) |
| Initial load (entry + its static imports) | — | ≈ 3.1 MB | ≈ 0.96 MB |
| Total JS in `dist/` | — | 4,322,505 B | 4,398,567 B (+1.8%, chunk overhead) |

No chunk is larger than the UI-P00 baseline's largest. The initial chunk graph, checked from source maps, has no fixtures, no `/dev/*` page, no chart code, no `Replay` and no compose route.

## Largest JS chunks after UI-P40

| Chunk | Minified | Gzip | Loaded |
|---|---|---|---|
| `Upload-*.js` | 837.78 kB | 220.87 kB | lazy (legacy upload routes) |
| `hooks-*.js` | 602.29 kB | 187.92 kB | lazy (shared by editor routes) |
| `index-*.js` (entry) | 466.32 kB | 136.24 kB | initial |
| `ContentDetail-*.js` | 248.95 kB | 63.12 kB | lazy |
| `client-*.js` | 189.14 kB | 49.61 kB | initial (Supabase client) |
| `proxy-*.js` | 121.84 kB | 39.67 kB | lazy |
| `Compose-*.js` | 108.78 kB | 31.76 kB | lazy |

## Lighthouse (performance only, median of 3)

Lighthouse 12.8.2 driven through puppeteer against `vite preview` of each build, live Supabase. The `site_frame` flag reads as off to an anonymous visitor and its dev override is stripped from production builds, so the runs answer the flag request in the browser to measure each frame. Home is `/`; the Build page is `/b2/untitled-build-54b9ju`, the one published build. Mobile is Lighthouse's default throttled phone, desktop its desktop preset. Times in ms.

| Page | Frame | Form | LCP before → after | CLS before → after | TBT before → after |
|---|---|---|---|---|---|
| Home | site | desktop | 2021 → 1431 | 0.0000 → 0.0000 | 0 → 0 |
| Home | site | mobile | 8711 → 5957 | 0.0000 → 0.0000 | 153 → 68 |
| Home | legacy | desktop | 1987 → 1520 | 0.0000 → 0.0000 | 0 → 0 |
| Home | legacy | mobile | 8450 → 6223 | 0.0000 → 0.0000 | 195 → 106 |
| Build | site | desktop | 3106 → 2256 | 0.0000 → 0.0000 | 0 → 0 |
| Build | site | mobile | 10711 → 7370 | 0.0021 → 0.0021 | 254 → 194 |

Every page improves on LCP and TBT, none is worse on CLS, and CLS is below 0.1 everywhere.

## Blur budget

`backdrop-filter` is declared only by `SiteHeader`, `MobileHeader`, `Dock`, `HeroPlate` (the build page's title plate) and `BuildView` (its action dock). `src/lib/theme/glass.test.ts` fails on any other declaration, Tailwind `backdrop-blur` class included. `RightPanelExplore` keeps its recorded exemption: it is an externally supplied shell, and editing it is an automatic fail.

## After the animated backdrop (UI-P13b)

The page backdrop changes from a static SVG/CSS gradient to a continuously rendering WebGL canvas with drifting noise, domain warping, and interactive ripples.

**Performance targets:**
- Frame rate: 60fps (16.67ms per frame) maintained during scroll and animation
- Canvas buffer: `min(devicePixelRatio, 1.5) × 0.85` of viewport (× 0.72 above 2.2 megapixels)
- Pause on visibility change; under `prefers-reduced-motion`, one static frame and no input

**Measurement to be taken:**
- Scroll `/gallery` with Chrome DevTools paint flashing enabled
- Average frame time during scroll
- Frame time 95th percentile
- GPU memory usage
- Test on both desktop and throttled mobile (6x CPU slowdown, slow 4G)

Entry chunk size impact (WebGL code inline, no new dependencies):
- Expected: <10 KB increase from shader and ripple logic

## Still open

- Card covers are signed one storage request per card (`signedMediaUrl` in `src/components/gallery/cardMedia.ts`). Supabase's batch `createSignedUrls` does not take an image transform, so batching them needs a server-side signer. That is a backend change and is out of scope for this pass.
- The 60fps scroll check with paint flashing is a manual DevTools check and was not run in this sandbox.
- UI-P13b backdrop performance baseline to be measured when app is running with the animated WebGL backdrop.

# The density pass on the kit (UI-P52)

UI-P52 tightened all 42 boards in `design/reference/` (desktop, mobile, components and brand; Noon and Dusk) with `design/scripts/tighten-reference.py`, using the table in `design/prompts/README-density.md`. Type, padding, margin, gap and control heights are smaller; widths, radii, colours, positions and the drawn browser strip are not, and on mobile no control that was 44px tall got shorter. `design/build-kit.py` writes the boards through the same script, so the tightened kit is what `--check` verifies and what a restore writes.

**Every board now fails `npm run audit:design`, and will until UI-P53 to UI-P58 land.** The order is deliberate: the reference moved first, so each later prompt is an ordinary "match the reference" change. Nothing in `src/` changed in UI-P52, so the app still draws every page at the old density and every comparison sees the gap. On a page board the app's larger text and boxes push everything below them out of line with the reference. In the component catalogue every section is now shorter in the reference than in the app, and the harness fails a size mismatch whatever its pixel ratio. UI-P53 (the theme layer), UI-P54 (the brand primitives) and UI-P55 (the site frame) close the shared part; the pages close in UI-P56 to UI-P58.

Measured on the UI-P52 branch with `DESIGN_MAX_DIFF=0`, so every board reports its exact share of differing pixels (the threshold is 4%). "Boards as drawn" is the same app against the reference before the pass.

| Board | Boards as drawn | After UI-P52 |
|---|---|---|
| `desktop/noon/home` | 4.16% | 12.82% |
| `desktop/noon/gallery` | 6.29% | 21.19% |
| `desktop/noon/build` | 4.08% | 10.91% |
| `desktop/noon/rebuild` | 4.86% | 9.58% |
| `desktop/noon/import` | not built (skipped) | not built (skipped) |
| `desktop/noon/bounties` | not built (skipped) | not built (skipped) |
| `desktop/noon/profile` | 4.00% | 12.09% |
| `desktop/noon/activity` | 3.31% | 7.16% |
| `desktop/noon/signin` | 3.82% | 9.43% |
| `desktop/dusk/home` | 3.20% | 8.66% |
| `desktop/dusk/gallery` | 4.42% | 12.42% |
| `desktop/dusk/build` | 3.10% | 7.23% |
| `desktop/dusk/rebuild` | 3.46% | 6.49% |
| `desktop/dusk/import` | not built (skipped) | not built (skipped) |
| `desktop/dusk/bounties` | not built (skipped) | not built (skipped) |
| `desktop/dusk/profile` | 3.37% | 8.83% |
| `desktop/dusk/activity` | 2.41% | 4.94% |
| `desktop/dusk/signin` | 10.35% | 16.85% |
| `mobile/noon/home` | 5.55% | 16.60% |
| `mobile/noon/gallery` | 7.77% | 36.47% |
| `mobile/noon/build` | 4.62% | 13.38% |
| `mobile/noon/rebuild` | 8.99% | 17.35% |
| `mobile/noon/import` | not built (skipped) | not built (skipped) |
| `mobile/noon/bounties` | not built (skipped) | not built (skipped) |
| `mobile/noon/solve` | not built (skipped) | not built (skipped) |
| `mobile/noon/profile` | 4.80% | 24.96% |
| `mobile/noon/activity` | 4.35% | 11.18% |
| `mobile/noon/signin` | 3.96% | 18.49% |
| `mobile/dusk/home` | 6.10% | 15.02% |
| `mobile/dusk/gallery` | 5.76% | 21.49% |
| `mobile/dusk/build` | 5.07% | 11.70% |
| `mobile/dusk/rebuild` | 7.69% | 14.96% |
| `mobile/dusk/import` | not built (skipped) | not built (skipped) |
| `mobile/dusk/bounties` | not built (skipped) | not built (skipped) |
| `mobile/dusk/solve` | not built (skipped) | not built (skipped) |
| `mobile/dusk/profile` | 5.71% | 17.00% |
| `mobile/dusk/activity` | 3.23% | 10.84% |
| `mobile/dusk/signin` | 3.65% | 18.29% |
| `components/noon/catalogue` · identity | 0.00% | 22.57%, height 326 vs app 366 |
| `components/noon/catalogue` · controls | 0.12% | 8.27%, height 494 vs app 562 |
| `components/noon/catalogue` · proof | 0.57% | 3.86%, height 179 vs app 215 |
| `components/noon/catalogue` · panels | 3.06%, height 392 vs app 529 | 4.15%, height 347 vs app 529 |
| `components/noon/catalogue` · orbs | 0.00% | 5.74%, height 267 vs app 301 |
| `components/noon/catalogue` · tagline | 0.00% | 17.06%, height 252 vs app 340 |
| `components/noon/catalogue` · build-cards | 3.63%, height 700 vs app 713 | 20.81%, height 636 vs app 713 |
| `components/noon/catalogue` · charts | 0.87% | 3.16%, height 367 vs app 403 |
| `components/noon/catalogue` · frame | 1.07% | 7.77%, height 480 vs app 539 |
| `components/dusk/catalogue` · identity | 0.00% | 19.37%, height 326 vs app 366 |
| `components/dusk/catalogue` · controls | 0.14% | 21.33%, height 494 vs app 562 |
| `components/dusk/catalogue` · proof | 0.60% | 22.00%, height 179 vs app 215 |
| `components/dusk/catalogue` · panels | 33.15%, height 392 vs app 529 | 49.66%, height 347 vs app 529 |
| `components/dusk/catalogue` · orbs | 0.00% | 20.90%, height 267 vs app 301 |
| `components/dusk/catalogue` · tagline | 0.00% | 46.59%, height 252 vs app 340 |
| `components/dusk/catalogue` · build-cards | 4.00%, height 700 vs app 713 | 18.90%, height 636 vs app 713 |
| `components/dusk/catalogue` · charts | 1.00% | 14.32%, height 367 vs app 403 |
| `components/dusk/catalogue` · frame | 0.99% | 18.88%, height 480 vs app 539 |

Import, bounties and solve have no compare page yet (`data-design-ready="false"`), so they are skipped, not compared. After the pass all 28 compared page boards are above 4%. Two failures predate it and are not caused by it: 17 of those 28 were already above 4%, and the catalogue already failed on two section heights (Panels 392px in the reference against 529px in the app, Build cards 700px against 713px, both themes).

`python3 design/build-kit.py --check` passes again. Before UI-P52 it reported six kit files as changed since UI-P00 — `HANDOFF.md`, `README.md` and `RULES.md` (edited by UI-P01, UI-P09b, UI-P13b, UI-P20, UI-P36 and UI-P41c) and the three files in `tokens/` (UI-P09b) — so a restore would have reverted them. The script now carries them as they are.
