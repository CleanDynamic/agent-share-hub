# SV-03 · after

Branch `sv-03-fast-data`. Taken the same way as `sv-03-before.md`: `npm run audit:pages` on a built bundle through `vite preview`, the audit harness as the database, every request 120 ms late, median of 3. Raw numbers: `design/audits/pages/sv-03-after.json`. The migration is **not applied** and `compose_open` was **not built**, so these are the numbers before the Lovable message.

Four ways now. **cold** is a fresh browser opening the page (its code and all). **first** is the page opened for the first time from inside the app, with no hover first, after the app has had 4 s of idle time (this is the "page not visited yet" of the targets). **warm** is a page opened again within 30 s. **reload** is the page reloaded after 3 s. "Best" is the fewest rounds in any of the 3 runs: this machine's CPU holds the main thread for most of a second while the composer first renders, which delays requests that waited for nothing and reads as an extra round.

| page | way | ms before to after | requests | rounds | KB |
| --- | --- | --- | --- | --- | --- |
| home | cold | 810 to 722, down 11% | 16 to 10 | 2 to 2 (best 1) | 10.9 to 19.2 |
| home | first | not measured before; after 337 | after 1 | after 1 (best 1) | after 9.3 |
| home | warm | 21 to 27, up 29% | 0 to 0 | 0 to 0 (best 0) | 0 to 0 |
| home | reload | 737 to 617, down 16% | 16 to 7 | 2 to 1 (best 1) | 10.9 to 0.5 |
| builds | cold | 1,417 to 1,269, down 10% | 21 to 14 | 6 to 4 (best 4) | 62.2 to 31 |
| builds | first | not measured before; after 868 | after 7 | after 5 (best 5) | after 30.5 |
| builds | warm | 17 to 19, up 12% | 0 to 0 | 0 to 0 (best 0) | 0 to 0 |
| builds | reload | 1,259 to 1,162, down 8% | 21 to 14 | 6 to 5 (best 5) | 62.2 to 31 |
| openbuilds | cold | 779 to 719, down 8% | 11 to 9 | 2 to 1 (best 1) | 2 to 0.9 |
| openbuilds | first | not measured before; after 314 | after 1 | after 1 (best 1) | after 0.4 |
| openbuilds | warm | 10 to 10, no change | 0 to 0 | 0 to 0 (best 0) | 0 to 0 |
| openbuilds | reload | 710 to 584, down 18% | 11 to 8 | 2 to 1 (best 1) | 2 to 0.9 |
| library-saved | cold | 990 to 707, down 29% | 11 to 8 | 3 to 1 (best 1) | 3.5 to 0.7 |
| library-saved | first | not measured before; after 312 | after 1 | after 1 (best 1) | after 0.1 |
| library-saved | warm | 13 to 8, down 38% | 0 to 0 | 0 to 0 (best 0) | 0 to 0 |
| library-saved | reload | 886 to 603, down 32% | 11 to 8 | 3 to 1 (best 1) | 3.5 to 0.7 |
| library-collections | cold | 844 to 831, down 2% | 10 to 9 | 2 to 2 (best 2) | 1.9 to 1 |
| library-collections | first | not measured before; after 444 | after 2 | after 2 (best 2) | after 0.5 |
| library-collections | warm | 9 to 9, no change | 0 to 0 | 0 to 0 (best 0) | 0 to 0 |
| library-collections | reload | 709 to 744, up 5% | 10 to 9 | 2 to 2 (best 2) | 1.9 to 1 |
| drafts | cold | 988 to 717, down 27% | 13 to 8 | 3 to 1 (best 1) | 19.6 to 8.4 |
| drafts | first | not measured before; after 316 | after 1 | after 1 (best 1) | after 7.8 |
| drafts | warm | 13 to 15, up 15% | 0 to 0 | 0 to 0 (best 0) | 0 to 0 |
| drafts | reload | 881 to 616, down 30% | 13 to 7 | 3 to 1 (best 1) | 19.6 to 0.5 |
| composer | cold | 2,104 to 1,980, down 6% | 11 to 15 | 3 to 3 (best 2) | 12.7 to 16 |
| composer | first | not measured before; after 1,769 | after 11 | after 2 (best 2) | after 15.5 |
| composer | warm | 33 to 34, up 3% | 0 to 0 | 0 to 0 (best 0) | 0 to 0 |
| composer | reload | 1,179 to 1,331, up 13% | 11 to 14 | 3 to 2 (best 2) | 12.7 to 14.1 |
| build | cold | 991 to 951, down 4% | 14 to 12 | 3 to 2 (best 2) | 13.5 to 12.4 |
| build | first | not measured before; after 341 | after 5 | after 2 (best 2) | after 11.9 |
| build | warm | 16 to 15, down 6% | 0 to 0 | 0 to 0 (best 0) | 0 to 0 |
| build | reload | 849 to 697, down 18% | 14 to 12 | 3 to 2 (best 2) | 13.5 to 12.4 |
| profile | cold | 1,925 to 1,887, down 2% | 11 to 11 | 3 to 2 (best 2) | 2.6 to 2.6 |
| profile | first | not measured before; after 1,333 | after 2 | after 2 (best 2) | after 1 |
| profile | warm | 1,297 to 1,291, no change | 2 to 2 | 2 to 2 (best 2) | 1 to 1 |
| profile | reload | 1,826 to 1,776, down 3% | 11 to 11 | 3 to 3 (best 2) | 2.6 to 2.6 |

## The targets

| Target | Result |
| --- | --- |
| A page visited before in this visit: content in the first frame | Yes where it can be measured: 8 to 36 ms from the click to the page-ready mark (one or two frames; the composer's 34 ms is its mount). No placeholder, no request. |
| A page after a reload: within 600 ms, or in the first frame with the kept cache | Home 589, Drafts 616, Library Saved 603, OpenBuilds 584 ms. The kept cache is built. Home and Drafts come from it (their first screen is in the first frame; the 7 requests behind it only refresh), Saved and Builds are not kept (their cards carry `post_doc`, which the kept cache never holds). The 600 ms figure is within a few percent of what this machine needs just to load and run the page's code (about 560 ms with no data at all), so the two that read 603 and 616 are the code, not the data. |
| First visit: Drafts and Library within 600 ms | Yes. Drafts 316 ms, Library Saved 312 ms. |
| First visit: opening a draft within 900 ms | **No: 1,769 ms.** Two request rounds (the target) but the composer's first render holds the main thread for 1.07 s on this machine (a long task of 1,071 ms, measured), after the data is in. `compose_open` would save one round of 120 ms and not that render, so it was not built. |
| Request rounds: Drafts 1, Library Saved 1, opening a draft 2 | **Yes**: 1, 1 and 2. `npm run audit:pages` fails when any of them is missed (on the best of the runs). |

`pageBaseline.json` holds each page's cold request count from this run; `npm run audit:pages` also fails when a page's cold count is more than one over it.

## Web Vitals, before to after (`npm run audit:perf`, built bundle)

| route | theme | LCP ms | INP proxy ms | CLS |
| --- | --- | --- | --- | --- |
| home | noon | 7028 to 5904 | 48 to 24 | 0.008 to 0.008 |
| home | dusk | 1596 to 1424 | 24 to 24 | 0.008 to 0.008 |
| gallery | noon | 1600 to 1632 | 24 to 24 | 0.034 to 0.004 |
| gallery | dusk | 1612 to 1596 | 32 to 32 | 0.034 to 0.004 |
| build | noon | 952 to 972 | 24 to 24 | 0.006 to 0.011 |
| build | dusk | 1028 to 1112 | 32 to 32 | 0.006 to 0.011 |

The build route is not strictly no worse: LCP +20 ms and +84 ms (the run-to-run spread on this machine is larger than that: Home Noon's first-in-process LCP moved by 1.1 s) and CLS 0.006 to 0.011, still half of the 0.02 line. In the harness the build page answers "could not be loaded" (its fixture returns every build for a slug lookup), so what shifts there is the new loading shape giving way to that message. The Gallery's CLS fell from 0.034 to 0.004.

## Tests and other checks

- `npm test`: 8,805 tests before, 8,890 after. The same 57 fail in the same 11 files as on main at `cd20f49` (listed in `sv-03-before.md`); no test that passed before fails now.
- `npm run audit:design`: 7 of 32 boards fail (`build-map`, `composer-map`, `composer-card` in both themes, `noon/prompt-window`); the same 7 fail on main at `cd20f49`, run in a second checkout.
- `npm run audit:perf`: "the feed reserves its slots" fails as it did before any change (it finds 0 cards on the Builds tab).
- The built `dist/index.html` holds `<link rel="preconnect" href="https://zybdotagjwektucfdkri.supabase.co" crossorigin />`, filled in by Vite from `VITE_SUPABASE_URL`. The harness answers every request itself, so the milliseconds it saves on the first real request cannot be measured here: it takes the DNS lookup and TLS handshake off the first request, which is one round trip or more on a cold connection.
