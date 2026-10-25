# CA-54 · Smaller downloads and cleanup

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** The last of the series, after CA-53. It runs last because it deletes and moves files every other prompt changes, and its budgets cover the finished pages. Read the series README (`design/prompts/ca-series/README.md`) first: its How to work, Motion limits, Performance rules and Database rules apply, and where this prompt says more, this prompt wins. Pull main first. Lovable commits straight to main. Branch `ca-54-download-size`. Commit at the end of every part with the part number in the message. Open one pull request titled `CA-54 smaller downloads and cleanup` at the end.

The facts here were checked on 25 October 2026, at `6b8fe912`, before CA-28 to CA-35 merged. **The file on disk wins.** If something here does not match the code, follow the code, do the nearest correct thing, and list the difference in the report.

If the session runs short, stop at the end of a finished part with every test green, commit, and report which parts are left.

## How to work

- **Plan first.** End Part 0 by writing two short lists at the top of `design/audits/size/ca-54-before.md`:
  - `Assumptions`: each fact in "What is heavy now" that you checked, and what you found;
  - `Plan`: one line per part, `Part n: what changes -> verified by: which size, test or audit`.
- **Measure every move.** A size change stays only if the measured size drops by at least 5 KB compressed on the page it is for. Otherwise revert it and list it under `Tried and reverted`.
- **Deleting is this prompt's job,** unlike CA-29 to CA-53. Delete only what `knip` reports **and** the route check clears. Read the `Dead code seen` lists in the CA-29 to CA-53 reports (in their pull requests) and check each item.
- **Small, revertable commits.** Deletions go in one commit per top-level folder, so a bad one can be reverted alone.
- **Surgical.** Every changed line traces to a part of this prompt. Rename nothing. Match the style around it.
- **Questions.** Miles isn't watching the session. Where you would ask, take the safer reading, carry on, and put the question in the report.
- **The domain isn't live yet.** Don't fetch `https://buildgallery.ai`. Measure the built bundle.

## What is heavy now

A `vite build` of `6b8fe912` gave these sizes, compressed. CA-30 to CA-53 have changed most pages since, so Part 0 measures again and the numbers below are only the starting point:

- **The first page's download** is about 380 KB: `index` 186 KB, `client` 49 KB, and many small chunks.
- **The heaviest pages:**
  - `SandboxPage` (the composer), 210 KB;
  - `Upload`, 221 KB;
  - a shared `dist-*` chunk, 120 KB;
  - `BuildPage`, 44 KB;
  - `GalleryPage`, 22 KB.
- **`App.tsx` loads these with the first page,** though most only matter once something opens:
  - `ShareMenuProvider`, `ReblogComposeProvider`, `UploadPickerProvider`, `QuotableSelectionProvider`, `AddToCollectionHost`, `PresenceProvider`, `GamificationToasts`, and two toasters (`Toaster`, `Sonner`);
  - `ComposeRoute`.
- **Every Publish renames most files,** so a returning reader downloads the libraries again (React, the router, TanStack Query, the Supabase client), even when they didn't change.
- **An audit found:**
  - about 250 files that nothing imports;
  - about 20 packages that nothing uses;
  - 74 `select("*")` reads;
  - 48 exact counts;
  - 25 polling timers (8 of them `refetchInterval`);
  - `Messages.legacy` (`src/pages/Messages.legacy.tsx`) polling every 5 seconds.
- **`no-console`** is a lint warning since CA-29, with about 150 `console` calls left.

## Targets

- **The first page's download** is at or under 200 KB compressed, signed out on `/`, and at or under 230 KB signed in.
- **The composer's own chunk** is at or under 120 KB compressed. Its windows load when first opened, or earlier on hover and at idle, so opening one still feels instant.
- **A Publish that changes only app code** leaves the library files' names unchanged.
- **Nothing looks or moves differently,** and CA-31's, CA-32's and CA-34's audits still pass.

## House rules

- No component changes its look or its motion. A window that now loads on demand opens with exactly the motion it has today. Sentence case, no em dashes.
- New dev dependencies allowed in this prompt only: `knip` and `rollup-plugin-visualizer`. No new runtime dependency.
- Never delete a file a registered route uses, even a legacy one. Old routes stay registered so a bookmark is never a 404.
- **Vercel rules.** If the `react-best-practices` skill (`vercel-labs/agent-skills`) is installed, follow these rule files: `bundle-dynamic-imports`, `bundle-conditional`, `bundle-defer-third-party`, `bundle-preload`. Read them for a Vite app: `React.lazy` where they say `next/dynamic`, and no package they name. Read `bundle-barrel-imports` as a question to measure, not a rule: its numbers are for Next.js, and Vite's production build already tree-shakes `lucide-react`, so don't rewrite icon imports.
- Run `npm test`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint` and `npm run build` before every commit.

---

## Part 0 · Measure

1. Add `rollup-plugin-visualizer`, enabled only when `ANALYZE=1`, writing `design/audits/size/stats.html`. Vite 8 builds with Rolldown, so check that the plugin works with it. If it doesn't, use Rolldown's own chunk report, don't add the plugin, and say which in the report.
2. Record into `design/audits/size/ca-54-before.md`, under the `Assumptions` and `Plan` lists:
   - every chunk over 10 KB compressed, with what is in it, including each redrawn page (Drafts, Library, Home, OpenBuilds), each Builds view (Table, Maps, Classification) and the Add from Library window;
   - whether any page outside the composer pulls in composer code (for example through CA-33's numbering function or a barrel), which it shouldn't;
   - what the first page downloads, signed out and signed in (CA-31's `npm run audit:pages` can list the requests);
   - what the composer downloads before it is ready.
3. **Name the `dist-*` chunk:** say which package it is, and which pages load it.
4. **Heavy libraries:** say which chunks hold `framer-motion` (imported by 4 files, including `components/feed/FeedShell.tsx`) and `recharts` (only `components/ui/chart.tsx`), and whether either is in the first download.
5. **The repo's own barrels:** `src` has 9 `index.ts` files that re-export with `export * from`. The biggest, `src/lib/build/index.ts` (426 lines), is imported about 150 times. For each barrel, say whether the first download holds code from it that `/` never uses.

Commit: `CA-54 P0: size report and plan`.

## Part 1 · Remove what nothing uses

1. Run `knip` with an entry list that matches the app:
   - `src/main.tsx`;
   - the dev pages under `import.meta.env.DEV`;
   - the tests;
   - `e2e/`;
   - `supabase/functions/`.
2. **Delete every file nothing imports,** after checking each against the route list in `App.tsx`. One commit per top-level folder (`CA-54 P1: remove unused files in <folder>`). List them in the report by folder, with a count.
3. **Remove packages nothing imports** from `package.json`, and update the lock file, in its own commit.
4. **Remove exports nothing imports** only where the file stays. Don't rename anything.
5. **`FrameRoute`** (`src/components/shell/FrameRoute.tsx`) draws only its `site` child (UI-P41). Replace each use with its child, then delete the file and its test.
6. **The `Dead code seen` lists** from CA-29 to CA-53: delete each item that `knip` and the route check also clear. List the rest with why they stay.

**Tests:** the whole suite passes; `npm run build` passes; `knip` reports no unused files or packages, except those listed in its config with a reason.

Commit: `CA-54 P1: remove what nothing uses` (the last of the Part 1 commits).

## Part 2 · The first download

1. **Load on first use** each provider from the list above that draws nothing until something opens (a share menu, a reblog window, the upload picker, the quote selection, the collection dialog, the gamification toasts). Keep a tiny always-loaded part that holds the context and its API, and load the rest the first time it is called, or at idle after the first page is ready (CA-31 Part 6).
2. **`ComposeRoute`** keeps only what it needs to choose a screen in the first download (CA-31 and CA-32 changed it; read it as it is).
3. **The Supabase client, the router, TanStack Query and the frame** stay in the first download.
4. **Libraries on `/` used only after an action** (`bundle-defer-third-party`), such as `framer-motion` if Part 0 found it there: load them on first use, the same way as the providers. Don't replace a library in this prompt; if replacing one would help, report what it would take.
5. **Barrels:** change imports from a barrel only where Part 0 showed it costs at least 5 KB compressed on `/`. Import from the file that holds the code, and rename nothing.
6. **Measure again** after each move, and keep only moves that save at least 5 KB compressed on `/`.

**Tests:** each provider still works on first use (open the share menu, the reblog window, the upload picker, the collection dialog); nothing from the list is requested on `/` until used or idle.

Commit: `CA-54 P2: the first download`.

## Part 3 · The composer and the upload page

1. **The composer's windows** load on demand:
   - the prompt window (`FullPromptWindow`);
   - Classification (`SandboxCard`);
   - the Map;
   - Details;
   - the Session window;
   - the import panels;
   - Add from Library (CA-46 made it its own chunk; confirm it still is);
   - the Add menu's less used kinds.
   Keep a split only if it cuts the composer's chunk by at least 5 KB compressed.
2. **Each one is fetched early,** so opening it feels instant:
   - on hover or focus of the control that opens it;
   - for every window, at idle after the composer is ready.
   - It never shows a placeholder when opened after idle, and it opens with the same motion as today.
3. **`Upload` (legacy)** splits off only its heavy libraries, loaded when their step opens. Don't change its behaviour.
4. **Shared code** that both the composer and the build page use goes in one shared chunk, not copied into both.

**Tests:** opening each window after idle requests nothing; opening one before idle shows the window within one frame of its code arriving, with no layout shift.

Commit: `CA-54 P3: the composer and the upload page`.

## Part 4 · Library files that keep their names

1. **Group the libraries into stable chunks** in `vite.config.ts`: React and React DOM, the router, TanStack Query, the Supabase client, and the drag library. Use Vite 8's Rolldown way of grouping chunks (check the installed Vite's documentation in `node_modules`), not Rollup's deprecated `manualChunks` if Rolldown has replaced it.
2. **Check it:** build twice, changing one line of app code in between. Every library chunk keeps its file name.
3. **How the site caches files.** The domain isn't live, so don't fetch it. `netlify.toml` already sets `Cache-Control: public, max-age=31536000, immutable` on `/assets/*`. Find out from the repo and Lovable's hosting whether Lovable serves the site or Netlify does, and so whether those headers apply. If they don't, or you can't tell, put in the report the message Miles would send Lovable to set long caching on `/assets/` and no caching on `index.html`.

Commit: `CA-54 P4: library files keep their names`.

## Part 5 · Fewer, smaller reads

1. **`select("*")`:** replace each one on the paths of these pages with the columns the page uses:
   - Home, Builds (Table, Maps and Classification), OpenBuilds, Library, Drafts, the build page, Profile, Activity, the composer.
   - List the rest in the report.
2. **Exact counts:** each `count: "exact"` that only shows "some" or a rounded number uses `"planned"`, or `"estimated"` where the table is large. Keep exact counts where the number is shown in full. List each one.
3. **Polling:**
   - every `refetchInterval` runs only while its panel is on screen and the tab is visible;
   - `Messages.legacy`'s 5 s poll runs only on that page;
   - list each timer with its interval.
4. **`no-console`:** with the cleanup done, remove the `console.log` and `console.debug` calls left, route `console.error` and `console.warn` through `reportError` (CA-29), and turn the lint rule from a warning into an error, with `report.ts` allowed.

**Tests:** no poll runs in a hidden tab (fake timers and `document.visibilityState`); the pages above make no `select=*` request (a check in `npm run audit:pages`); `npm run lint` passes with `no-console` as an error.

Commit: `CA-54 P5: fewer, smaller reads`.

## Part 6 · Measure again

1. Save `design/audits/size/ca-54-after.md`, with the before numbers beside the after ones.
2. **The targets above must pass.** Add a check to `npm run audit:pages` that fails when the first download goes over 200 KB signed out, or when the composer's own chunk goes over 120 KB, so neither can slip back.
3. **Run the other audits:**
   - `npm run audit:pages`: CA-31's request rounds and CA-32's page change checks still pass;
   - `npm run audit:motion` (CA-34) still passes;
   - `npm run audit:design` shows nothing different;
   - `npm run audit:perf`: LCP, CLS and the INP proxy are no worse than CA-31's after numbers on any route.
4. **Images (report only).** List the `<img>` tags on Home, Builds and the build page that have no `loading="lazy"` and aren't the LCP image (`src` has 142 `<img>` tags and 21 with `loading="lazy"`). Don't change them; they are for a later prompt.
5. **Motion off the scale (report only).** List every literal duration or curve in `src` outside `src/lib/theme/motion.ts` and `src/lib/build/buildMotion.ts` (about 25 at `6b8fe912`, for example `AuthEmailVerificationCard.tsx:65`, `pending-reveal-strip.tsx:44`, `level-up-modal.tsx:132`, `level-ring.tsx:71`, `CoverStrip.tsx:1189`, `IntakeProgress.tsx:98`), with file, line, value, and whether it uses a bounce, `ease-in-out` or a layout or paint property. Don't change them; they are for a later prompt.
6. Search the diff for the em dash character.

Commit: `CA-54 P6: measure again`.

---

## Report (end the session with exactly this)

```
CA-54 · smaller downloads and cleanup
Branch / PR:
Facts in this prompt that were wrong on disk: (list, or "none")
Baseline → end: tests N → N

P0 dist chunk is: (package, used by) · size report from: (visualizer or Rolldown) · framer-motion / recharts on the first page: yes/no each · barrels costing the first page: (list, KB)
P1 files deleted N (by folder) · packages removed: (list) · FrameRoute removed yes/no · Dead code seen items deleted N, kept N (why)
P2 providers and libraries loaded on first use: (list, with KB saved each) · barrel imports changed: (list, or "none")
P3 composer windows on demand: (list, with KB saved each) · Upload split: (what)
P4 stable library chunks yes/no · names kept across a code change yes/no · site caching: (what serves it, which headers apply)
P5 select * replaced N (left: N) · counts changed N · polls: (list) · no-console an error yes/no
Tried and reverted: (list, or "none")
Before → after: first download signed out KB · signed in KB · composer KB · biggest chunks
Targets all passing yes/no (list any that fail, with why)
Other audits passing: pages yes/no · motion yes/no · design yes/no · perf (no Web Vitals regression) yes/no
Images without lazy loading, for later: (list)
Motion off the scale, for later: (list, with file:line)
Parts not done: (list, or "none")
Questions for Miles: (list)
```

**What Miles needs to do** (say it in the report, plainly): merge the pull request and press Publish › Publish changes in Lovable. There are no database changes. If the report says the site's files aren't cached for long, send Lovable the message it gives.
