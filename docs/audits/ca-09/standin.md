# CA-09 stand-in: the site on a fake Supabase, on localhost

The live database can't be reached from a Claude Code container (`*.supabase.co` is blocked), so CA-09 measured the
built site against a stand-in that answers like it. The fix sessions should measure their changes the same way, so
the numbers in `report.md` §2 can be compared before and after.

Nothing here changes product code. `client.ts` and `.env` are untouched: the build reads the stand-in's address from
environment variables, which beat `.env` in Vite.

## What it is

| Part | File | What it does |
|---|---|---|
| Fake Supabase | `src/lib/build/__audit__/ca09/server.mjs` | PostgREST, GoTrue, Storage, Realtime (Phoenix over WebSocket) and Functions on `https://127.0.0.1:54321`, HTTP/2. |
| Schema | `src/lib/build/__audit__/ca09/schema.mjs` | Reads every table, column, relationship and function from `src/integrations/supabase/types.ts` (Lovable regenerated it tonight from the live database). A column, table or function `types.ts` lacks answers as PostgREST does: 42703, PGRST204, PGRST205, PGRST202, PGRST200/201 for embeds. |
| Data | `src/lib/build/__audit__/ca09/seed.mjs`, `node_types.json` | Miles's shape, made up: 16 drafts (one of 7 steps; one a 10-post thread with 40 pictures; six "Untitled build"), 20 import sessions (four proposals of 1.2, 2.5, 3.8 and 5.0 MB), 30 published builds by 9 makers, a 12-step 40-picture published build (`/b2/ca09-showcase`), 6 DM threads, 12 notifications. `node_types.json` is the real registry, produced by running the seed migrations on Postgres 16. |
| Site server | `docs/audits/ca-09/scripts/static.mjs` | Serves the built site on `https://127.0.0.1:4443` as a CDN would: HTTP/2, gzip, `netlify.toml`'s cache headers, SPA fallback. (`vite preview` sends JavaScript uncompressed over HTTP/1.1, which made the phone ~2× slower than it should be.) |
| CA-08's fake | `src/lib/build/__audit__/fakeSupabase.ts` | Copied unchanged from PR #361, for vitest tests that mount a page behind supabase-js. |

## Start it

```sh
npm ci
docs/audits/ca-09/scripts/standin.sh build      # builds into /var/tmp/ca09-dist, pointed at the fake
docs/audits/ca-09/scripts/standin.sh start      # https://127.0.0.1:4443 (site) and https://127.0.0.1:54321 (fake)
# … measure …
docs/audits/ca-09/scripts/standin.sh stop
```

For render counts, a second build with component names kept: `CA09_DIST=/var/tmp/ca09-dist-names CA09_NOMINIFY=1
docs/audits/ca-09/scripts/standin.sh build`, then `CA09_TLS_DIR=/var/tmp/ca09-tls node
docs/audits/ca-09/scripts/static.mjs /var/tmp/ca09-dist-names 4444` and `CA09_SITE=https://127.0.0.1:4444`.

The certificate is self-signed for `127.0.0.1`; the scripts launch Chromium with `--ignore-certificate-errors`.
Signing in is a session put in `localStorage` (`sb-127-auth-token`) before the page loads (`scripts/lib.mjs`).

## Latency and faults

Set at runtime, so one server serves every run:

```sh
curl -sk -X POST https://127.0.0.1:54321/__audit/config -H 'content-type: application/json' -d '{"latency":400}'
```

| Key | Meaning |
|---|---|
| `latency` | ms added to every request, preflights included. 120 is "normal", 400 "slow". |
| `proposalCostMsPerMb` | ms per MB of `proposal` in the rows an `import_sessions` read returns. Postgres 16 measured ~1 (hot cache); 5 stands for a shared-CPU instance. |
| `statementTimeoutMs`, `timeoutWhenProposalOverMb` | Part 4's statement timeout: wait that long, then answer `500 57014 canceling statement due to statement timeout`, for a read whose modelled time is longer, or that returns a proposal over that many MB. |
| `faults` | `[{ method?, path (regex), status, body, delayMs?, times? }]`: answered instead of the real thing. |
| `delays` | `[{ method?, path (regex), delayMs }]`: the right answer, later (one read slow alone). |

Also: `POST /__audit/reset` (fresh data), `GET /__audit/log` (every request with status, code, ms and MB of proposal
read), `POST /__audit/clear-log`.

## Device profiles (`scripts/lib.mjs`)

- **desktop**: Chromium, 1280×800, no throttling.
- **iphone**: Playwright `devices["iPhone 15 Pro Max"]` (430×739, DPR 3, touch, iOS user agent) in **Chromium**:
  WebKit is not installed in this container and may not be downloaded. CPU throttled 4× and network on Chrome
  DevTools' "Fast 3G" (562.5 ms latency, 1.44 Mbit/s down, 0.675 Mbit/s up) through CDP.
- **iphone390**: the same at 390×664.

## The measurement scripts (`docs/audits/ca-09/scripts/`)

| Script | Part | Writes |
|---|---|---|
| `measure-routes.mjs desktop\|iphone normal\|slow` | 2 | `measurements/routes-*.json`, screenshots |
| `polling.mjs` | 2 | `measurements/polling.json` |
| `keystrokes.mjs desktop\|iphone` | 2 | `measurements/keystrokes-*.json` |
| `lighthouse.mjs` (needs `CA09_LIGHTHOUSE`, Lighthouse 12 installed outside the project) | 2 | `lighthouse/*.report.html`, `.json`, `summary.json` |
| `actions.mjs desktop\|iphone`, `probe-add.mjs` | 3 | `actions-*.json`, `actions.csv`, `measurements/add-menu-probe-*.txt` |
| `drafts.mjs desktop\|iphone`, `proposal-cost.mjs` | 4 | `measurements/drafts-*.json`, `measurements/proposal-cost-pglz.json` |
| `phone.mjs` | 5 | `phone/phone-390.json`, `phone/phone-430.json`, screenshots |
| `scan-catches.mjs`, `scan-rpcs.mjs` | 6 | `raw/catches.csv`, `raw/rpcs.csv`, `raw/tables-missing.csv` |
| `make-live-checks.mjs` | 7 | `live-checks.sql` |

`proposal-cost.mjs` needs a local Postgres 16 (`PGURL`); it creates and drops its own database.

## What the stand-in is not

- Not the live database: timings are the fake's latency plus the browser's work, not Postgres's. Part 4's Postgres
  costs come from `proposal-cost.mjs` on a local Postgres 16, not from Supabase's hardware.
- Storage returns the same 190 KB JPEG for every picture, at every requested width; Supabase's image transform would
  send a smaller file for a small slot.
- RLS is modelled for builds, their children and import_sessions; other tables are readable by anyone.
- Chromium, not Safari: iOS-only behaviour (the keyboard, focus outside a tap, `100vh`) is reasoned from the code and
  WebKit's documented behaviour, not seen.
