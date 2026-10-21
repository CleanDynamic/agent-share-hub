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

### T9 · Phone layout, per route (430 / 390 wide)

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
