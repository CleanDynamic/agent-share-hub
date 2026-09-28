# RC series contract

The rules every RC prompt obeys. Each prompt cites sections of this file as CONTRACT §n, and cites the owner's skills as ⟦skill › section⟧.

## §1 Branch, commits, deploys

1. All RC work is committed to the branch `rc-reconcile`. Never commit to, merge into, rebase or push `main` or `ex-door`.
2. Start every session: `git fetch origin && git checkout rc-reconcile && git pull --ff-only origin rc-reconcile`. If the pull is not a fast-forward, or `git status --porcelain` is not empty, stop.
3. Commit format: `COMPONENT-N: description (RC-Pnn)`. This replaces the `NS-Pnn` format of ⟦neoscale-code-review › 9⟧ for this series only; the rule of one discrete, revertable change per commit stands. COMPONENT is one of SETUP CLEAR TOKENS FRAME SEARCH ENTRY CRITIQUE DISCOVERY FEED BOUNTIES LINEAGE SOCIAL SEO COMMENTS MODERATION LIBRARY NOTIFY MESSAGES PROFILE ANALYTICS XP BADGES PARKED SYNC RETIRE BRAND GUARD SIGNOFF. N is the next unused number for that component in `git log rc-reconcile`. The (RC-Pnn) tag is the release tag ⟦neoscale-error-monitoring › Release tracking⟧: it makes "which prompt broke it" a one-look answer.
4. Nothing deploys during the series. You never run a migration, never call or deploy an edge function, never change a Supabase setting. The backend is Lovable Cloud (project ref zybdotagjwektucfdkri); migrations reach it only when the owner sends a Lovable message. Every migration file you add is appended to the diary's Deploy queue in send order.

## §2 Hard constraints (no exceptions except §3)

1. Inline styles only (`style={{ }}`); keyframes live in src/index.css ⟦neoscale-code-review › 3⟧.
2. No structural CSS change on an existing layout element: position, width, height, overflow, zIndex, display, flex, grid, gap, padding, margin ⟦neoscale-code-review › 2⟧ ⟦neoscale-performance › Forbidden fixes 1⟧. New elements may carry any style.
3. RLS uses `(select auth.uid())`, never the bare call ⟦neoscale-code-review › 1⟧ ⟦supabase-postgres-best-practices › references/security-rls-performance.md⟧. Every new table: RLS enabled, policies and indexes in the same migration; every foreign-key column indexed ⟦supabase-postgres-best-practices › references/schema-foreign-key-indexes.md⟧; `anon` explicitly revoked on anything not publicly readable ⟦supabase-postgres-best-practices › references/security-privileges.md⟧.
4. Constraints are added through catalogue-checked DO blocks, never `ADD CONSTRAINT IF NOT EXISTS` ⟦supabase-postgres-best-practices › references/schema-constraints.md⟧.
5. No dependency installed ⟦neoscale-code-review › 4⟧. If a step seems to need one, stop.
6. Every new route is `React.lazy` inside Suspense and wrapped in `RouteBoundary` (created in RC-P05) ⟦neoscale-performance › Checklist for any new route⟧ ⟦neoscale-error-monitoring › Error boundaries⟧. Existing lazy routes stay lazy.
7. Tokens only ⟦buildgallery-theme › Tokens⟧: colours through `t.*` (src/lib/theme/tokens), radii through `r.*` (src/lib/theme/radius), spacing from the theme scale 8/16/24/40/64/96/132, type through src/lib/theme/type. No hex, no rgba() literal, no oklch() literal, no Inter, no Playfair. Every new state uses the mapping in docs/reconciliation/STATES.md (RC-P04b).
8. Data access in `src/lib/<domain>/` as named, typed functions; no query in a component; no `select('*')`; every list query has `.limit()`; counts `estimated` unless exactness is required; no query inside a loop ⟦neoscale-code-review › Database; Data layer⟧ ⟦supabase-postgres-best-practices › references/data-n-plus-one.md⟧. Lists page by cursor, never offset ⟦supabase-postgres-best-practices › references/data-pagination.md⟧.
9. Identity from `useAuth()`. Both chromes: below 768px the app mounts MobileTopBar, MobileBottomNav and ProfileDrawer; a navigation change is not done until both are changed ⟦neoscale-code-review › Frontend⟧.
10. Images use the existing helper in src/components/gallery/cardMedia.ts or the existing avatar component; no new image URL builder ⟦neoscale-performance › Also outstanding⟧.
11. `.ns-*` rules are never removed ⟦neoscale-performance › Forbidden fixes 2⟧. AppLayout, BlobBackground and primary button surfaces are never modified ⟦neoscale-code-review › 5⟧.
12. Frozen means frozen: REBLOG_COMPOSE_ENABLED, REMIX_CREATE_ENABLED, GEN1_BOUNTY_RESPONSES_ENABLED and LEGACY_BOUNTY_CREATE_ENABLED stay false and their read paths stay live until the prompt that deletes them; that prompt deletes their tests and their docs/retired-surfaces.md entry in the same commit.
13. Root cause, not symptom: no fix without its cause stated ⟦neoscale-code-review › Root cause, not symptom⟧.

## §3 Sanctioned exceptions (owner decisions)

1. Right-rail removal (RC-P06, finished in RC-P08b) is the one sanctioned structural change. It is confined to AppShell.tsx, FlatShell.tsx, flat-shell.css, wideRoutes.ts, MobileTopBar.tsx, RightRailExplore.tsx, RightRailDrawer.tsx, right-rail-explore.css, useRightRailData.ts and their tests.
2. ⟦neoscale-code-review › 6⟧ requires parallel build, then migration, then removal. RC is the migration and removal. It removes the legacy content path only after the connector (EX series) is signed off and merged; until then RC does not touch the files in §4.
3. src/components/layout/LeftPanel.tsx and RightPanelExplore.tsx are deleted in RC-P29 because nothing renders them; no other shell listed in ⟦neoscale-code-review › 5⟧ is touched.
4. ⟦neoscale-e2e-testing › Critical paths⟧ tier-1 items 4 (legacy upload) and 5 (content detail) are replaced in RC-P29 by "compose → publish a build" and "a published build page renders". A test for a flow that becomes a redirect is rewritten in the same commit to assert the redirect; it is never deleted while the old address is reachable.
5. ⟦buildgallery-theme › Components, Card⟧ fixes the card's content order. RC-P16 adds one row, the engagement row, after the part chips. Every existing item and its order is unchanged. Nothing else is ever added to the card.
6. ⟦hicks-law › Budgets⟧ records the build page's six tabs as the one exception to "≤ 5 tabs".
7. Gallery decision BG-P19 no. 4 (no staleness filter) is superseded by the lens row; no. 3 (the order is stated, never offered) stands.

## §4 The connector lock

Until a prompt states that ex-door has merged and RC-P28b has run, never edit, move, rename or delete:
src/lib/build/intake.ts, src/lib/build/publish.ts, src/lib/build/signals.ts, src/lib/build/imports.ts, src/lib/build/buildFileImport.ts, src/pages/Upload.tsx, src/pages/ComposeNew.tsx, src/components/compose/WaitingImports.tsx, src/components/compose/ImportDestination.tsx, src/pages/OAuthConsent.tsx, src/lib/auth/oauthConsent.ts, supabase/functions/mcp/**, supabase/functions/parse-transcript/**, supabase/functions/_shared/redact/**, .claude/skills/buildgallery-extractor/**, docs/connector/**.
Also locked: in src/lib/build/gallery.ts, the four `.order(...)` calls inside listGallery, the function galleryPredicate, and the constants GALLERY_THRESHOLD, GALLERY_MAX_THRESHOLD, GALLERY_REQUIREMENT_KEYS stay byte-identical. Additive filters are allowed.
You may import and call locked modules. A WAIT prompt verifies the merge itself before step 1.

## §5 Skill map and precedence

| Skill | Governs in RC |
|---|---|
| neoscale-code-review | The gate before every commit; its output block is printed in every report |
| buildgallery-repo-map | Locating code; reusing existing functions before writing new ones |
| neoscale-e2e-testing | Every test: selectors, tiers, both viewports, RLS proofs, screenshots on failure |
| neoscale-performance | Baseline and deltas, the new-route checklist, forbidden fixes |
| neoscale-error-monitoring | Route boundaries, identifier-only error context, user text never in errors |
| supabase-postgres-best-practices | Every migration and database function |
| buildgallery-theme | Every appearance decision; its "Before you call it done" list closes every interface prompt |
| color-system | New states and pairings: measured contrast, meaning never by colour alone |
| hicks-law | Every choice: counts, ordering criteria, defaults, the choice audit, budget tests |
| von-restorff-effect | One filled primary action per view; one isolated element per section |
| law-of-proximity | Grouping by space: within-group 8, between groups 16 or more |
| law-of-common-region | Containers: cards, dialogs, list rows; nesting at most two levels |
| law-of-similarity | Same function, same look: chips, actions, cards across surfaces |
| law-of-continuity | Sequences: feed, lineage tree, ranked lists, replies, "More" |
| law-of-figure-ground | Layers: dialogs with scrims, selected states, the frame after the rail |
| layout-grid | New grids and lists: columns, gutters, margins |
| responsive-design | Every interface change at 390, 768, 1024 and 1440 wide; 44px touch targets |
| better-layout | Structure, alignment, logical properties, clip-safe actions; its report table |
| better-ui | Icon strokes, states, motion restraint; its report table |
| aesthetic-usability | Empty, loading and error states designed with the same care; the final audit |
| critique-visual-hierarchy | Critique passes: entry point, eye flow, weight, emphasis |
| critique-affordance | Critique passes: what looks clickable, states, CTA clarity |
| critique-composition | Critique passes: balance, whitespace, rhythm, gestalt |
| critique-information-density | Critique passes: load, priority, scanning, disclosure |

Precedence when two skills disagree, highest first:
1. §2, §3 and §4 of this contract, and ⟦neoscale-code-review › Automatic fail⟧.
2. ⟦neoscale-performance › Forbidden fixes⟧.
3. ⟦hicks-law⟧ budgets: a design skill never adds a choice beyond a budget.
4. ⟦buildgallery-theme⟧ for every value: colour, radius, spacing, type, motion, glass. Where color-system, layout-grid, responsive-design, better-layout or better-ui give a different number or colour, the theme's wins; they apply where the theme is silent.
5. The remaining skills.
References to skills that are not installed resolve as follows: `neoscale-ui` means the file neoscale-ui.md at the repository root; `better-accessibility` means ⟦responsive-design › Input Method Adaptation⟧ plus ⟦critique-affordance › State Visibility⟧; `better-typography` means ⟦buildgallery-theme › Type⟧.

## §6 The prompt protocol

Every RC prompt is carried out in this order:
1. Session start (§1.2). Read the skills the prompt lists, in full, in the listed order. Read docs/reconciliation/HANDOVER.md; the newest entry is your context. If the previous prompt in run order has no entry, stop.
2. Do exactly the numbered steps. A step that names a file and line is a location hint; if the code there is not what the step describes, stop. Before each step carrying ⟦skill › section⟧, open that section and apply it.
3. Interface prompts run the build loop: build → theme check ⟦buildgallery-theme › Before you call it done⟧ at 390, 768, 1024 and 1440 in both themes → tests → review gate. Items of the theme list that do not apply are reported as "n/a", never skipped silently.
4. Verification: the standard set (§7) plus the specs the prompt names.
5. Review gate ⟦neoscale-code-review › Review output format⟧ on the diff of each commit. A FAIL is fixed before committing.
6. Commit exactly as the prompt specifies; push rc-reconcile.
7. Append the diary entry (§12) with the last commit, not as its own commit.
8. Print the REPORT in the prompt's shape. Every report ends with: "skills read: <names in the order read>" and "review gate: <PASS|FAIL>". Never print a value you did not measure ⟦neoscale-code-review › Verification before completion⟧.

## §7 Verification set

- `npx tsc --noEmit -p tsconfig.app.json`
- `npm test`
- `npm run build`
- Named specs: `npx playwright test <spec> --project=desktop --project=mobile`. Tier-1 runs at both viewports on every interface prompt ⟦neoscale-e2e-testing › Environment gotchas⟧.
- Tier-3 specs fake the backend with page.route on /rest/v1/, /auth/v1/, /storage/v1/, /functions/v1/ (pattern: e2e/tier3/waiting-imports.spec.ts). Never point a test at the live project. Select by role and accessible name, or data-testid; never by .ns-* or Tailwind classes; no waitForTimeout; one user-visible outcome per test, named for the outcome ⟦neoscale-e2e-testing › Selector rules; Writing tests⟧.
- On a failing spec, keep its screenshot and trace and name the failing tier in the report ⟦neoscale-e2e-testing › Running and reporting⟧. A tier-1 failure stops the series.
- "New unit test failures vs baseline" means failures not present in the RC-P00 baseline list.

## §8 Measurement

⟦neoscale-performance › Measure before you change anything; Reporting⟧. When a prompt asks for measurement, report before, change, after:
- JS bytes: total of dist/assets/*.js after `npm run build`, and the largest chunk.
- Requests: `npx playwright test e2e/audit/rc-baseline.spec.ts --project=desktop` (extend its route list when a prompt says so).
- Blurred surfaces: the number of elements whose computed backdrop-filter is not "none" with the named section in view; the theme budget is 20 ⟦buildgallery-theme › Glass⟧.
If a change meant to improve a measure does not, say so ⟦neoscale-performance › Reporting⟧.

## §9 Errors and privacy

No error tracker is installed, and installing one is a dependency (§2.5). Apply ⟦neoscale-error-monitoring⟧ as follows:
- New routes are wrapped in RouteBoundary, never an app-level boundary alone ⟦neoscale-error-monitoring › Error boundaries⟧.
- Typed errors thrown by src/lib/* carry identifiers only: function name, route, build id, node id, node type, status code. Never user-authored text: comment bodies, search queries, report notes, message text, build text, pasted content ⟦neoscale-error-monitoring › Privacy⟧. No console.log of such text.
- A permission error (Postgres 42501 or HTTP 401/403) is surfaced as its own state, "You don't have access to this.", never rendered as an empty list ⟦neoscale-error-monitoring › What to instrument 5⟧.
- Do not add logging "for completeness" ⟦neoscale-error-monitoring › What not to do⟧.

## §10 RLS proofs

⟦neoscale-e2e-testing › Auth fixtures⟧ makes an RLS test mandatory for every table with a restricted read policy. There is no dev project, so each such migration ships with a Lovable message that proves the policy inside a transaction that is rolled back: it inserts a row as the database owner, switches to `set local role authenticated` with request.jwt.claims set to a second user, counts what that user can see, then switches to `set local role anon`, and ends with ROLLBACK. The expected counts are written in the prompt.

## §11 Stop conditions

Print "RC-Pnn STOPPED: <reason>", change nothing further and stop when: a §4 file would need editing; a named file, function, table, column or skill does not exist; a verification fails for a reason the prompt did not predict; the tree is dirty at the start; the branch is not rc-reconcile; a step needs a dependency; SQL would need bare auth.uid(); a budget in ⟦hicks-law › Budgets⟧ would be exceeded; a measurement exceeds a limit the prompt sets.

## §12 The diary

docs/reconciliation/HANDOVER.md. An entry is at most nine lines:
```
## RC-Pnn — <title>
Date: <YYYY-MM-DD> · Commits: <COMPONENT-N, …> · Head: <short hash>
Landed: <what now exists, one or two lines>
Skills applied: <anchors actually opened>
Migrations queued: <filenames, or none>
Lovable messages owed: <labels, or none>
Open: <what the next prompt must know, or none>
Next: RC-Pnn
```
Critique passes append minor findings they did not fix under "## Critique findings deferred".

## §13 Vocabulary

Interface text may use: build, part, step, gap, bounty, rebuild, reproduction, "confirmed working", shape, made for, made with, collection, maker, solution, New build. Never: blueprint, blog, post, reblog, remix, stage, block, rating, verification, NeoScale, upload ⟦hicks-law › Familiarity⟧.

## §14 The discovery model

Three intents, one home each ⟦hicks-law › buildgallery's Readers and Their Criteria⟧: use something that works → Gallery (/gallery), ordered by reproductions, then last confirmed, then published, stated in one sentence and never offered as a control; build on someone's work → the Rebuilt lens, the build page's Rebuilds tab and lineage; help where something is stuck → Bounties (/bounties), newest open first. Home (/) is a time-ordered stream of what happened, two tabs. Search is the Gallery with a query. Every discovery surface is one click from the primary navigation.
