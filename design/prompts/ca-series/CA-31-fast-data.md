# CA-31 · Fast data: pages show their content as close to instantly as possible

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After CA-30, before CA-32. CA-30 has set the names Builds and OpenBuilds and their routes; this prompt builds the route table on them, keyed by `SITE_NAV` key. CA-32 uses the route table and the page-ready marks this prompt adds, and every page prompt (CA-36 to CA-42) registers its page in them. Read the series README (`design/prompts/ca-series/README.md`) first: its How to work, Motion limits, Performance rules and Database rules apply, and where this prompt says more, this prompt wins. Pull main first. Lovable commits straight to main. Branch `ca-31-fast-data`. Commit at the end of every part with the part number in the message. Open one pull request titled `CA-31 fast data` at the end.

The facts here were checked on 25 October 2026, at `6b8fe912`. **The file on disk wins.** If something here does not match the code, follow the code, do the nearest correct thing, and list the difference in the report. Never invent a table, a column or a policy.

If the session runs short, stop at the end of a finished part with every test green, commit, and report which parts are left.

## How to work

- **Plan first.** End Part 0 by writing two short lists at the top of `design/audits/pages/ca-31-before.md`:
  - `Assumptions`: each fact in "What is slow now" that you checked, and what you found;
  - `Plan`: one line per part, `Part n: what changes -> verified by: which test or audit number`.
- **Measure, then build.** The audit in Part 0 is the judge. Parts 3 and 7 each have a simple step and a heavier one. Build the simple step, run `npm run audit:pages`, and build the heavier one only if its target still fails. Say in the report which you built and the numbers that decided it.
- **Reproduce first.** For every fix, write the test that shows the problem, watch it fail, then fix it.
- **A missing premise is reported, not fixed.** If a cause can't be found or reproduced in the harness, don't guess at a fix. Say so and move on.
- **Surgical.** Every changed line traces to a part of this prompt. Match the style around it. Remove what your own change leaves unused. Dead code you didn't create goes under `Dead code seen` in the report, for CA-54; don't delete it.
- **Questions.** Miles isn't watching the session. Where you would ask, take the safer reading, carry on, and put the question in the report.
- **The domain isn't live yet.** Don't fetch `https://buildgallery.ai`. The harness is the site.

## What is slow now

Measured from a screen recording of the site, and from the code:

| Page | What the maker sees | Why, in the code |
|---|---|---|
| Drafts | About 5 seconds before the list shows | Three requests one after another: `listDraftsWithSessions` (`src/lib/build/drafts.ts`) asks for the session (`auth.getSession`), then `listDraftBuildsByCreator`, then a second read of `builds` for `session_count`. The middle one selects `BUILD_COLUMNS` (about 40 columns, including the large `post_doc` and `making`) for up to 50 drafts, only to show a title, a date and a count. `session_count` is a column on `builds`, so the third request isn't needed. |
| Opening a draft | A few seconds of blank screen, then the page | `ComposeRoute` blanks the whole window (`FALLBACK`) while auth loads and while `getBuild` checks `parent_build_id`. Only after that does the `SandboxPage` chunk start to download (about 210 KB compressed). Then the page asks for its sessions, rows, made-with, thread and six `getNodeType` reads, and then each shown session's prompts. That makes about five rounds in a row. `getBuild` already fetches every node type (`composeRecord` › `getNodeTypes`), so the six reads repeat it. |
| Gallery | Placeholder cards for more than 2.5 seconds | The feed's filters depend on `classification_facets` answering (`classificationLive`, `feedSort`). So the feed is fetched once, then again with a new key when the facets answer, and the first answer is thrown away. Then `getBuildClassifications` and `getBuildTries` run once the feed's ids are known. |
| Library › Saved | A blank panel for 1.6 seconds, then "Something went wrong" | The page's code loads behind a blank `lazyPage` fallback. Then `listMySavedBuilds` makes three rounds: the session, then `build_saves`, then `builds`. The error's cause is unknown. |
| Every signed-in page | A small skeleton first | `ProtectedRoute` waits for `AuthContext`'s `loading`. On first load that waits for `getSession` and then the profile read (`fetchProfile(...).finally(() => setLoading(false))`). |
| Coming back to a page | Placeholders again | `staleTime` is 30 s (`App.tsx`), and `gcTime` is TanStack's default of 5 minutes. Nothing is kept across a reload. Nothing is fetched before the click. |

Also: 25 places call `supabase.auth.getUser()`, and each one is a network round trip to the auth server. `auth.getSession()` reads the stored session with no network.

## Targets

On a built bundle, with every database request delayed by a fixed 120 ms:

- **A page visited before in this visit:** its content in the first frame after the click. No placeholder.
- **A page after a reload:** content within 600 ms (or in the first frame, if Part 7's kept cache is built).
- **A page not visited yet:**
  - Drafts and Library show content within 600 ms of the click;
  - opening a draft shows the build within 900 ms.
- **Request rounds before content:**
  - Drafts: 1;
  - Library › Saved: 1;
  - opening a draft: 2.

## House rules

- No component changes its look. Sentence case, no em dashes.
- New dependencies allowed in this prompt only, and only if Part 7 step 3 is built: `@tanstack/react-query-persist-client`, `@tanstack/query-async-storage-persister` and `idb-keyval`.
- **The database:** never apply a migration yourself. Write the file, make the app work both before and after it is applied, and put the Lovable message in the report.
- **Vercel rules.** If the `react-best-practices` skill (`vercel-labs/agent-skills`) is installed, follow these rule files: `async-parallel`, `async-defer-await`, `async-cheap-condition-before-await`, `bundle-preload`, `client-localstorage-schema`, `js-request-idle-callback`, `rerender-transitions`, `rendering-resource-hints`. Read them for a Vite app: TanStack Query where they say SWR, `React.lazy` where they say `next/dynamic`, and no package they name (`swr`, `better-all`). Ignore the `server-` and `rendering-hydration-` rules.
- **No memo for speed** (`memo`, `useMemo`, `useCallback`) unless a React Profiler trace shows the render as the cost. React Compiler isn't installed.
- Run `npm test`, `npx tsc --noEmit -p tsconfig.app.json` and `npm run lint` before every commit.

---

## Part 0 · Read first, then measure

1. **Read:**
   - `src/App.tsx` (the `queryClient`, the routes);
   - `src/contexts/AuthContext.tsx`, `src/components/ProtectedRoute.tsx`, `src/components/routing/lazyPage.tsx`;
   - `src/pages/site/compose/ComposeRoute.tsx`, `src/hooks/useComposeBuild.ts`, `useComposePage`, `useComposeSessions.ts`, `useComposeThread.ts`, and the `getNodeType` reads in `SandboxPage.tsx` (around lines 360 to 441);
   - `src/lib/build/builds.ts` (`BUILD_COLUMNS`, `getBuildHeader`, `composeRecord`, `listDraftBuildsByCreator`) and `src/lib/build/drafts.ts`;
   - `src/pages/site/drafts/DraftsPage.tsx`, `src/hooks/useLibrarySessions.ts`;
   - `src/pages/site/gallery/GalleryPage.tsx` and `listGalleryFeed`;
   - `src/pages/site/home/HomePage.tsx`;
   - `src/components/library/LibraryBuilds.tsx` and `src/lib/social/saves.ts`;
   - `src/components/shell/FrameLink.tsx`, and the links on build cards, draft rows and Library rows.
2. **Page-ready marks.** Add `usePageReady(name, ready)` in `src/lib/routing/pageReady.ts`. When a page's first screen shows real content, it sets `data-page-ready="<name>"` on `<html>` and calls `performance.mark("page-ready:<name>")`. Use it on:
   - Home, Builds, OpenBuilds, Library (Saved and Collections), Drafts;
   - the composer;
   - the build page (`/b2/:slug`);
   - Profile.
3. **A real-browser page audit,** `e2e/audit/pages.spec.ts`, run by a new script `npm run audit:pages`:
   - It runs against a built bundle: `vite build` then `vite preview`, as `performance.spec.ts` explains with `PERF_BASE_URL`.
   - It answers the database through the audit harness (`e2e/audit/support/harness.ts` and `restFilter.ts`), signed in as `ME`, with a fixed 120 ms delay on every request. Add a draft with three sessions and a saved build to the fixtures if they are missing.
   - For each page above, it records, from the click (or the load) to the page-ready mark:
     - the time;
     - the number of requests;
     - the **request rounds**, meaning the longest chain of requests where each starts after the one before it ended;
     - the bytes of JSON received.
   - It measures three ways: **cold** (empty cache), **warm** (visited earlier in the same visit) and **after a reload**.
   - **Built to grow.** Pages and their targets come from one list in `e2e/audit/support/pageTargets.ts` (`{ key, path, readyMark, maxRounds }`). The page prompts CA-36 to CA-42 add or change their page by adding one entry, with no change to the spec.
   - It runs each measure **3 times and reports the median**, so the time columns are steady enough to read by eye.
4. **Web Vitals.** Run the existing `npm run audit:perf` (`e2e/audit/performance.spec.ts`, BG-P31): LCP, CLS and its INP proxy on three routes in both themes. FID is retired; use INP.
5. Save the numbers as a table in `design/audits/pages/ca-31-before.md`, under the `Assumptions` and `Plan` lists, with the Web Vitals beside them.

Commit: `CA-31 P0: page-ready marks, the page audit and the plan`.

## Part 1 · Signing in doesn't hold pages up

1. **`AuthContext`:**
   - `loading` ends as soon as the stored session is known (`getSession`);
   - the profile loads alongside, with its own `profileLoading`.
2. **`ProtectedRoute`:**
   - waits only for the session;
   - `requireCreator` routes alone also wait for the profile;
   - while waiting, it shows the route's placeholder from the route table (Part 6), not a small centred skeleton. Until Part 6 exists, keep what it shows now.
3. **`ComposeRoute`:** waits only for the session (CA-32 replaces its blank screen).
4. **Reads that run on page load use the session's user id,** from `useAuth()` or `getSession()`, never `auth.getUser()`. Keep `auth.getUser()` only where the server's own answer matters, for example before changing an email. List each of the 25 calls in the report with what it became.
5. **Don't await before you need to** (`async-defer-await`, `async-cheap-condition-before-await`). Where a page-load function awaits the session, a flag or another read before a read that doesn't depend on it, start that read first and await it where it is used.

**Tests:** a protected page renders once the session is known, with the profile still pending; `requireCreator` waits for the profile; no page-load path calls `getUser` (spy).

Commit: `CA-31 P1: signing in doesn't hold pages up`.

## Part 2 · Drafts in one request

1. **`listDraftsWithSessions`** makes one request:
   - `builds.select("id, title, updated_at, session_count")` for the signed-in maker's drafts, newest first, limit 50;
   - the creator id comes from the caller (the session), not a separate `getSession` call inside it.
   - Remove the second `session_count` read.
2. **Light columns where a list is shown.** Add `BUILD_LIST_COLUMNS` (no `post_doc`, no `making`) in `builds.ts`. Use it in the list reads on the pages this prompt measures: drafts, a maker's builds, and any other list read Part 0 finds on those pages. List any other `BUILD_COLUMNS` list read for CA-54. Keep `BUILD_COLUMNS` for opening one build.
3. **Drafts without content aren't made.**
   - Find what creates a `builds` row when New build opens. Every New build visit leaves a draft now: Drafts holds 27, most of them "Untitled build · No sessions".
   - Write the test first: opening New build and leaving writes no row. Watch it fail.
   - Make the row only at the first real content, through `ensureBuild`: a session, a file, a title, or words in the post.
4. **Old empty drafts:** at the foot of Drafts, `Remove empty drafts (N)`, counting drafts with no title, no sessions, no tiles, no files and no post. It runs one delete, behind CA-20's confirm window.
5. **Your sessions** on Drafts keeps loading on its own (`useLibrarySessions`), alongside the drafts and never before them.

**Tests:** one request for the list; no `post_doc` or `making` in it; opening New build and leaving writes no row; the empty-drafts action removes only empty drafts.

Commit: `CA-31 P2: drafts in one request`.

## Part 3 · Opening a draft

Steps 1 to 3 always. Step 4 only if the target still fails after them.

1. **The page's code and its data start together.**
   - `ComposeRoute` starts the `SandboxPage` import the moment the route matches, at the same time as the build read, never after it.
   - Export a `preloadComposer()` for Part 6 to call on hover.
2. **The rebuild check is light.** The check for `parent_build_id` reads `id, parent_build_id` only.
3. **Node types once, and the rest at once.**
   - The six `getNodeType` queries in `SandboxPage` read from the node types the record already holds (`composeRecord` › `getNodeTypes`).
   - Keep the type lookup under one query key, with `staleTime: Infinity`, shared by `getNodeType` and `getNodeTypes`.
   - The page's other first-screen reads (sessions, session rows, made-with, thread, the first six sessions' prompts) start together, as soon as the build id is known, not one after another. Start each as a promise in one place (through `prefetchQuery` or `fetchQuery` on its own key) and let each hook await only its own (`async-parallel`). Don't add `better-all`.
   - **Run the audit.** If opening a draft now takes 2 rounds or fewer and shows within 900 ms, stop here and skip step 4.
4. **Only if step 3 missed the target: one database call.**
   - Write a migration with a function `compose_open(p_build_id uuid)` returning one JSON object:
     - the build header (`BUILD_COLUMNS`);
     - its nodes, tray and events, as `composeRecord` returns them;
     - `build_sessions` and the session rows that `listBuildSessions` and `listBuildSessionRows` return;
     - made-with;
     - the prompts of the first six sessions in List order.
   - Make it `SECURITY INVOKER`, so the tables' own rules decide what the caller can see.
   - The client calls it first. When the function is missing (`PGRST202` or `42883`), it falls back to step 3's parallel reads.
   - The answer fills each existing query key (`setQueryData`), so every hook on the page reads what it reads now, with no second request.
5. **Prompts for the other sessions** load when a session comes within one screen of view (an `IntersectionObserver`), not all at once and not one after another.

**Tests:**
- the chunk import starts before the build read finishes;
- the first-screen reads start together;
- no `getNodeType` request when the record has loaded;
- if step 4 was built: with the function present, opening a draft makes one request; with it missing, the fallback runs; every query key the page reads is filled from the one answer.

Commit: `CA-31 P3: opening a draft`.

## Part 4 · Builds data (the Gallery today)

CA-39 replaces the Gallery's views with the Builds page, and CA-38 moves the feed to Home. So this part changes only the data functions both keep, never the Gallery's or Home's views, whose double fetch goes with them.

1. **Classification and tries with the list.** Columns that are on `builds` come in `listGallery`'s own select, and in `getBuildFeed`'s, rather than through `getBuildClassifications` after it. Tries come in the same request as an embedded count, if the table allows it. If either can't, say so; CA-39 starts it the moment the list answers.
2. **Facets alongside.** `classification_facets` answers `live` now that the CA-16 migration is applied. A caller can start `getClassificationFacets` at the same time as `listGallery` and doesn't need its answer to choose the list's filters: the starting value is the last answer kept in the cache, or `live`.
3. **Keys.** Both functions' query keys follow `['<domain>', '<fn>', ...args]`, so CA-38 and CA-39 prefetch them from the route table.

**Tests:** `listGallery` and `getBuildFeed` return the classification columns in their one request; starting the facets alongside doesn't change the list's answer.

Commit: `CA-31 P4: Builds data functions`.

## Part 5 · Library › Saved

CA-37 redraws Library later; this part fixes the data and the panel error, and CA-37 keeps both.

1. **Find why Saved shows "Something went wrong".** The domain isn't live, so reproduce it in the audit harness. Check `build_saves`' rules, the embed in `withCardEmbeds`, and `gallerySelect(false)`.
   - If it reproduces, write the test that shows it, then fix the cause.
   - If it doesn't, don't guess. Report `not reproduced`, with what you checked, and do steps 2 and 3 only.
2. **One request:** `build_saves.select("created_at, build:builds(<card columns>)")`, using the foreign key, newest first, paged by `created_at`. The user id comes from the session.
3. If a panel still fails, it reads `Saved didn't load` with `Retry` (CA-24 Part 3's panel error), never "Something went wrong".

**Tests:** Saved makes one request; a failed request shows the panel error with Retry; Retry loads it.

Commit: `CA-31 P5: Library Saved`.

## Part 6 · A route table, and fetching on intent

**Ready for the redrawn pages.** CA-36 to CA-42 replace Drafts, Library, Home, Builds and OpenBuilds. Each entry's `load`, `prefetch` and `Placeholder` are plain fields a later prompt can swap without touching the table's code, and a test checks every nav page has all three.

1. **`src/lib/routing/routeTable.ts`:** one entry per page, keyed by its `SITE_NAV` key (`gallery` is `/builds`, `bounties` is `/openbuilds`; CA-30 kept the keys and changed the values), so a later rename changes only a value. Query keys follow `['<domain>', '<fn>', ...args]`. Each entry holds:
   - its path pattern;
   - `load()`, the page's chunk import, the same function the route's `lazy()` uses;
   - `prefetch(params, queryClient)`, which starts the page's first-screen queries (`prefetchQuery` with the same keys and functions the page uses);
   - `Placeholder`, the page's own loading shape (the existing component; no new look).
   App.tsx builds its lazy pages from this table.
2. **Fetch on intent.** On `pointerenter` (after 60 ms), `focus`, `touchstart` and `pointerdown` of a link to a page in the table, call its `load()` and `prefetch()`. Start each one only once per link while it is fresh. Wire it into:
   - `FrameLink`;
   - build cards;
   - draft rows (`preloadComposer` and Part 3's reads);
   - Library rows;
   - profile links.
3. **Fetch when idle.** After the first page is ready (`usePageReady`), in `requestIdleCallback`, load the chunks of Home, Builds, Drafts and Library. When signed in, also load the composer. Skip all of it when `navigator.connection.saveData` is on. `src` doesn't use `requestIdleCallback` yet, and Safari doesn't have it: where it is missing, use a `setTimeout` of 1 ms after the page-ready mark.
4. **Preconnect to the database** (`rendering-resource-hints`). `index.html` has no `preconnect`, so the first request pays for DNS and TLS. Add `<link rel="preconnect" href="<the Supabase URL>" crossorigin>`, built from the same environment value as the client if the build can put it there. If it can't, write the address in and say so. Measure the first request's time before and after.

**Tests:** hovering a Drafts link starts the drafts query and the chunk once; the idle step loads the listed chunks; save-data skips it; with `requestIdleCallback` removed, the idle step still runs; the built `index.html` holds the preconnect.

Commit: `CA-31 P6: route table and fetching on intent`.

## Part 7 · Keep what was fetched

Steps 1 and 2 always. Step 3 only if the after-reload target still fails after them.

1. **Times:**
   - `gcTime` 30 minutes;
   - `staleTime` 60 s for lists (from 30 s now) and 5 minutes for facets, counts and node types;
   - data on screen refreshes quietly behind it, without a placeholder.
2. **Filters and tabs keep the old content** while the new loads (`placeholderData: keepPreviousData`), everywhere a filter or tab changes a query.
3. **Only if a reload still misses 600 ms: keep the cache across a reload,** with `PersistQueryClientProvider` and an IndexedDB persister (`idb-keyval`):
   - Keep only an allow list of query keys: the Home and Builds first pages, facets, Drafts, Library's first pages, build pages' headers, profiles and node types.
   - Never keep the composer's own data, or anything with `making` or `post_doc` in it.
   - Store it per signed-in user, and clear it on sign out.
   - Give it a `CACHE_VERSION` constant that changes only when a kept shape changes.
   - Cap it at 2 MB. Wrap every storage read and write in try/catch, so a private window or blocked storage just means no kept cache.

**Tests:** a warm visit shows content in the first frame; a tab change keeps the old content until the new arrives. If step 3 was built: a reload shows Drafts from the kept cache in the first frame, then refreshes; sign out clears it; the composer's keys are never written; blocked storage doesn't throw.

Commit: `CA-31 P7: keep what was fetched`.

## Part 8 · Database

1. **Indexes:** check that these exist (as written, or covered by another), and add only what is missing:
   - `builds (creator_id, status, updated_at desc)`;
   - `build_saves (user_id, created_at desc)`, which is `idx_build_saves_user_created`;
   - `build_sessions (build_id, position)`.
2. **Access rules that run once per row:**
   - Miles may paste the Supabase performance advisor's findings at the start of the session. If he has, use them.
   - If not, find every policy in `supabase/migrations/` (each one's latest definition) that calls `auth.uid()` or `auth.jwt()` without wrapping it in `(select ...)`.
   - Write one migration that recreates each of those policies with the call wrapped, and otherwise the same logic.
3. **The plan to check.** In each migration's header comment, write the `EXPLAIN (ANALYZE, BUFFERS)` to run once it is applied, for the Drafts read, the Saved read, the `listGallery` read and (if built) `compose_open`, the way `20260829220000_build_feed_bounty_items.sql` and `20260921120000_import_ceilings.sql` already do. Say what the plan should show (the index used, no sequential scan on `builds`).
4. One migration file for this part, plus Part 3's function if it was built. Don't apply either. Put the Lovable message in the report: `Apply supabase/migrations/<file> (and supabase/migrations/<file>) exactly as written. Change nothing else. Then run the performance advisor and list what is left, and run the EXPLAIN in each file's header comment and paste the plans back.`

Commit: `CA-31 P8: database`.

## Part 9 · Measure again

1. Run `npm run audit:pages` and `npm run audit:perf`, and save `design/audits/pages/ca-31-after.md`, with the before numbers beside the after ones and a change column (for example `5,020 ms to 410 ms, down 92%`).
2. **Every target above must pass,** measured before the migrations are applied, and, if `compose_open` was built, with it faked as applied in the harness. If one fails, say why.
3. **No regression elsewhere:** LCP, CLS and the INP proxy are no worse than before on any route.
4. **Keep it enforced.** Make `npm run audit:pages` fail when a request-round target fails, or when a page's request count goes up by more than one over this prompt's after number. Report times without failing on them: a time is checked by eye, a count by the test.
5. Run `npm run audit:design` to confirm that nothing looks different. Search the diff for the em dash character.

Commit: `CA-31 P9: measure again`.

---

## Report (end the session with exactly this)

```
CA-31 · fast data
Branch / PR:
Facts in this prompt that were wrong on disk: (list, or "none")
Baseline → end: tests N → N

P1 pages wait only for the session yes/no · getUser calls left: N (where, why)
P2 drafts in one request yes/no · list reads using light columns: (list) · empty drafts no longer made yes/no · what made them: (cause)
P3 chunk and data start together yes/no · node type reads removed yes/no · reads in parallel yes/no · compose_open built yes/no (the numbers that decided it)
P4 classification in listGallery's and getBuildFeed's select yes/no · facets can start alongside yes/no · tries: (how)
P5 Saved cause: (cause, or "not reproduced": what was checked) · one request yes/no
P6 route table yes/no · intent fetching on: (list) · idle loading yes/no (fallback without requestIdleCallback yes/no) · preconnect: (ms saved on the first request)
P7 times set yes/no · kept cache built yes/no (the numbers that decided it) · keys kept: (list, or "none")
P8 indexes added: (list, or "none") · policies wrapped N · migration files: (names)
Before → after, per page (cold · warm · after reload, medians of 3): ms · requests · rounds · KB · change %
Web Vitals before → after (LCP · CLS · INP proxy): (per route)
Targets all passing yes/no (list any that fail, with why)
Dead code seen: (list, or "none")
Lovable message needed: (the message, in full)
Parts not done: (list, or "none")
Questions for Miles: (list)
```

**What Miles needs to do** (say it in the report, plainly):
1. Merge the pull request and press Publish › Publish changes in Lovable.
2. Send the Lovable message from the report, which applies the indexes and the access rules, and the open-a-draft function if the report says it was built.
3. The site is faster before the message too.
