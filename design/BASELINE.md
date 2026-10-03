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
- Pause on visibility change, stop animation loop when `prefers-reduced-motion` + no ripples

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
