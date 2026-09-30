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
