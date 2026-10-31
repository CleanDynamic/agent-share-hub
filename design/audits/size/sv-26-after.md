# SV-26 after

KB is 1000 bytes, gzip, as `vite build` prints it, except the "before" first-download figure, which the P0 report gave in 1024-byte KB (414.7 KiB = 424.6 KB). `scripts/check-size.mjs` (run by `npm run audit:pages` and `npm run audit:size`) uses 1000.

| | Before | After | Target |
| --- | --- | --- | --- |
| First download, signed out on `/` | 424.6 KB | 230.2 KB (282.6 after the first session) | 200 KB: **not met** |
| First download, signed in | not measured | 230.2 KB: the same files (the static graph does not depend on the session); the signed-in extras (account menu, composer) load at idle | 230 KB: **not met by 0.2 KB** |
| Composer chunk (`SandboxPage`) | 213.1 KB | 119.0 KB by the script | 120 KB: met |
| `Upload` (legacy) | 221.0 KB | 175.9 KB (+ `ArticleEditor` 46.4 KB, loaded when its step opens) | none |
| Library file names across an app-code change | changed | kept (`lib-react`, `lib-router`, `lib-query`, `lib-supabase`, `lib-dnd`) | kept: met |

## Why the first download misses 200 KB

The second session took it from 282.6 to 230.2 KB with five moves, each measured alone (the size with that one move undone, minus 230.2):

| Move | Saved |
| --- | --- |
| Header account menu (Radix dropdown, popper, floating-ui) loads at idle, or on hover, focus or press of the account button; the same button stands in until then | 29.9 KB |
| No app-wide `TooltipProvider`: a `Tooltip` brings its own when none is above it; components with several share one | 18.2 KB |
| The header's search and account bottom sheets (Radix dialog) load on first open or at idle | 14.8 KB |
| The sonner toaster mounts at idle and shows any toast raised before it; the reblog context imports sonner on the press | 9.1 KB |
| No `HelmetProvider`: on React 19 it renders a fragment and nothing else | 5.6 KB |

What is left (gzip, file by file): React DOM 58.9, the Supabase client 48.2, the stylesheet 17.5, TanStack Query 12.9, the router 8.2, `tailwind-merge` 6.7 (the error views' button and the admin route's skeleton use `cn`), and about 78 KB of app code and small libraries: the frame (header, footer, dock, theme), the route table with every page's loading placeholder, the providers and the query persister.

The remaining 30 KB needs one of these, and each is outside what SV-26 allows:

- **The Supabase client** (supabase-js 2.103.0) builds its realtime and storage clients in the `createClient` constructor, so about 18 KB of realtime-js, phoenix and storage-js arrive with auth and postgrest whatever the page uses. Taking them out means building the first page's client from `@supabase/auth-js` and `@supabase/postgrest-js` and loading the full client later, a change to how the library is used (Part 2 keeps "the Supabase client" in the first download).
- **The other pages' placeholders** (Builds, Drafts, Library, OpenBuilds, the build page and the composer skeleton, about 14 KB) are in the first download on purpose (SV-03, SV-04), so a page opened by its address shows its own loading shape in the first frame. Loading them per route would add a round trip before that shape on those pages, a visible change.
- **The stylesheet** is one Tailwind file for every page; splitting it per route is a restyle-sized change.

## Part notes
## Part notes

- **P3 windows on demand** (SandboxPage chunk): Add dialogs (decision, system prompt, dataset, repo, manual step, result, tool, check, code), `TileEditDialog` (25.0 KB), `FullPromptWindow` (27.6 KB), `PostTab` (31.3 KB), `SessionMapPanel` (2.8), `SourcesPanel` (4.8), `ReferenceWindows` (6.7), `ClashWindow`, `LeaveWindow`. Total 213.1 -> 119.6 KB. Each loads on first open, or at idle once the composer is ready (`preloadComposerWindows`, beside Add from Library's own idle preload). Add from Library is still its own chunk. **Hover and focus (second session):** the first hover or focus of any control in the composer fetches every window's code (`useWarmWindowsOnIntent`), so a window opened before idle is usually already there; with Save-Data on, each window loads only when it opens. A window opened before either shows when its code arrives (no placeholder). `AddAgentDialog` stays in the chunk (the page imports `DEFAULT_AGENT_MODEL` from it). `PartWindow` stays (the page imports `allParts` from it). Classification (`SandboxCard`) and the Details panel stay: the view imports them directly, and moving them changed under 5 KB.
- **P4:** `build.rolldownOptions.output.codeSplitting.groups` in `vite.config.ts`. Two builds with one line of `HomePage.tsx` changed gave identical `lib-*` file names. **Hosting:** `netlify.toml` sets `Cache-Control: public, max-age=31536000, immutable` on `/assets/*`. Nothing in the repo says whether Netlify or Lovable serves the site, so the headers may not apply. Message for Lovable if they do not: "Please serve everything under `/assets/` with `Cache-Control: public, max-age=31536000, immutable`, and serve `index.html` with `Cache-Control: no-cache`."
- **P5:** see the report.
