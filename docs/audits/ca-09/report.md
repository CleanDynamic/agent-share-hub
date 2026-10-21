# CA-09 · Full code audit: slow pages, buttons that do nothing, drafts

Audited on 20–21 October 2026 against `main` at `cc6cc8c` ("Applied 3 migrations & reg. types"). Read-only: no product code, migration, policy, setting or data was changed, and nothing was deployed or merged. Everything this audit added is under `docs/audits/ca-09/` and `src/**/__audit__/`.

Where to find things:

- `report.md`: this report.
- `live-checks.sql`: the read-only SQL for Miles to paste into Lovable (Part 7).
- `lovable-message.md`: the message for Lovable's chat (Part 7).
- `standin.md`: how to start the local stand-in, for the fix sessions.
- `measurements/`: the raw Part 2 and Part 4 numbers (`routes-*.json`, `polling.json`, `keystrokes-*.json`, `drafts-*.json`, `proposal-cost-pglz.json`), `tables.md` (every table below, generated) and screenshots.
- `lighthouse/`: one Lighthouse report per route, HTML and JSON, iPhone profile.
- `actions.csv`, `actions-desktop.json`, `actions-iphone.json`: the Part 3 action table.
- `phone/`: the Part 5 measurements and screenshots, at 430 and 390 wide.
- `raw/`: knip's dead-code report, the catch scan, the RPC and table scans.
- `scripts/`: every script that produced the above.
- Tests: `src/pages/site/drafts/__audit__/DraftsPage.ca09.audit.test.tsx` (6 tests, Part 4), on CA-08's fake, copied to `src/lib/build/__audit__/fakeSupabase.ts`. The browser stand-in is `src/lib/build/__audit__/ca09/`.

---

## 1. For Miles

- **Why the site is slow:** before a page shows anything, a phone has to download and start about a megabyte of code (four seconds on a slow connection), and then the page asks the database for its pieces one after another instead of all at once — and asks for some of them three times — so a page takes 7 to 11 seconds to become usable on a phone and 1 to 3 seconds on a computer.
- **Why buttons do nothing:** the composer's Add menu is taller than the space above the Add button, so its top items (New session, and on a phone Prompt) open above the top of the screen where they cannot be pressed, and Prompt itself does move the cursor to the prompt box but the menu takes it straight back to the Add button, so on any device nothing visible happens.
- **Why drafts don't load:** your drafts themselves now load (tonight's database fix worked for them), but the Drafts page waits for a second list, your waiting sessions, before it shows anything, and if that list is slow or fails it hides your drafts behind "That didn't load." — the checks below will tell us which piece fails on the live site.
- **What to run:** paste `docs/audits/ca-09/live-checks.sql` once into Lovable's SQL editor (it only reads, it changes nothing) and paste `docs/audits/ca-09/lovable-message.md` into Lovable's chat, then send back both answers.
- **The fixes, in order:** first make the Drafts page show your drafts on their own and make every Add item work on a phone and a computer; then make pages faster (fetch things together, read your profile once, sign pictures in one go, send less code up front); then the rest (clear error messages, the Gallery's missing columns, a privacy hole in sign-in, old code and the tests).
- **How long:** about one Claude Code session for the drafts and the buttons, two for speed, and two for the rest — five sessions in all.

---

## 2. Measurements

Before any fix. All on the stand-in (Part 1, `standin.md`): the built site on HTTP/2 with gzip, a fake Supabase that answers from the live schema as `types.ts` now describes it, Miles's shape of data, 120 ms ("normal") or 400 ms ("slow") added to every request. Desktop: Chromium 1280×800, no throttle. iPhone: the iPhone 15 Pro Max profile in Chromium (WebKit cannot be installed here), CPU 4× slower, network on Chrome's "Fast 3G" (562 ms round trip, 1.44 Mbit/s). One run per cell, fresh browser, empty cache: the numbers are a baseline to compare a fix against, not a promise about any one phone.

### T1 · Time to first paint and to usable

First paint / first contentful paint / usable (main content drawn and its main button present and enabled). Medians are not taken: one run each, fresh browser, cold cache.

| Route | iPhone, 120 ms | iPhone, 400 ms | desktop, 120 ms | desktop, 400 ms |
|---|---|---|---|---|
| `/` | 2.7 s / 4.2 s / **6.7 s** | 2.8 s / 4.4 s / **7.2 s** | 0.1 s / 0.3 s / **0.8 s** | 0.1 s / 0.3 s / **1.4 s** |
| `/gallery` | 2.6 s / 4.1 s / **11.1 s** | 2.9 s / 4.5 s / **13.1 s** | 0.1 s / 0.3 s / **3.1 s** | 0.1 s / 0.3 s / **6.4 s** |
| build page (`/b2/ca09-showcase`) | 2.7 s / 4.4 s / **8.5 s** | 2.8 s / 4.3 s / **8.9 s** | 0.1 s / 0.3 s / **1.2 s** | 0.1 s / 0.3 s / **2.3 s** |
| `/drafts` | 2.6 s / 4.2 s / **6.9 s** | 2.9 s / 4.4 s / **7.5 s** | 0.1 s / 0.3 s / **1.2 s** | 0.1 s / 0.2 s / **2.2 s** |
| `/compose/new` | 2.7 s / 4.3 s / **7.7 s** | 2.6 s / 4.4 s / **7.9 s** | 0.1 s / 0.3 s / **0.6 s** | 0.1 s / 0.3 s / **0.4 s** |
| `/compose/:id` (7 steps) | 2.7 s / 5.8 s / **9.3 s** | 3.3 s / 6.6 s / **10.4 s** | 0.1 s / 0.9 s / **1.1 s** | 0.2 s / 2.0 s / **2.3 s** |
| `/compose/:id` (40-picture thread) | 2.7 s / 5.8 s / **9.6 s** | 2.8 s / 6.5 s / **10.1 s** | 0.1 s / 0.8 s / **1.2 s** | 0.1 s / 2.0 s / **2.4 s** |
| profile (`/profile/ana-test`) | 2.8 s / 4.3 s / **8.8 s** | 2.7 s / 4.2 s / **9.5 s** | 0.1 s / 0.3 s / **1.4 s** | 0.1 s / 0.3 s / **3.1 s** |
| `/messages` | 2.6 s / 4.4 s / **10.7 s** | 2.8 s / 4.2 s / **12.2 s** | 0.1 s / 0.3 s / **2.1 s** | 0.1 s / 0.3 s / **5.5 s** |

### T2 · Requests, JavaScript, long tasks and renders (iPhone profile, 120 ms)

API = PostgREST, auth, RPC and storage-sign calls (preflights and the WebSocket left out), within the first 20 s. Rounds = API round trips one after another before the page was usable. JS = JavaScript fetched (gzip, as served). Long tasks = over 50 ms, count / total, first 20 s. Renders = how many times the page's top component and AuthProvider rendered in the first 5 s (desktop, unminified build).

| Route | API calls (before usable) | of which sign-URL calls | API rounds before usable | JS files / KB | long tasks | top component renders | AuthProvider renders | console errors |
|---|---|---|---|---|---|---|---|---|
| `/` | 19 (19) | 0 | 2 | 95 / 374 | 5 / 853 ms (worst 233) | HomePage 7 | 7 | 0 |
| `/gallery` | 19 (19) | 0 | 7 | 99 / 407 | 3 / 506 ms (worst 250) | GalleryPage 1 | 7 | 3 |
| build page (`/b2/ca09-showcase`) | 71 (17) | 41 | 3 | 116 / 464 | 10 / 1412 ms (worst 425) | BuildPage 13 | 7 | 6 |
| `/drafts` | 17 (16) | 0 | 3 | 75 / 310 | 5 / 556 ms (worst 189) | DraftsPage 4 | 7 | 0 |
| `/compose/new` | 15 (9) | 0 | 1 | 105 / 650 | 6 / 941 ms (worst 285) | SandboxPage 6 | 7 | 0 |
| `/compose/:id` (7 steps) | 24 (14) | 0 | 3 | 105 / 650 | 7 / 1185 ms (worst 267) | SandboxPage 12 | 7 | 0 |
| `/compose/:id` (40-picture thread) | 64 (14) | 41 | 3 | 105 / 650 | 9 / 1597 ms (worst 609) | SandboxPage 10 | 7 | 0 |
| profile (`/profile/ana-test`) | 78 (26) | 44 | 4 | 110 / 414 | 6 / 982 ms (worst 272) | ProfilePage 15 | 7 | 9 |
| `/messages` | 27 (27) | 0 | 7 | 100 / 429 | 4 / 661 ms (worst 274) | MessagesPage 7 | 7 | 0 |

### T3 · What each route asks for (desktop, 120 ms, first 8 s)

Each line: method, table or call, and how many times. Repeated reads in bold.

- `/` (20): **POST dm_presence [1 cols] on_conflict ×5**; **GET profiles [17 cols] id ×3**; **GET user_progress [1 cols] user_id ×3**; **HEAD build_reproductions [1 cols] created_at ×2**; HEAD notifications [1 cols] recipient_id&is_read; HEAD builds [1 cols] creator_id&status; POST rpc get_build_feed; HEAD builds [1 cols] status&last_confirmed_at; GET xp_events [3 cols] user_id&reason&created_at; GET streak_days [2 cols] user_id&date; GET build_reproductions [2 cols] user_id&created_at
- `/gallery` (20): **POST dm_presence [1 cols] on_conflict ×5**; **GET user_progress [1 cols] user_id ×3**; **GET profiles [17 cols] id ×3**; **GET builds [1 cols] status&or ×2**; **GET build_reproductions [4 cols] build_id ×2**; **GET builds [47 cols, embeds] status&or&build_nodes.type&build_media.kind&bounties.status&build_nodes.order&build_nodes.limit&build_media.limit&bounties.limit&build_media.order ×2**; HEAD notifications [1 cols] recipient_id&is_read; HEAD builds [1 cols] creator_id&status; POST rpc gallery_facets
- build page (`/b2/ca09-showcase`) (72): **POST storage sign URL ×41**; **POST dm_presence [1 cols] on_conflict ×5**; **GET user_progress [1 cols] user_id ×3**; **GET profiles [17 cols] id ×3**; **GET build_nodes [12 cols] build_id&position ×2**; **GET builds [3 cols] id ×2**; **GET build_likes [1 cols] user_id&build_id ×2**; **GET build_saves [1 cols] user_id&build_id ×2**; HEAD notifications [1 cols] recipient_id&is_read; HEAD builds [1 cols] creator_id&status; GET builds [41 cols, embeds] slug; GET build_events [11 cols] build_id&visibility; GET node_types [10 cols]; GET build_media [13 cols] build_id; GET build_media [15 cols] build_id&post_position; GET build_layers [10 cols] build_id&approved; GET builds [11 cols, embeds] parent_build_id&status; GET builds [1 cols] id; GET bounties [14 cols] build_id; GET follows [1 cols] follower_id&following_id
- `/drafts` (17): **POST dm_presence [1 cols] on_conflict ×5**; **GET profiles [17 cols] id ×3**; **GET user_progress [1 cols] user_id ×3**; **GET import_sessions [9 cols] status ×2**; HEAD notifications [1 cols] recipient_id&is_read; HEAD builds [1 cols] creator_id&status; GET builds [37 cols] creator_id&status; GET builds [2 cols] id
- `/compose/new` (15): **POST dm_presence [1 cols] on_conflict ×5**; **GET profiles [17 cols] id ×3**; HEAD notifications [1 cols] recipient_id&is_read; HEAD builds [1 cols] creator_id&status; GET auth user; GET import_sessions [10 cols] status&proposal; POST rpc gallery_facets; GET node_types [10 cols]; GET profiles [1 cols] id
- `/compose/:id` (7 steps) (25): **POST dm_presence [1 cols] on_conflict ×5**; **GET profiles [17 cols] id ×3**; **GET build_media [15 cols] build_id&post_position ×3**; **GET build_nodes [12 cols] build_id&position ×2**; GET builds [37 cols] id; GET build_events [11 cols] build_id&visibility; GET node_types [10 cols]; HEAD notifications [1 cols] recipient_id&is_read; HEAD builds [1 cols] creator_id&status; GET auth user; GET import_sessions [9 cols] build_id&status; GET import_sessions [10 cols] status&proposal; GET builds [2 cols] id; POST rpc gallery_facets; GET profiles [1 cols] id; PATCH builds [37 cols] id
- `/compose/:id` (40-picture thread) (65): **POST storage sign URL ×41**; **POST dm_presence [1 cols] on_conflict ×5**; **GET profiles [17 cols] id ×3**; **GET build_nodes [12 cols] build_id&position ×2**; **GET build_media [15 cols] build_id&post_position ×2**; GET builds [37 cols] id; GET build_events [11 cols] build_id&visibility; GET node_types [10 cols]; HEAD notifications [1 cols] recipient_id&is_read; HEAD builds [1 cols] creator_id&status; GET auth user; GET import_sessions [9 cols] build_id&status; GET import_sessions [10 cols] status&proposal; GET builds [2 cols] id; POST rpc gallery_facets; GET profiles [1 cols] id; PATCH builds [37 cols] id
- profile (`/profile/ana-test`) (79): **POST storage sign URL ×44**; **POST dm_presence [1 cols] on_conflict ×5**; **GET user_progress [1 cols] user_id ×3**; **GET profiles [17 cols] id ×3**; **POST rpc maker_stats ×2**; **GET solutions [1 cols] solver_id&status ×2**; **GET builds [44 cols, embeds] creator_id&status&build_nodes.type&build_media.kind&bounties.status&build_nodes.order&build_nodes.limit&build_media.limit&bounties.limit ×2**; **GET builds [3 cols] id ×2**; **GET build_likes [1 cols] user_id&build_id ×2**; **GET build_saves [1 cols] user_id&build_id ×2**; HEAD notifications [1 cols] recipient_id&is_read; HEAD builds [1 cols] creator_id&status; GET profiles [17 cols] username; GET profile_stats [3 cols] user_id; GET follows [1 cols] follower_id&following_id; HEAD builds [1 cols] creator_id&status&parent_build_id; HEAD build_reproductions [1 cols] user_id&worked; GET user_progress [6 cols] user_id; GET streak_days [2 cols] user_id&date; GET user_badges [1 cols] user_id&badge_key; GET collections [13 cols] owner_id&is_public; POST rpc get_visible_surfaces
- `/messages` (28): **POST dm_presence [1 cols] on_conflict ×5**; **HEAD dm_messages [1 cols] thread_id&sender_id&sent_at ×4**; **GET profiles [17 cols] id ×3**; **GET user_progress [1 cols] user_id ×3**; **GET dm_thread_members [5 cols] user_id ×2**; **GET dm_threads [17 cols] or ×2**; **GET follows [1 cols] follower_id&following_id ×2**; **GET profiles [4 cols] id ×2**; **GET dm_messages [10 cols] thread_id ×2**; HEAD notifications [1 cols] recipient_id&is_read; HEAD builds [1 cols] creator_id&status; GET dm_threads [6 cols] or

### T4 · Lighthouse, iPhone profile (DevTools throttling: 4× CPU, Fast 3G)

| Route | Score | FCP | LCP | Speed Index | TBT | CLS | Requests | Transfer |
|---|---|---|---|---|---|---|---|---|
| `/` | 63 | 4.1 s | 5.7 s | 4.8 s | 239 ms | 0.001 | 138 | 560 KB |
| `/gallery` | 65 | 4.1 s | 5.7 s | 6.6 s | 13 ms | 0.001 | 141 | 522 KB |
| build page (`/b2/ca09-showcase`) | 37 | 4.3 s | 8.6 s | 11.1 s | 893 ms | 0.001 | 301 | 7358 KB |
| `/drafts` | 46 | 4.3 s | 7.2 s | 4.9 s | 215 ms | 0.305 | 116 | 497 KB |
| `/compose/new` | 53 | 4.1 s | 7.6 s | 5.7 s | 404 ms | 0 | 139 | 769 KB |
| `/compose/:id` (7 steps) | 40 | 5.8 s | 9.3 s | 7.6 s | 641 ms | 0.095 | 161 | 841 KB |
| `/compose/:id` (40-picture thread) | 36 | 5.9 s | 9.5 s | 13.1 s | 861 ms | 0.026 | 279 | 7478 KB |
| profile (`/profile/ana-test`) | 45 | 4.1 s | 16.2 s | 7.9 s | 566 ms | 0.024 | 276 | 1541 KB |
| `/messages` | 65 | 4.1 s | 6.1 s | 5.2 s | 137 ms | 0.001 | 158 | 548 KB |

### T5 · Polling: requests while the page sits open (desktop, 120 ms)

| Route | Requests per minute, visible | While hidden (30 s) | In the 5 s after coming back | What repeats |
|---|---|---|---|---|
| `/` | 2 | 3 | 12 | POST dm_presence ?on_conflict ×2 |
| `/gallery` | 1 | 2 | 12 | POST dm_presence ?on_conflict ×1 |
| build page (`/b2/ca09-showcase`) | 1 | 2 | 6 | POST dm_presence ?on_conflict ×1 |
| `/drafts` | 7 | 2 | 10 | GET import_sessions ?status ×6; POST dm_presence ?on_conflict ×1 |
| `/compose/new` | 7 | 2 | 7 | GET import_sessions ?status&proposal ×6; POST dm_presence ?on_conflict ×1 |
| `/compose/:id` (7 steps) | 7 | 2 | 8 | GET import_sessions ?status&proposal ×6; POST dm_presence ?on_conflict ×1 |
| profile (`/profile/ana-test`) | 1 | 2 | 6 | POST dm_presence ?on_conflict ×1 |
| `/messages` | 1 | 2 | 22 | POST dm_presence ?on_conflict ×1 |

### T6 · One keystroke in the composer (7-step draft; 20 letters typed)

| Profile | Where | Renders per letter | Worst key event | Key events over 50 ms |
|---|---|---|---|---|
| desktop | add-prompt field | SourcesPanel 1, PostTab 1, DetailsPanel 1 | 16 ms | 0 of 20 |
| desktop | post editor | SandboxPage 0.1, SandboxView 0.2, SourcesPanel 1.6, PostTab 0.2, BuildList 1.6, DetailsPanel 1.6 | 32 ms | 0 of 20 |
| iphone | add-prompt field | PostTab 1 | 40 ms | 0 of 20 |
| iphone | post editor | SandboxPage 0.1, SandboxView 0.1, PostTab 0.1, BuildList 0.1 | 72 ms | 4 of 20 |

### T9 · Phone layout, per route (Part 5; 430 / 390 wide)

| Route | Points left for the page (of 739 / 664) | Bars | Touch targets under 44 | Desktop words | Text off the 22/18/15/13/11 scale | Gaps off 4/8/16/32 | Text left edge (most common) | Buttons drawn at 36 |
|---|---|---|---|---|---|---|---|---|
| `/` | 634 / 559 | top 32, top 48, bottom 57 | 10 of 37 | none | 123 of 145 (10.5px ×42, 12px ×28, 12.5px ×23) | 176 (6 ×104, 12 ×50, 2 ×18) | 23 ×52, 53 ×20 | 5 of 10 |
| `/gallery` | 634 / 559 | top 32, top 48, bottom 57 | 7 of 15 | none | 7 of 9 (12px ×5, 14px ×1, 20px ×1) | 26 (2 ×10, 6 ×10, 12 ×6) | 23 ×4, 12 ×1 | 4 of 7 |
| build page (`/b2/ca09-showcase`) | 634 / 559 | top 32, top 48, bottom 57 | 11 of 81 | none | 97 of 129 (12.5px ×23, 12px ×19, 14px ×14) | 166 (12 ×98, 2 ×46, 6 ×16) | 23 ×26, 40 ×17 | 4 of 70 |
| `/drafts` | 634 / 559 | top 32, top 48, bottom 57 | 11 of 36 | none | 26 of 57 (12px ×21, 14px ×4, 24px ×1) | 122 (2 ×46, 9 ×38, 1 ×14) | 43 ×32, 67 ×10 | 0 of 11 |
| `/compose/new` | 568 / 493 | top 32, top 48, floating 66, bottom 57 | 3 of 30 | "Click a prompt to see its details · doub" | 16 of 24 (12.5px ×10, 12px ×2, 14px ×1) | 42 (12 ×20, 2 ×10, 6 ×8) | 23 ×6, 12 ×1 | 0 of 22 |
| `/compose/:id` (7 steps) | 568 / 493 | top 32, top 48, floating 66, bottom 57 | 15 of 51 | "Click a prompt to see its details · doub" | 40 of 51 (12px ×13, 11.5px ×8, 14px ×7) | 62 (12 ×32, 2 ×16, 6 ×10) | 106 ×7, 23 ×5 | 0 of 37 |
| `/compose/:id` (40-picture thread) | 568 / 493 | top 32, top 48, floating 66, bottom 57 | 2 of 168 | "Click a prompt to see its details · doub" | 12 of 89 (12.5px ×6, 12px ×2, 14px ×1) | 80 (6 ×48, 12 ×18, 2 ×10) | 71 ×20, 80 ×10 | 0 of 159 |
| profile (`/profile/ana-test`) | 634 / 559 | top 32, top 48, bottom 57 | 10 of 40 | none | 48 of 54 (12px ×16, 11.5px ×12, 10.5px ×7) | 129 (3 ×46, 6 ×46, 2 ×10) | 34 ×14, 40 ×7 | 8 of 28 |
| `/messages` | 634 / 559 | top 32, top 48, bottom 57 | 6 of 17 | none | 13 of 20 (12px ×5, 9px ×4, 14px ×2) | 20 (2 ×10, 6 ×6, 9 ×2) | 79 ×5, 212 ×3 | 0 of 9 |

Part 5 in short (`phone/phone-430.json`, `phone/phone-390.json`, screenshots in `phone/`): no field under 16 px (no zoom on focus); no horizontal scroll on any route; the frame uses `100dvh` and `env(safe-area-inset-*)` (`SiteFrame.tsx:154, 190`, `Dock.tsx:68`), though the stylesheet still carries 7 `100vh` rules (Tailwind `h-screen`/`min-h-screen` classes) and 5 `dvh` ones; the bars and the spacing method are in F12 and F13.

### What the numbers say, cause by cause

Each cause with its evidence; the findings in section 5 carry the fixes.

**1. Four seconds of JavaScript before the page draws anything (Proved).** On the iPhone profile, first contentful paint is 4.1–4.4 s on every route that is not the composer, and 5.8 s on a draft (T1). No API request is sent before 4.1 s on any route (`routes-iphone-normal.json`, `timeline`). What happens first:

- `index.html` names 60 modulepreloads plus the entry chunk: **1,027 KB raw, 308 KB gzip (266 KB brotli) before the first route chunk** (`dist/index.html`; measured on the stand-in's build). That is about 1.7 s of transfer on Fast 3G before latency, then parsing at 4× CPU.
- What is in it (source maps, `source-map-explorer`): `react-dom` 178 KB, `@supabase/auth-js` 85 KB, `src/lib/build` 49 KB (gallery.ts, signals.ts, making.ts, imports.ts, intake.ts, sessions.ts, builds.ts …), `sonner` 32 KB, `@tanstack/query-core` 31 KB, `realtime-js` + `phoenix` 51 KB, `src/lib/theme` 26 KB, the shell 24 KB, `App.tsx` 20 KB, `tailwind-merge` 20 KB, `src/lib/tools/registry.ts` 17 KB and `src/lib/models/registry.ts` 14 KB, the reblog sheet 16 KB, `react-helmet-async` 14 KB, `@floating-ui/react` 13 KB, two toast systems (Radix toast 10 KB *and* sonner).
- **Not** in the first load: Monaco (only in the legacy `Upload` chunk, and it loads its editor from a CDN at run time), Recharts (not bundled at all: nothing imports it), `@lobehub/icons-static-svg` (SVG files by URL from `ModelMark`), `@xyflow` (legacy `Upload` only), highlight.js (the `hooks` chunk, 159 KB, loaded by none of the audited routes), the legacy screens.
- The four big chunks the prompt names: `index` = the entry (above); `dist-BxGbpp9R` (375 KB) = TipTap and ProseMirror, loaded by every `/compose` route; `hooks` (213 KB) = highlight.js for the legacy article editor; `client` (184 KB) = supabase-js (auth-js 85, realtime 51, storage 20, postgrest 15).
- Each route then downloads 75–116 JavaScript files, 310–650 KB gzip in all (T2). The composer is the heaviest: 650 KB, of which SandboxPage 85 KB and TipTap 116 KB gzip.
- Lazy routes: every page is `lazy()` (`App.tsx:31-141`). Eager: `Layout`, `FrameRoute`, `SiteFrame`, `ComposeRoute`, `SignInRoutes` and the providers `ShareMenuProvider`, `ReblogComposeProvider`, `UploadPickerProvider`, `QuotableSelectionProvider`, `AddToCollectionHost`, `PresenceProvider`, `ConnectionBanner`, plus both `<Toaster />` and `<Sonner />` (`App.tsx:5-29, 202-215`). The reblog, share, upload-picker and quoting providers serve legacy features and pull their sheets into every first load.

**2. Waterfalls: each page waits for one round trip after another (Proved).** On the phone each round trip costs about 0.7 s (Fast 3G's 562 ms plus the 120 ms server). From the iPhone timelines (`routes-iphone-normal.json`):

- **Drafts** (usable at 6.9 s): JavaScript until 4.3 s → the sign-in round (profile, presence, progress, notifications) 4.37–5.1 s → the three Drafts reads 5.28–6.0 s → **the draft counts, a second builds read that waits for the first** 6.02–6.72 s (`drafts.ts:45-58`: `listDraftBuildsByCreator`, then `select id, session_count … in (ids)`; `session_count` is simply not in `BUILD_COLUMNS`, `builds.ts:28-29`).
- **A draft** (`/compose/:id`, usable at 9.3 s): JavaScript until 4.1 s → `getBuild` reads the header (4.15–4.86 s) → **then** the tree, tray, events and node types (4.88–5.62 s; `builds.ts:164-168`, `composeRecord`) → **only then does the browser start fetching the composer itself** (SandboxPage and TipTap, 5.67–8.56 s), because `ComposeRoute` renders the lazy `SandboxPage` only after its build check has answered (`ComposeRoute.tsx:68-80`) → the composer's own reads. The 300 KB composer download could have run alongside the two build reads.
- **The auth lock (Proved).** `supabase.auth.getUser()` holds supabase-js's auth lock for a whole network round trip (`node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:2447-2454`), and every REST request asks `auth.getSession()` for its token, which waits on that lock (`supabase-js/dist/index.cjs:519-524`). In the composer, `getColourSwatches` calls `getUser()` on load (`src/lib/profile/colourSwatches.ts:62`): the timeline shows `GET /auth/v1/user` 9.27–9.97 s and the next seven reads all starting 9.98–10.0 s, one full round trip later. 25 places in `src/` call `getUser()` (`grep`), each one a stall like this.
- **Gallery and Messages** need 6–7 rounds (T2): the Gallery's feed read fails and is retried (cause 6), Messages reads threads, then members, then profiles, then messages, one after another.

**3. Every page re-reads the same things at start (Proved).** On every route, desktop and phone: **`profiles` 3 times, `user_progress` 3 times, `dm_presence` written 5 times** in the first seconds (T3).

- `AuthProvider` fetches the profile from both `onAuthStateChange` and `getSession()` (`AuthContext.tsx:59-79`), and sets a new `session` object each time.
- `usePresence` (`usePresence.ts:16-51`) and `useWelcomeXp` (`useWelcomeXp.ts:16-35`) depend on the `user` object, which is a new object on every auth event, so each event re-runs them: presence writes offline then online, and the welcome check reads again.
- `AuthProvider`'s context value is a new object on every render (`AuthContext.tsx:90-100`, no `useMemo`), so every `useAuth()` consumer re-renders with it: AuthProvider rendered **7 times in the first 5 s** on every route (T2).
- Presence also writes on every `focus` and every `blur` of the window (`usePresence.ts:25-33`).

**4. Polling (Proved; numbers in T5).**

| What | Where | Every | Hidden tab |
|---|---|---|---|
| `useWaitingSessions` (`refetchInterval: 10_000`, `refetchOnWindowFocus: "always"`, `refetchOnMount: "always"`) | Drafts | 10 s, and every focus | paused; reads again on return |
| `useLibrarySessions` (same three) | composer (Your sessions) | 10 s, and every focus | paused; reads again on return |
| `ThreadView` presence (`refetchInterval: 30000`) | Messages, open thread | 30 s | paused |
| `usePresence` heartbeat (`setInterval` 60 s, skipped when hidden) and focus/blur writes | every page, signed in | 60 s + every focus and blur | one write on hide, one on return |
| App default: no `staleTime` (`App.tsx:178-182`) | every query on every page | every window focus refetches every query on screen | on return, all of them |
| `Messages.legacy.tsx:506` (`refetchInterval: 5000`) | **nowhere**: the file is not routed (`App.tsx:54` imports `./pages/Messages`) | – | – |

On a phone, switching to another app and back is a hide and a show: every stale query on the page is read again at once (6–22 requests in the next 5 s, T5: 22 on Messages, 12 on Home and the Gallery, 10 on Drafts), presence writes four times, and the session lists re-read their `proposal` paths. While hidden, TanStack pauses the polls (it checks `document.visibilityState`) and only presence writes.

**5. Heavy reads (Proved for the code; Likely for their live cost).**

- `SESSION_COLUMNS` (`sessions.ts:81-85`) extracts three JSON paths from `proposal`. Measured on Postgres 16 with the migration's own table, index and RLS (`scripts/proposal-cost.mjs`, `measurements/proposal-cost-pglz.json`), with 20 sessions holding 14 MB of proposal: the composer's library read takes **13.7 ms** against **0.5 ms** for the same rows without the paths, so about **1 ms per MB of proposal returned**, hot cache, and three paths cost the same as one. That is real work repeated every 10 s per open tab, but nowhere near an 8 s timeout on this machine.
- Response bodies: `first_prompt` returns event 0's whole text, untrimmed (the client cuts it to `FIRST_PROMPT_MAX`, `sessions.ts:117`): 11–34 KB per poll here; a pasted first prompt makes it larger.
- **The prompt's "1 to 5 MB" proposals are larger than the importer allows.** The connector refuses an import over 400,000 characters (`supabase/functions/mcp/constants.ts:88`, and the `total_chars <= 400000` check in `20260917120000_import_sessions.sql`). The stored envelope repeats each prompt in `events` and in `nodes`, so a proposal can reach roughly 1–1.5 MB of JSON; 5 MB would need more than the ceiling. The stand-in kept the prompt's sizes; `live-checks.sql` row S reports the real largest.
- `BUILD_COLUMNS`: 37 columns on every builds read and write, including `post_doc` (up to 200 kB per row, `20261016120000_post_threads.sql:35`) on the Drafts list, which shows a title and a date. 16 drafts with post documents is up to 3.2 MB for a list of titles.
- `select('*')`: 102 calls in `src/` (Admin 10, CreatorProfile 6, progress 6 …; none on the audited routes' main reads).
- **Pictures are signed one request at a time (Proved).** `signedMediaUrl` (`media.ts:387-402`) makes one `POST /storage/v1/object/sign/…` per picture: **41 on the build page, 41 on the 40-picture draft, 44 on a profile** (T2). Storage has a batch call (`createSignedUrls`) that does them in one.

**6. Requests that fail on the live schema (Proved against `types.ts`; Likely live).** The stand-in answers from `types.ts`, which Lovable regenerated from the live database tonight. On it:

- `/gallery` never shows a build: `listGalleryFeed failed: column builds.like_count does not exist` (400 42703), retried once, then "didn't load" at 3.1 s desktop, 11.1 s phone. This is CA-08's F3, still open: `rc_build_social` is not applied.
- The build page and profiles call tables and functions the live schema does not have: `build_likes` and `build_saves` (404 PGRST205), `maker_stats` (404 PGRST202), and `builds [id, like_count, comment_count]` (400 42703) — 6–9 console errors per page (T2). `scan-rpcs.mjs` lists everything the client calls that `types.ts` lacks: 6 RPCs (`maker_stats`, `maker_build_metrics`, `rebuild_tree`, `resolve_report`, `search_build_ids`, `top_solvers`) and 9 tables (`build_comments`, `build_likes`, `build_saves`, `content_reports`, `saved_items`, `blocks`, `block_connections`, `stages`, `canvas_versions`), `raw/rpcs.csv`, `raw/tables-missing.csv`.

**7. Renders (Proved; T2, T6).** The composer's top component rendered 6–12 times in its first 5 s; BuildPage 13; ProfilePage 15. A letter typed in the add-prompt field re-renders PostTab, SourcesPanel and DetailsPanel once each; a letter in the post editor re-renders BuildList, SourcesPanel and DetailsPanel 1.6 times each. On the phone profile 4 of 20 key events took over 50 ms (worst 72 ms). This is waste, not the cause of the slowness Miles sees.

**8. Images and fonts (Proved).** Thread and card pictures are `loading="lazy" decoding="async"` with stored sizes (`GridTile.tsx:148-155`, `renderers/shared.tsx:316`), and there is almost no layout shift except on Drafts (CLS 0.305 on the phone: the Sessions panel's skeleton is shorter than the list, Lighthouse `layout-shifts`). The font is self-hosted and preloaded (`index.html`). Lighthouse's 7.4 MB transfer on the two 40-picture pages is its full-page screenshot loading every lazy picture at the stand-in's full size; in real use the 41 sign requests are the cost, plus 16–36 pictures fetched in view.

**9. Double retry (Proved, CA-08 F10).** postgrest-js retries a GET three times on a network error or a 503/520 (`postgrest-js/dist/index.cjs:17-29, 96-99`), under App's one TanStack retry. A 500 (such as 57014) is not retried by postgrest-js, only by TanStack: two statements.

---

## 3. Every action

### T7 · Every action (desktop / iPhone profile)

ms = from the press to the first change on screen that is not just focus landing on the control (a menu, a dialog, a new step, the address changing, text). Works ≤ 300 ms with the expected result; Slow > 300 ms; Silent = something happened (a request, a focus) but nothing the maker can see; Broken = nothing, or it cannot be pressed.

| Where | Control | Should | Desktop | iPhone | What happens |
|---|---|---|---|---|---|
| Composer | Add (open the menu) | open the Add menu | Works 77 ms | Slow 304 ms | iphone: appeared: div:M(What did you build?Add another postAa |
| Composer › Add | New session | open the New session dialog | Broken | Works 239 ms | desktop: cannot be pressed: the row is outside the screen |
| Composer › Add | Prompt | put the cursor in the add-prompt field, on screen, keyboard up | Broken | Broken | desktop: focus went back to the Add button; iphone: focus went back to the Add button |
| Composer › Add | Agent or team | open the agent dialog | Works 57 ms | Works 283 ms |  |
| Composer › Add | File | open the file picker | Works | Works |  |
| Composer › Add | Tool | open the tool dialog | Works 57 ms | Works 279 ms |  |
| Composer › Add | Manual step | open the manual step dialog | Works 57 ms | Slow 329 ms | iphone: appeared: div: |
| Composer › Add | Code | open the code dialog | Works 63 ms | Works 263 ms |  |
| Composer › Add | Check | open the check dialog (or be shown disabled) | Works 53 ms | Works 273 ms |  |
| Composer › Add | Result | add a Result step and select it | Slow 330 ms | Silent 556 ms | desktop: appeared: div:ResultSummaryUntitled resultWhat it isA linkA pictureA fileA; iphone: focus went back to the Add button |
| Composer › Add | Session (submenu) | open the list of waiting sessions | Works | Works 201 ms |  |
| Composer › Add (new post) | Prompt | put the cursor in the add-prompt field, on screen | Broken | Silent | desktop: focus went back to the Add button; iphone: focus went back to the Add button |
| Composer › Add (new post) | Result | make the draft, add a Result step | Slow 326 ms | Slow 979 ms | desktop: url: /compose/34196cfc-3365-4357-9691-533763b2b947; iphone: url: /compose/4b3a48a6-b944-4da3-8d6a-41a0898c4b10 |
| Composer › Add (new post) | New session | open the New session dialog | Broken | Broken | desktop: cannot be pressed: the row is outside the screen; iphone: cannot be pressed: the row is outside the screen |
| Composer | List / Map: Map | show the map | Works 65 ms | Not reached | iphone: locator.waitFor: Timeout 8000ms exceeded. |
| Composer | Select a prompt (tap the card) | select it and show its details | Works 28 ms | Works 162 ms |  |
| Composer | Step menu (…) | open the step's menu | Works 89 ms | Works 269 ms |  |
| Composer | Step menu › Read all of it | open the whole prompt | Works 87 ms | Works 246 ms |  |
| Composer | Step menu › Rename | turn the title into a field | Works 84 ms | Works 295 ms |  |
| Composer | Card | open the card editor | Works 71 ms | Works 298 ms |  |
| Composer | Preview | show the preview | Works 96 ms | Slow 426 ms | iphone: appeared: div: |
| Composer | Publish | publish, or say what is missing | Works 41 ms | Works 179 ms |  |
| Composer | Missing: a cover picture (link) | take you to the cover | Works 46 ms | Works 161 ms |  |
| Post editor | Type in post 1 | put the cursor in the post and show the letter | Silent | Slow 432 ms | desktop: focus (hidden): div[The thread] top=-1 bottom=25 vh=800 covered by a; iphone: text: Sort on nothing thxe it label to the with plan it lines arri |
| Post editor | What did you build? (first post) | put the cursor in the post | Works | Works |  |
| Post editor | Add another post | start a second post | Works 37 ms | Works |  |
| Post editor › toolbar | Picture | open the file picker | Works | Works |  |
| Post editor › toolbar | Bulleted list | make a list | Works 35 ms | Works 144 ms |  |
| Post editor › toolbar | Text size (Aa) | open the text size menu | Works 31 ms | Works 162 ms |  |
| Post editor › toolbar | @ (reference) | open references | Works 39 ms | Works 269 ms |  |
| Post editor › toolbar | Add to the post (+) | open what can be added | Works 36 ms | Works |  |
| Drafts | Open a draft | open it in the composer | Works 51 ms | Works 123 ms |  |
| Drafts | Start a new build | open a new post | Works 73 ms | Works 203 ms |  |
| Drafts | Connect a tool | open the connector guide | Works 93 ms | Works 255 ms |  |
| Drafts | Session › its menu | offer Start a build / Add to a draft / Remove | Works 72 ms | Works 265 ms |  |
| Drafts | Show N already in a build | list the sessions already in builds | Works 49 ms | Works 143 ms |  |
| Build page | Copy for AI | copy, and say so | Works | Works |  |
| Build page | Rebuild | start a rebuild | Works 48 ms | Works 173 ms |  |
| Build page | Second tab | switch tab | Works 31 ms | Works 207 ms |  |
| Build page | Like / me too | count it | Works 33 ms | Works 104 ms |  |
| Header | Home | go to Home | Works 45 ms | – |  |
| Header | Gallery | go to Gallery | Works 46 ms | – |  |
| Header | Bounties | go to Bounties | Works 45 ms | – |  |
| Header | Library | go to Library | Works 44 ms | – |  |
| Header | Drafts | go to Drafts | Works | – |  |
| Header | New build | open a new post | Works 57 ms | – |  |
| Header | Search | open search | Works | Works 201 ms |  |
| Header | Account (avatar) | open the account menu | Works 85 ms | Works 229 ms |  |
| Composer | Sources | show Sources | – | Slow 401 ms | iphone: appeared: div: |
| Composer | Details | show Details | – | Slow 302 ms | iphone: appeared: div: |
| Bottom tabs | Home | go to Home | – | Works 165 ms |  |
| Bottom tabs | Gallery | go to Gallery | – | Works 166 ms |  |
| Bottom tabs | New | go to New | – | Works 254 ms |  |
| Bottom tabs | Bounties | go to Bounties | – | Works 157 ms |  |
| Bottom tabs | Activity | go to Activity | – | Works 137 ms |  |

Notes on the table: the iPhone "New session" row on a draft reads Works only because Playwright scrolls an element into view programmatically, which Radix's scroll lock does not stop; a finger cannot (the probe, `add-menu-probe-iphone.txt`, shows the row at −80…−34 with the menu open). "Type in post 1" on the desktop is a measurement artefact (the click landed mid-editor, under the header); typing itself works on both profiles (T6). The Map toggle is not offered on a phone. The raw rows, with every change seen and every request made, are in `actions-desktop.json`, `actions-iphone.json` and `actions.csv`.

The causes, checked one by one:

- **Focus from an effect, then taken back (Proved, both profiles).** Add › Prompt calls `onAddPromptFocus` (`SandboxPage.tsx:255-258`), which bumps `focusAdd`; `AddPrompt`'s effect then focuses the field (`BuildList.tsx:1526-1528`). But the item is in a Radix dropdown, and when the dropdown closes Radix returns focus to its trigger (no `onCloseAutoFocus` on the Add menu, `SandboxView.tsx:244`). The probe (`measurements/add-menu-probe-*.txt`) reads `document.activeElement` at 0, 50, 200, 600 and 1500 ms after the press: **the Add button every time, page not scrolled.** Nothing moves, on the desktop too. On an iPhone, even a focus that stuck would open no keyboard: Safari only raises it for a `focus()` inside the tap's own handler, and this one runs in an effect after a render (Likely: WebKit could not be run here). The same pattern is in `onMissing` (`SandboxView.tsx:525-531`: "a prompt" in the Missing line), `DetailsPanel.tsx:709-712`, `SessionsPanel.tsx:132-133`, `PromptsPanel.tsx:123-124`, `ReferencePicker.tsx:113-114`, `PostToolbar.tsx:395-396` and `FormatBar.tsx:208-209` (all `useEffect(() => field.focus())`).
- **A menu taller than the room above its button (Proved).** The Add menu has ten 46-pt rows (about 470 pt). `menuSurface` (`refinedStyles.ts:126-135`) sets no `maxHeight` and no `overflowY`, so when Radix flips the menu above the button it runs off the top of the screen: **New session is at −59 to −13 on the desktop and −80 to −34 on the phone; Prompt at −34 to 12 on the phone, under the header** (`add-menu-probe-*.txt`, `measurements/screens/add-menu-open-iphone.png`). Radix's modal menu locks page scrolling while it is open, so those rows cannot be reached at all. "New session" is the first item of the menu and the way to start a session.
- **A new step added off-screen (Proved on the phone).** Add › Result writes the step and selects it, but nothing scrolls to it; on the phone it lands below the fold and the press reads as nothing (Silent in T7).
- **Content under the fixed bars (Proved).** On the phone the composer keeps 568 of 739 pt (77%): header 48, dock 57, and the sticky Card/Preview/Publish bar 66 (`SandboxView.tsx:749-750`). `focus()` scrolls a field to the edge of the viewport, not above sticky bars, and nothing sets `scroll-padding`; the add-prompt field at the end of the list sits under the Publish bar (`measurements/screens/iphone-normal-compose-new.png`).
- **Taps swallowed:** none found. `cursor: pointer` is set on the clickable cards (`BuildList.tsx:770`); the toolbar's `onMouseDown={preventDefault}` (`PostToolbar.tsx:280, 342`) keeps the editor's selection and still fires `click`; there are no hover-only menus on these screens; dnd-kit's sensors are on the grip only, with a 250 ms touch delay (`listNest.tsx:92-95`); no transparent layer covered a pressed control (the `covered` field is empty for every row in `actions-*.json`). The "Edit with Lovable" badge is added by Lovable's hosting and is not in the stand-in (CA-08 F12).
- **Body left un-clickable after a menu opens a dialog** (the known Radix `pointer-events: none` bug): not seen; `bodyPointerEvents` was `auto` after every action.
- **Awaits with no pending state (Proved by code; Likely visible).** On a new post every add first awaits `ensureBuild()` (`SandboxPage.tsx:434, 454, 482, 509, 528, 549, 792, 823, 858, 929, 970`), which makes the draft (one round trip), navigates, then writes the step (another). Nothing is drawn meanwhile: on the phone the first change (the address) came 979 ms after the press (Slow for Result on a new post, T7).
- **Errors swallowed:** see Part 6. On these screens the session reads and the header save show nothing on failure (CA-08 F4, F6 still open).
- **Disabled states:** Check is disabled until the build has an agent, team or code, and says so ("Add an agent or code first"); correct.

---

## 4. Drafts

**The cause, as far as the repository and the stand-in can show it: the Drafts page shows nothing until all three of its reads have answered, and one of them — the waiting-sessions read of `import_sessions` — is the one most likely to be slow or to fail live. When it fails, the drafts that did load are hidden behind "That didn't load."** (Proved on the stand-in; which read fails live is decided by the live checks.)

What was ruled out:

- **The drafts read itself works on tonight's schema (Proved).** `types.ts` now has `builds.post_doc`; with it, the real `DraftsPage` lists every draft (`DraftsPage.ca09.audit.test.tsx`, "control"), and in the browser the first draft is drawn at 1.2 s desktop, 7.0 s phone (T8). CA-08's cause (a missing `post_doc`) is gone from the schema.
- **`proposal` size alone does not time the read out (Proved locally, Likely live).** Postgres 16 spends about 1 ms per MB of proposal returned (section 2, cause 5); at that rate no account's sessions come near an 8 s statement timeout. It would take a cold cache on a starved instance, a lock, or something this audit cannot see. `live-checks.sql` rows S and Q show the real sizes and timings.

### T8 · The Drafts page under each failure

| Scenario | Profile | First draft drawn | "That didn't load." drawn | After 40 s it shows | Session reads sent |
|---|---|---|---|---|---|
| normal (120 ms) | desktop | 1.2 s | never | the drafts | 5 |
| slow (400 ms) | desktop | 2.3 s | never | the drafts | 5 |
| statement timeout when a returned proposal is over 1 MB (8 s, 57014) | desktop | never | 19.3 s | a skeleton or nothing | 5 |
| waiting sessions slow alone (+6 s) | desktop | 6.9 s | never | the drafts | 5 |
| all sessions slow alone (+6 s) | desktop | 1.3 s | never | the drafts | 5 |
| drafts slow alone (+6 s) | desktop | 7.2 s | never | the drafts | 5 |
| waiting sessions fail alone (57014) | desktop | never | 2.1 s | That didn't load. | 9 |
| all sessions fail alone (57014) | desktop | 1.1 s | never | the drafts | 6 |
| drafts fail alone (57014) | desktop | never | 2.1 s | That didn't load. | 5 |
| both session reads fail | desktop | never | 2.1 s | That didn't load. | 10 |
| everything fails | desktop | never | 2.2 s | That didn't load. | 10 |
| normal (120 ms) | iphone | 7.0 s | never | the drafts | 5 |
| slow (400 ms) | iphone | 7.6 s | never | the drafts | 5 |
| statement timeout when a returned proposal is over 1 MB (8 s, 57014) | iphone | never | 23.7 s | a skeleton or nothing | 4 |
| waiting sessions slow alone (+6 s) | iphone | 11.8 s | never | the drafts | 4 |
| all sessions slow alone (+6 s) | iphone | 6.8 s | never | the drafts | 6 |
| drafts slow alone (+6 s) | iphone | 12.4 s | never | the drafts | 5 |
| waiting sessions fail alone (57014) | iphone | never | 8.0 s | That didn't load. | 7 |
| all sessions fail alone (57014) | iphone | 6.8 s | never | the drafts | 6 |
| drafts fail alone (57014) | iphone | never | 7.7 s | That didn't load. | 5 |
| both session reads fail | iphone | never | 7.9 s | That didn't load. | 8 |
| everything fails | iphone | never | 8.1 s | That didn't load. | 8 |

What the stand-in shows (`scripts/drafts.mjs`, T8 above; `DraftsPage.ca09.audit.test.tsx`, 6 tests passing):

| If … | the page … |
|---|---|
| everything answers | draws the drafts at 1.2 s (desktop) / 7.0 s (phone) |
| the waiting-sessions read is 6 s slow | shows only skeletons until 6.9 s / 11.8 s, though the drafts had arrived at 1.2 s (`DraftsPage.tsx:111-112`) |
| the drafts read is 6 s slow | shows only skeletons until 7.2 s / 12.4 s, sessions included |
| the waiting-sessions read fails (57014) | **"That didn't load." in both panels**, drafts hidden, at 2.1 s / 8.0 s; App retries it once, and the 10 s poll asks again for as long as the page is open |
| it times out after 8 s (57014) | skeleton for 19.3 s / 23.7 s, then "That didn't load."; at the next poll it goes back to the skeleton and the cycle repeats — the page never shows a draft |
| only the all-sessions read fails | draws the drafts; "Show N already in a build" is simply missing |
| the drafts read fails | "That didn't load." in both panels |
| nothing is logged in any case | the console has no `[Drafts]` line (CA-08 F4); only the Network tab shows the cause |

So "drafts still don't load" with the database fixed has three explanations left, and one live check decides between them:

1. **The waiting-sessions read is failing or very slow live** (a 57014 statement timeout, a 500, a 401/42501 if the session is not being sent, or a cold first read), and the single page status hides the drafts. The repository has nothing that would make this read fail on the schema `types.ts` describes, so if it fails, the error body says why.
2. **The drafts read itself is failing live** for a reason the schema does not show (a policy, a check, PostgREST's schema cache still lacking `post_doc` after the migration: 42703 or PGRST204 until the cache reloads).
3. **The published site is not running `cc6cc8c`** (an older bundle, or the preview rather than the published site), so it still asks for what CA-08 found missing or behaves as before tonight's fix.

**What decides it:** the Network tab on `/drafts` (Lovable message, step 2): the status and body of `GET /rest/v1/import_sessions?select=id,client,…&status=in.(parsed)…` and of `GET /rest/v1/builds?select=id,creator_id,…&status=eq.draft…`. A 500 with code 57014 on the first means (1); any error on the second means (2); no request carrying `post_doc` at all, or the old error, means (3), which step 5 (the published commit) confirms. `live-checks.sql` rows Q (slowest statements), T (`statement_timeout`) and S (proposal sizes) explain a 57014 if that is what comes back.

---

## 5. Findings, most serious first

Severity: **Critical** stops Miles using the site; **High** makes it feel broken or slow for everyone; **Medium** costs time or trust; **Low** clean-up. Size: small (under an hour), medium (a few hours), large (a day or more).

### F1 · The Add menu runs off the top of the screen: "New session" (and on a phone "Prompt") cannot be pressed. Critical.

- **What is wrong.** The Add menu is about 470 pt tall and has no maximum height or scroll. Radix opens it above the Add button when there is more room there, and the top rows land above the screen. Radix's menu also locks page scrolling, so they cannot be reached.
- **Where.** `src/pages/site/compose/SandboxView.tsx:237-250` (`AddMenu`, `Menu.Content align="end" sideOffset={6} style={menuSurface(280)}`); `src/pages/site/compose/refinedStyles.ts:126-135` (`menuSurface`: no `maxHeight`, no `overflowY`). The step menus and the session menu use the same surface.
- **Evidence.** `measurements/add-menu-probe-desktop.txt` and `-iphone.txt`: New session at −59…−13 (desktop) and −80…−34 (phone), Prompt at −34…12 on the phone; Playwright refuses the press ("element is outside of the viewport"). Screenshot `measurements/screens/add-menu-open-iphone.png`. T7 rows "Add › New session".
- **Proved.** **Who:** every maker in the composer, on the phone always (the Add button sits mid-screen), on a desktop whenever the button is in the lower half.
- **Fix, in words.** Give the menu surface `maxHeight: var(--radix-dropdown-menu-content-available-height)` and `overflowY: auto`, and `collisionPadding` (header and dock heights) on `Menu.Content`; on a phone, open Add as a bottom sheet instead. **Small.**

### F2 · Add › Prompt does nothing visible, on every device. Critical.

- **What is wrong.** The item asks for focus later (a counter read by an effect), and the menu closing then gives focus back to the Add button. The field is never focused and nothing scrolls. On an iPhone, a focus from an effect would not raise the keyboard even if it stuck.
- **Where.** `src/pages/site/compose/SandboxPage.tsx:255-258` (`focusAdd`, `onAddPromptFocus`); `src/pages/site/compose/BuildList.tsx:1526-1528` (`useEffect(() => { if (focusAdd > 0) field.current?.focus() })`); `SandboxView.tsx:244` (no `onCloseAutoFocus`). Same shape: `SandboxView.tsx:525-531` (the Missing line's "a prompt"), `DetailsPanel.tsx:709-712`, `SessionsPanel.tsx:132-133`, `PromptsPanel.tsx:123-124`, `ReferencePicker.tsx:113-114`, `PostToolbar.tsx:395-396`, `FormatBar.tsx:208-209`.
- **Evidence.** `add-menu-probe-*.txt`: `document.activeElement` is the Add button at 0, 50, 200, 600 and 1500 ms after the press, `scrollY` unchanged; T7 "Add › Prompt" Broken on both profiles, both on a draft and on a new post.
- **Proved** (desktop and Chromium-phone); the iOS keyboard part **Likely** (WebKit not runnable here). **Who:** every maker adding a prompt by hand.
- **Fix, in words.** In the item's `onSelect`, `preventDefault` the menu's close-focus (`onCloseAutoFocus`) and, in the same handler, `scrollIntoView({ block: "center" })` and `focus()` the field synchronously (pass a ref down instead of a counter). Do the same for the other effect-focus sites that answer a tap. On a phone, consider opening a small sheet with the field already focused by the tap. **Small.**

### F3 · One page status for two lists: a slow or failing sessions read hides the drafts. Critical (it is what "drafts don't load" most likely is now).

- **What is wrong.** `status` is "ready" only when both the drafts and the waiting-sessions reads have answered, and "error" if either has failed (CA-08 F8). The sessions read is polled every 10 s and retried, so a sessions read that fails keeps both panels on "That didn't load." for as long as the page is open, and one that is merely slow holds the drafts back.
- **Where.** `src/pages/site/drafts/DraftsPage.tsx:111-112`; the poll `src/hooks/useWaitingSessions.ts:26-34`.
- **Evidence.** T8 and `measurements/drafts-*.json`: sessions 6 s slow → drafts drawn at 6.9 s instead of 1.2 s (12.4 s on the phone); sessions 57014 → "That didn't load." with the drafts read answered 200; under an 8 s timeout the page alternates between a skeleton and the error forever. `DraftsPage.ca09.audit.test.tsx` (6 tests).
- **Proved** on the stand-in; which read fails live: **needs the live check** (section 4). **Who:** Miles, and every maker with sessions.
- **Fix, in words.** Give each panel its own status (the view already draws them separately); show the drafts as soon as they arrive; show a sessions error only in the Sessions panel, with the code. **Small.**

### F4 · Nothing says what failed (CA-08 F4, F6, still open). High.

- **What is wrong.** The Drafts page and the composer's "didn't load" log nothing; a failed header save logs nothing; 230 of the 457 `catch` blocks in `src/` neither log, show nor rethrow, and none of the 457 puts the error code in its own log line (`raw/catches.csv`; heuristic scan, `scripts/scan-catches.mjs`). There is no front-end error monitoring.
- **Where.** `src/components/ErrorState.tsx:60-67` (logs only with an `error` prop), `src/pages/site/drafts/DraftsView.tsx:586-591, 612-617` (never passes one), `src/hooks/useComposeBuild.ts:185-190`; the files with most silent catches: `useComposePrompts.ts` (14), `Upload.tsx` (7), `ContentDetail.tsx` (6), `layers.ts`, `media.ts`, `codeRunner.ts`, `ComposeNew.tsx` (5 each).
- **Evidence.** `DraftsPage.ca09.audit.test.tsx`: no `[` line in the console for any failure; `raw/catches.csv`.
- **Proved.** **Who:** whoever fixes the next failure, and Miles, who cannot report what he cannot see.
- **Fix, in words.** Pass `query.error` to `ErrorState`; one `reportError(scope, error)` helper that logs `{ scope, code, message }` and feeds Sentry (per the `neoscale-error-monitoring` skill, codes only, never prompt text); show the code in small print on every "didn't load". **Medium.**

### F5 · Four seconds of JavaScript before anything draws on a phone. High.

- **What is wrong.** 1,027 KB of JavaScript (308 KB gzip) loads before the first route chunk; first contentful paint is 4.1–4.4 s on the iPhone profile on every route, 5.8 s on a draft.
- **Where.** `index.html` modulepreloads; `App.tsx:5-29` (eager imports), `App.tsx:202-215` (two toasters, legacy providers); `src/lib/build/index.ts` pieces pulled into the entry (`gallery.ts`, `signals.ts`, `making.ts`, `imports.ts`, `intake.ts`), `src/lib/tools/registry.ts` and `src/lib/models/registry.ts` (31 KB together).
- **Evidence.** T1, T4 (Lighthouse FCP 4.1–5.9 s, scores 36–65), section 2 cause 1; source-map breakdown in that section.
- **Proved.** **Who:** everyone, most on phones.
- **Fix, in words.** Move the legacy providers (reblog, share, upload picker, quoting, add-to-collection) behind lazy boundaries mounted only where used; drop the Radix `Toaster` if sonner is the one in use; stop the entry importing `src/lib/build` modules a route does not need at boot; give `client`, `react-dom` and the theme their own long-cached chunks. Target: entry under 150 KB gzip. **Medium–large.**

### F6 · Waterfalls on the two pages Miles uses most. High.

- **What is wrong.** (a) A draft waits for its header, then its tree, and only then starts downloading the composer itself; (b) the Drafts list reads its drafts, then their session counts; (c) every `auth.getUser()` holds the auth lock for a round trip and stalls every other request.
- **Where.** (a) `src/pages/site/compose/ComposeRoute.tsx:61-80` and `src/lib/build/builds.ts:164-168`; (b) `src/lib/build/drafts.ts:45-58` (`session_count` missing from `BUILD_COLUMNS`, `builds.ts:28-29`); (c) `src/lib/profile/colourSwatches.ts:62` and 24 other `getUser()` calls; `@supabase/auth-js` `GoTrueClient.js:2447-2454`.
- **Evidence.** iPhone timelines in `routes-iphone-normal.json` (section 2, cause 2): composer chunk starts at 5.67 s, after the second build read; the seven reads after `GET /auth/v1/user` start one round trip later.
- **Proved.** **Who:** everyone; on the phone each round trip is 0.7 s.
- **Fix, in words.** Start `import("./SandboxPage")` when ComposeRoute mounts (or at the router level) so it downloads while the build is read; read the header and the tree in parallel by id; add `session_count` to the Drafts read and drop the second query; use the session's user (`useAuth()`, or `getSession()`, which is local) instead of `getUser()` wherever only the id is needed. **Medium.**

### F7 · Every page reads the profile three times and writes presence five times on load; the whole app re-renders with every auth event. High.

- **What is wrong.** `AuthProvider` fetches the profile from two places and makes a new context value on every render; `usePresence` and `useWelcomeXp` depend on the `user` object, which changes identity on each auth event; presence also writes on every focus and blur.
- **Where.** `src/contexts/AuthContext.tsx:59-79, 90-100`; `src/hooks/usePresence.ts:16-51`; `src/components/ambient/useWelcomeXp.ts:16-35`.
- **Evidence.** T3: `profiles ×3`, `user_progress ×3`, `dm_presence ×5` on every route; AuthProvider 7 renders in 5 s (T2).
- **Proved.** **Who:** everyone signed in; it is also 8–11 extra requests per page on the database.
- **Fix, in words.** Fetch the profile once per user id (a TanStack query keyed by id); `useMemo` the context value; depend on `user?.id`, not `user`; write presence on visibility change only, debounced. **Small.**

### F8 · The Gallery, build pages and profiles still ask for tables and functions the live database does not have. High.

- **What is wrong.** The Gallery feed selects `builds.like_count, comment_count`; build pages and profiles read `build_likes`, `build_saves`, `maker_stats`; `rc_build_social`, `rc_maker_stats` and the other RC migrations are not applied (CA-08 F3).
- **Where.** `src/lib/build/gallery.ts:1320, 1431`; `src/lib/social/likes.ts:22`; `src/lib/messaging/builds.ts:78`; `src/lib/profile/makerStats.ts`; full list `raw/rpcs.csv`, `raw/tables-missing.csv`.
- **Evidence.** Stand-in on `types.ts`: `/gallery` never shows a build (`listGalleryFeed failed: column builds.like_count does not exist`), 6–9 console errors on build and profile pages (T2). `live-checks.sql` rows M decide it live.
- **Proved** against `types.ts`; **Likely** live. **Who:** every visitor to the Gallery, build pages and profiles.
- **Fix, in words.** Either apply `rc_build_social` (and the other RC files the site calls) with their RLS checks, or take the columns and calls out until they are applied; then a guard test that every table, column and RPC the client names is in `types.ts` (CA-08 F2). **Medium.**

### F9 · Pictures are signed one request at a time. High (on the phone).

- **What is wrong.** Each picture's URL is a separate `createSignedUrl` POST.
- **Where.** `src/lib/build/media.ts:387-402` (`signedMediaUrl`), called per picture by the thread, the build page and the profile cards.
- **Evidence.** T2/T3: 41 sign calls on the build page and the 40-picture draft, 44 on a profile.
- **Proved.** **Who:** anyone opening a build with pictures, or a profile.
- **Fix, in words.** One `createSignedUrls(paths)` per page (storage-js has it), cached by path; or make the bucket's published pictures public-read with the image transform. **Medium.**

### F10 · Polling and focus refetches: 7 requests a minute on an idle Drafts or composer page, and a burst of 6–22 every time the phone comes back to the browser. Medium.

- **What is wrong.** The two session lists poll every 10 s and on every focus with `"always"`; the app sets no `staleTime`, so every focus refetches every query on screen; presence writes on focus and blur.
- **Where.** `src/hooks/useWaitingSessions.ts:26-34`, `src/hooks/useLibrarySessions.ts:21-28`, `src/App.tsx:178-182`, `src/hooks/usePresence.ts:25-40`, `src/components/dm/ThreadView.tsx:441`.
- **Evidence.** T5.
- **Proved.** **Who:** everyone; the database pays for every open tab.
- **Fix, in words.** Poll only while the Sessions panel is visible, every 30–60 s, or use a Realtime subscription on `import_sessions` for the user; a default `staleTime` of 30–60 s; `refetchOnWindowFocus: true` (not `"always"`). **Small.**

### F11 · A refused header save is retried every 800 ms forever, and opening a draft writes to it (CA-08 F5). Medium.

- **What is wrong.** `flush` puts failed keys back and reschedules; nothing stops on a permanent code. Opening a draft writes `completeness` whenever the computed score differs from the stored one, so an unwritable draft starts that loop on open.
- **Where.** `src/hooks/useComposeBuild.ts:185-197` and `:265-270`.
- **Evidence.** CA-08 4.2; T3 shows the `PATCH builds` on opening both drafts.
- **Proved.** **Who:** any maker whose draft loads but cannot be written.
- **Fix, in words.** Retry only network, 5xx and 503/520, three times with backoff; stop and say so on any other code; compute completeness for display and write it only with a real edit. **Small.**

### F12 · The phone gives the page 77% of its height in the composer and uses desktop words. Medium.

- **What is wrong.** Header 48 + dock 57 + the sticky Card/Preview/Publish bar 66 leave 568 of 739 pt (493 of 664 at 390 wide). Nothing pads scrolling for the bars, so a focused field can sit under them. The list hint says "Click a prompt … double-click to read all of it"; double-click is turned off on a phone (`BuildList.tsx:747`).
- **Where.** `src/pages/site/compose/SandboxView.tsx:749-750` (sticky bar), `:161` (`LIST_HINT`); `src/components/shell/Dock.tsx:64-68`.
- **Evidence.** T9, `phone/phone-*.json`, `phone/*-compose-*.png`.
- **Proved.** **Who:** makers on phones.
- **Fix, in words.** `scroll-padding-bottom` equal to the bars on the composer's scroller; fold the action bar into the dock on a phone; phone copy "Tap a prompt to see it". **Small.**

### F13 · Touch targets under 44 and the spacing method (Part 5). Low–medium.

- **What is wrong.** 2–15 controls per route under 44 pt (T9): the wordmark link 102×18, Search 30×30, the session "Add" buttons on Drafts 30×30, the step options 26×26, the feed lenses 22 high on Home. Measured against the approved method: the page's text starts at 23 pt from the screen edge on most routes (a 7 pt frame inset plus 16 pt padding), not 16; gaps of 2, 6, 9 and 12 are everywhere (Home 176 gaps off the 4/8/16/32 scale); text at 10.5, 11.5, 12, 12.5, 13.5 and 14 px is far more common than 22/18/15/13/11 (Home 123 of 145 text elements off the scale); Messages has 9 px text (under the 10 px floor in `design/RULES.md` §4); buttons are drawn at 36 only on Home, Gallery, the build page and Profile. No field is under 16 px, nothing scrolls sideways, and the frame uses `100dvh` and the safe-area insets.
- **Where.** Per route in `phone/phone-430.json` and `phone/phone-390.json`.
- **Proved** (computed boxes). **Who:** phone users.
- **Fix, in words.** A spacing pass per route against the method, starting with the composer and Drafts; a 44 pt hit area on every icon button. **Medium.**

### F14 · `get_email_by_username` lets anyone turn a username into an email address. High (privacy), Likely.

- **What is wrong.** The function is `SECURITY DEFINER`, reads `auth.users.email`, and no migration revokes it from `PUBLIC`, so the anon key can call it for any username. It exists so sign-in accepts a username.
- **Where.** `supabase/migrations/20260318185439_68df3ada-ec24-4ac8-9c6c-174d13f5603e.sql:1-13`; called from `src/lib/auth/signInWithEmailOrUsername.ts:24`.
- **Evidence.** The migration; on local Postgres a function created the same way is executable by `anon` (`live-checks.sql` row X does the same check live).
- **Likely** (not called live). **Who:** every account with a public username.
- **Fix, in words.** Do the username-to-email step inside an edge function that signs in, or return only whether the username exists; revoke EXECUTE from anon. **Small–medium.**

### F15 · Smaller things found on the way. Low.

- **Stored script in a legacy viewer (Likely).** `ContentBlockViewer.tsx:701` puts a prompt block's text and the viewer's own variable values into `dangerouslySetInnerHTML` with no escaping (`highlightVars`, `:628-633`). An author's `<img onerror>` in a prompt would run for every reader of `/content/:id`, which is still routed. Escape before highlighting. Small.
- **Dead code (Proved, knip).** 291 files reachable from nothing (249 in `src/`, 1.65 MB), including the legacy pages `ContentDetail.legacy.tsx`, `Messages.legacy.tsx`, `Library.legacy.tsx`, `Discover*.tsx`, `Browse.tsx`, `Feed.tsx`, `FYP.tsx`, `Search*.tsx`, the `guilds/`, `leaderboards/` and `discover/` components; 20 unused dependencies (`recharts`, `cmdk`, `embla-carousel-react`, `fuse.js`, `input-otp`, `react-resizable-panels`, nine Radix packages, four TipTap extensions) and 3 dev ones; 1,055 unused exports (`raw/knip.json`, `raw/knip-unused-files.txt`). `Upload.tsx` and `ContentDetail.tsx` are still routed, as RULES §3 requires.
- **The stray root entries (Proved).** `b`, `d`, `e`, `f`, `lb`, `session-h`, `v0e` and `guilds` are not folders of files: each is a git submodule pointer (mode 160000) to a commit this repository does not have, with no `.gitmodules`, all added by #308 on 12 October (`git ls-tree HEAD`). They check out as empty folders. Hosts that clone with submodules (Netlify does) can fail with "No url found for submodule path" (Likely). Remove them with `git rm --cached`.
- **`.env` is committed** with the project's URL, id and publishable key (publishable, so not a secret; `.gitignore` says it should not be).
- **The admin screen is guarded in the browser** (`AdminRoute.tsx:26-31`, `profiles.is_admin`); its data must be guarded by RLS, which this audit did not check.
- **The Drafts Sessions panel shifts the layout** (CLS 0.305 on the phone, Lighthouse): its skeleton is shorter than its list.
- **Tests and checks.** `npm test`: 55 failed of 5,442 in 9 files (exactly CA-08's list: AppShell 31, BuildPage 11, noRail 7, motion 3, and one each in rcStates, ns-classes, retiredSurfaces, siteFrame, flat-shell.wide) — already red on `main`, with this audit's 6 tests passing. `npm run lint`: 2,249 problems (1,959 errors), all pre-existing; the audit's own files have none. `tsc`: clean. `npm run build`: passes. There is no `.github/workflows`, so nothing runs any of this on a merge, and no front-end error monitoring. Which of this audit's problems a test would have caught: F1 (a test that every menu's content fits the viewport), F2 (a mounted composer test that presses Add › Prompt and asserts focus), F3 (CA-08 already wrote it), F7 and F10 (a request-count test per route on the stand-in), F8 (a column/RPC guard against `types.ts`).
- **Lovable's files.** `types.ts`, `client.ts` and `previewAuthStorage.ts` are generated by Lovable. Tonight's `previewAuthStorage.ts` change (`1e5835c`) only touches the branch taken inside Lovable's editor preview (a framed page on a Lovable preview host); on the published site `brokeredPreviewStorage()` still returns `localStorage` (`previewAuthStorage.ts:13-18`), so the published site is unaffected (Proved by reading). The same commit added `@lobehub/icons-static-svg` to `bun.lock`; it is used by `ModelMark.tsx`. The code that depends on Lovable's files: every data call goes through `client.ts`; 141 `as unknown as` casts in `src/` exist because `types.ts` lags the migrations.
- **Where this prompt and the code differ.** The branch: the prompt names `ca-09-full-audit`; this session was required to work on `claude/eager-pascal-ap0gib`, and did. The commit "Applied 3 migrations" adds two drizzle files (0012 post_threads, 0013 ca06); tf07 is a data-only update to `node_types` and is not in drizzle. `Messages.legacy.tsx` is not routed, so its 5 s poll never runs. Proposals of 1–5 MB exceed what the importer accepts (section 2, cause 5). The bundle is 277 files and 4.9 MB raw (4.68 MiB), not 5.4 MB; the prompt's per-file sizes are KiB and match. The `buildgallery-repo-map` skill named in `CLAUDE.md` is not installed in this session, so names come from the files.

---

## 6. Fix plan

Each session is about one day of Claude Code work, ends with the repository's checks (`tsc`, the changed tests, `npm run build`) and reruns this audit's scripts on the stand-in (`standin.md`), so its "measurably better" line can be checked against section 2.

**Before session 1: Miles runs Part 7** (`live-checks.sql` and `lovable-message.md`). If the waiting-sessions read comes back failing live, session 1 also fixes that read; the answer says how.

| Session | Fixes | Measurably better (stand-in, same scripts) |
|---|---|---|
| **1 · Drafts and buttons that do nothing** | F3 (one status per panel; drafts shown as soon as they arrive), F1 (menu height, scroll, collision padding; Add as a sheet on a phone), F2 and the other effect-focus sites that answer a tap (focus and scroll in the handler), Add › Result scrolled into view, F12 (`scroll-padding`, phone wording), F4 for the Drafts page and the composer (pass the error, log the code, show it), F11 (stop retrying permanent save errors; no write on open). If the live check shows the sessions read failing: fix that read too (named columns only, `first_prompt` cut short in the database). | Drafts drawn in under **1.5 s on desktop and under 7.5 s on the iPhone profile even when the sessions read is 6 s slow or fails** (`drafts.mjs`); every Add item Works on both profiles (`actions.mjs`, no Broken or Silent row in the composer); no menu row outside the screen (`probe-add.mjs`); Add › Prompt leaves a visible, focused field. |
| **2 · Speed: round trips and repeated requests** | F6 (composer chunk fetched in parallel, header and tree in parallel, `session_count` in the Drafts read, `getUser()` → session user), F7 (one profile read, memoised auth value, presence on visibility only), F9 (one batch sign per page), F10 (poll only the visible panel, 30–60 s, default `staleTime`). | iPhone profile: **Drafts usable under 5.5 s (from 6.9), a draft under 7 s (from 9.3), the build page under 6.5 s (from 8.5)**; on every route profile read once and presence written once on load; sign calls per page 1 (from 41–44); idle Drafts page ≤ 3 requests a minute (T5). |
| **3 · Speed: less code before the first paint** | F5 (legacy providers lazy, one toaster, `src/lib/build` and the registries out of the entry, vendor chunks split and long-cached). | Entry plus preloads **under 150 KB gzip (from 308)**; iPhone first contentful paint **under 2.5 s (from 4.1–4.4)**; Lighthouse on `/drafts` **70 or more (from 46)**. |
| **4 · Correctness and safety** | F8 (apply the RC migrations the site calls, or stop calling them), the column/RPC guard test against `types.ts`, F14 (`get_email_by_username`), the escaped prompt viewer (F15), Sentry and a `reportError` helper in every silent catch on the main paths (F4). | `/gallery` shows builds on the stand-in; **0 console errors** on the build page and profile (from 6 and 9); `live-checks.sql` row X empty for `get_email_by_username`; the guard test fails on a column `types.ts` lacks. |
| **5 · Clean-up and checks** | Remove the 249 unused `src/` files and 20 unused dependencies knip lists (keeping RULES §3's live content path), the stray submodule pointers, the 55 red tests, a CI workflow (tsc, lint on changed files, test, build) on every pull request, F13's spacing and touch-target pass on the composer and Drafts. | `npm test` green; CI runs on the pull request; touch targets under 44 on the composer and Drafts: 0 (from 15 and 11); text off the scale on Drafts under 10 (from 26). |

---

## 7. What this audit could not see

- **The live database.** `*.supabase.co` is blocked from this container. Everything "live" is inferred from `types.ts` (which Lovable generates from the live database), the migrations and the stand-in. Part 7 collects what decides it.
- **Safari and a real iPhone.** WebKit is not installed and may not be downloaded here, so the phone profile is Chromium with the iPhone's size, user agent, touch, 4× CPU and Fast 3G. Safari's keyboard rules (no keyboard for a `focus()` outside a tap), its toolbar and `100vh`, and its rendering speed on an A17 are reasoned from WebKit's documented behaviour, not seen. A real iPhone is faster than 4× throttled Chromium on this machine for parsing; its network is usually better than Fast 3G on Wi-Fi and worse on a weak signal.
- **Supabase's real latency, hardware and cache.** The stand-in adds a flat 120 or 400 ms; Postgres costs were measured on a local Postgres 16, hot cache, a fast CPU. A small shared Supabase instance, a cold cache or many open tabs could be several times slower.
- **Miles's real data.** Proposal sizes, number of sessions and drafts, picture sizes. `live-checks.sql` row S reports the sizes, without anyone's content.
- **Lovable's hosting.** Compression, HTTP version, cache headers, the "Edit with Lovable" badge, and which commit is published. The stand-in serves gzip over HTTP/2 with `netlify.toml`'s headers; if the published site does less, it is slower than measured.
- **Storage.** Signed URLs, the image transform (the stand-in returns the same 190 KB picture at every width) and the storage policies were read in the code, not exercised.
- **Edge functions and the connector.** Not on the audited routes; not exercised.
- **Admin data protection.** The admin screen's gate is in the browser; whether RLS protects its data was not checked.
- **The 400 ms "slow" profile is a stand-in for a slow day**, not a measurement of one.
- **The action timings are on a warm page**: each control was pressed after its screen had loaded; the first press on a cold phone, while JavaScript is still arriving, is slower.
