# SV-26 before (main at 2e5dd85, after SV-25)

Sizes are gzip, from `vite build` (Vite 8.0.0, Rolldown). "First download" = `index.html`'s script, modulepreload and stylesheet files, summed (`/tmp` script: gzip each file). Signed out, on `/`; the route's own chunk and data are not in this number.

## Assumptions

- Vite 8 builds with Rolldown, and `rollup-plugin-visualizer` works with it (`ANALYZE=1 npm run build` writes `design/audits/size/stats.html`; `ANALYZE_RAW=1` writes raw JSON to /tmp): **confirmed**, so the visualizer is used.
- First page about 380 KB: **found 414.7 KB** (index 199.6, client 47.9, storage 21.9, css 21.8, 72 small files). SV-02 to SV-25 added about 35 KB.
- `SandboxPage` 210 KB: **found 213.1 KB**. `Upload` 221 KB: **221.0 KB**. `dist-*` 120 KB: **120.1 KB** (`dist-D1dcxTGq`). `BuildPage` 44 KB: **44.2 KB**. `GalleryPage` 22 KB: the page is now `BuildsPage`, **14.5 KB**.
- `App.tsx` loads the providers and `ComposeRoute` with the first page: **confirmed** (all of them were in `index`).
- `framer-motion` imported by 4 files: **3 files** (`dm/ThreadView.tsx`, `content-detail/ResultsCarouselViewer.tsx`, `Messages.legacy.tsx`); `components/feed/FeedShell.tsx` no longer imports it. `recharts`: **not in any chunk** (nothing imports `components/ui/chart.tsx`'s package in the built graph).
- 9 `index.ts` barrels: **21 `index.ts` files** on disk now; `src/lib/build/index.ts` is 424 lines.
- `Messages.legacy` polls every 5 s: checked in Part 5.
- Em dashes, `no-console` counts: checked in Parts 5 and 6.

## Plan

- Part 1: delete what `knip` and the route check clear; remove unused packages; remove `FrameRoute` -> verified by: `knip` report, build, tests.
- Part 2: providers and `ComposeRoute` out of the first download; `lib/build/sessions.ts` out of the header's imports -> verified by: first-download sum, `initialBundle.test.ts`.
- Part 3: composer windows on demand, early at hover and idle; `Upload` heavy libraries -> verified by: `SandboxPage` chunk size, tests.
- Part 4: stable library chunks; names across a code change -> verified by: two builds compared.
- Part 5: `select("*")`, exact counts, polling, `no-console` -> verified by: tests, lint, `audit:pages`.
- Part 6: after report, size checks in `audit:pages`, other audits -> verified by: the audits.

## Chunks over 10 KB compressed (before)

| Chunk | KB | What is in it |
| --- | --- | --- |
| `Upload` | 221.0 | legacy upload page and its editors |
| `SandboxPage` | 213.1 | the composer: `pages/site/compose` 241 KB of module gzip, `components/post` 41.7, `lib/build` 39.2, `components/brand` 9.6, `lib/classify` 7.7 |
| `index` | 199.6 | app shell, React DOM, router, providers, `lib/build` (79 KB of module gzip: `sessions.ts` and what it imports), `pages/site` frames |
| `dist-D1dcxTGq` | 120.1 | tiptap and prosemirror (`prosemirror-view` 39.5, `@tiptap/core` 36.3, `prosemirror-model` 17.6, `prosemirror-transform` 11.9, `linkifyjs` 11.5). Used by `components/post/editor`, i.e. the composer's prompt window and the legacy editors |
| `hooks` | 68.5 | shared hooks chunk |
| `ContentDetail` | 64.2 | content page |
| `client` | 49.4 | Supabase client (auth-js 30, realtime-js 13.5, phoenix 9, storage-js 7, postgrest 6) |
| `buildSummary` | 49.4 | build summary code |
| `BuildPage` | 44.2 | build page |
| `proxy` | 39.7 | framer-motion; only lazy pages load it |
| `Compose` | 33.3 | legacy composer |
| `PublishMetadata` | 27.1 | |
| `storage` | 22.7 | in the first download |
| `ComposePage`, `Messages`, `ReblogDetail`, `FeedPost` | 21.6, 21.4, 18.0, 16.4 | |
| `sortable.esm` | 16.1 | the drag library |
| `ProfilePage`, `BuildsPage` (Table, Maps, Classification), `readerSteps`, `LibraryPage`, `ContentBlockViewer`, `SchemaForm`, `HomePage` | 14.5, 14.5, 13.3, 12.8, 12.2, 12.0, 11.2 | |

`OpenBuildsPage` 9.6, `DraftsPage` and Add from Library are under 10 KB each (Add from Library is its own chunk, checked again in Part 3).

## Questions the prompt asks

- **Composer code outside the composer:** the first download held `lib/build/sessions.ts`, `addSession.ts`, `graph.ts` (22 KB), `making.ts`, `decision.ts`, `thread.ts`, `tileExtras.ts`, `sourceTiles.ts` (about 79 KB of module gzip) because `SiteHeader.tsx` imported `countDraftBuilds` from `sessions.ts`. Also `ComposeRoute.tsx` with `builds.ts`, `staleWrites.ts`, `clash.ts`, `nodes.ts`, `lib/classify/taxonomy.ts`, `lib/tools/registry.ts`, `lib/models/registry.ts`; `routeTable.ts` imported `buildFocus.tsx` (for `SkipToBuild`) which pulled `listMotion.ts`, `largeBuild.tsx`, `useBuildSelection.ts`.
- **First download:** signed out 414.7 KB. Signed in adds the composer's code at idle (SV-03 P6), not in this number.
- **Composer downloads before it is ready:** `SandboxPage` 213.1 KB + `dist-D1dcxTGq` 120.1 KB (prosemirror) + `sortable.esm` 16.1 KB + shared chunks.
- **`dist-*` chunk:** `dist-D1dcxTGq` is tiptap + prosemirror + linkifyjs (the rich text editor), loaded by every page that mounts `components/post/editor`: the composer, the legacy upload and blog editors. Not in the first download.
- **framer-motion / recharts:** `framer-motion` is in `proxy-*.js` (39.7 KB), not in the first download. `recharts` is in no chunk.
- **Barrels:** the first download held code from `lib/build/` only through direct file imports (the `lib/build/index.ts` barrel is not reached; `initialBundle.test.ts` guards that). No barrel costs the first page 5 KB, so no barrel import is changed.
