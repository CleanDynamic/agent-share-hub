# SV-26 after

KB is 1000 bytes, gzip, as `vite build` prints it, except the "before" first-download figure, which the P0 report gave in 1024-byte KB (414.7 KiB = 424.6 KB). `scripts/check-size.mjs` (run by `npm run audit:pages` and `npm run audit:size`) uses 1000.

| | Before | After | Target |
| --- | --- | --- | --- |
| First download, signed out on `/` | 424.6 KB | 282.6 KB | 200 KB: **not met** |
| First download, signed in | not measured (no browser audit in this container) | not measured | 230 KB |
| Composer chunk (`SandboxPage`) | 213.1 KB | 119.6 KB (118.8 by the script) | 120 KB: met |
| `Upload` (legacy) | 221.0 KB | 175.9 KB (+ `ArticleEditor` 46.4 KB, loaded when its step opens) | none |
| Library file names across an app-code change | changed | kept (`lib-react`, `lib-router`, `lib-query`, `lib-supabase`, `lib-dnd`) | kept: met |

## Why the first download misses 200 KB

What is left in it is what a signed-out visitor needs to draw `/` and cannot load later: React DOM (about 60 KB), the Supabase client (about 48 KB: auth-js, realtime-js, storage, postgrest), TanStack Query (12.5), the router (8.3), the stylesheet (17), sonner (the toaster function `toast()` is called from eager code), Radix tooltip/toast/popper, `react-helmet-async`, `tailwind-merge`, and the app's own frames and loading views (the route table's placeholders are eager on purpose, SV-03/SV-04). Getting under 200 KB would take replacing libraries, which the prompt rules out, or removing the Supabase realtime and storage clients from the first download (they are one package; splitting needs `createClient` options and a change to how `AuthContext` starts). That is the next step to cost out; it is not done here.

Moves kept (each saved at least 5 KB on `/`): `countDraftBuilds` out of `sessions.ts` (-54 KB), share menu + reblog window + upload picker (-27 KB together), `ComposeRoute` lazy (-30 KB), `SkipToBuild` apart from `buildFocus` (-9.5 KB), connector guide + gamification toasts (-10 KB), idle mounts of Toaster, Presence and quote selection (-5 KB), library chunk grouping (-5 KB).

## Part notes

- **P3 windows on demand** (SandboxPage chunk): Add dialogs (decision, system prompt, dataset, repo, manual step, result, tool, check, code), `TileEditDialog` (25.0 KB), `FullPromptWindow` (27.6 KB), `PostTab` (31.3 KB), `SessionMapPanel` (2.8), `SourcesPanel` (4.8), `ReferenceWindows` (6.7), `ClashWindow`, `LeaveWindow`. Total 213.1 -> 119.6 KB. Each loads on first open, or at idle once the composer is ready (`preloadComposerWindows`, beside Add from Library's own idle preload). Add from Library is still its own chunk. **Not built:** a preload on hover or focus of the control that opens a window; only the idle preload exists, so a window opened before idle shows when its code arrives (no placeholder). `AddAgentDialog` stays in the chunk (the page imports `DEFAULT_AGENT_MODEL` from it). `PartWindow` stays (the page imports `allParts` from it). Classification (`SandboxCard`) and the Details panel stay: the view imports them directly, and moving them changed under 5 KB.
- **P4:** `build.rolldownOptions.output.codeSplitting.groups` in `vite.config.ts`. Two builds with one line of `HomePage.tsx` changed gave identical `lib-*` file names. **Hosting:** `netlify.toml` sets `Cache-Control: public, max-age=31536000, immutable` on `/assets/*`. Nothing in the repo says whether Netlify or Lovable serves the site, so the headers may not apply. Message for Lovable if they do not: "Please serve everything under `/assets/` with `Cache-Control: public, max-age=31536000, immutable`, and serve `index.html` with `Cache-Control: no-cache`."
- **P5:** see the report.
